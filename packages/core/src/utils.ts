/** Normalize a thrown value into an `Error`. */
export function toError(error: unknown): Error {
	if (error instanceof Error) return error;
	if (
		typeof error === "object" &&
		error !== null &&
		"message" in error &&
		typeof error.message === "string"
	) {
		return new Error(error.message);
	}
	return new Error(String(error));
}

/**
 * Longest run of `nodes` that is already in relative document order. Those
 * never need to move; placing everything else around them is the minimum
 * number of insertions that produces the requested order.
 *
 * Standard patience-sorting LIS: `tails[l]` is the index into `nodes` of the
 * smallest position ending a run of length `l + 1`, and `previous` threads
 * each entry back to its predecessor so the run can be walked out at the end.
 */
function stationary(nodes: Node[], positionOf: (node: Node) => number): Set<Node> {
	const previous = new Int32Array(nodes.length).fill(-1);
	const tails: number[] = [];
	for (let i = 0; i < nodes.length; i++) {
		const position = positionOf(nodes[i]!);
		if (position < 0) continue;
		let low = 0;
		let high = tails.length;
		while (low < high) {
			const middle = (low + high) >> 1;
			if (positionOf(nodes[tails[middle]!]!) < position) low = middle + 1;
			else high = middle;
		}
		if (low > 0) previous[i] = tails[low - 1]!;
		tails[low] = i;
	}

	const keep = new Set<Node>();
	let index = tails.length === 0 ? -1 : tails[tails.length - 1]!;
	while (index >= 0) {
		keep.add(nodes[index]!);
		index = previous[index]!;
	}
	return keep;
}

/**
 * Inserts `nodes` as siblings immediately before `before`. Nodes already in
 * the right place are left alone — "in the right place" meaning in the right
 * order relative to each other, not merely adjacent to their new neighbour,
 * so swapping two rows of a thousand moves two nodes instead of cascading
 * through every node between them.
 */
export function syncDomOrder(parent: HTMLElement, nodes: Node[], before: Node | null): void {
	if (nodes.length === 0) return;

	// Most updates move nothing — a row's text changed, a class flipped — so
	// check the arrangement before paying for the machinery to repair it.
	let cursor: Node | null = before;
	let arranged = true;
	for (let i = nodes.length - 1; i >= 0; i--) {
		if (nodes[i]!.nextSibling !== cursor) {
			arranged = false;
			break;
		}
		cursor = nodes[i]!;
	}
	if (arranged) return;

	// One walk of the parent instead of a `nextSibling` probe per node, and the
	// only way to compare two nodes' order cheaply. Indexed rather than walked
	// through `firstChild` so the server's structural stand-in works too.
	const positions = new Map<Node, number>();
	const children = parent.childNodes;
	const index = children.length;
	for (let i = 0; i < index; i++) positions.set(children[i]!, i);

	// A node standing after the insertion point has to move whatever its order,
	// so it is not a candidate for staying put.
	const limit = before === null ? index : (positions.get(before) ?? index);
	const positionOf = (node: Node): number => {
		const position = positions.get(node);
		return position === undefined || position > limit ? -1 : position;
	};

	const keep = nodes.length > 1 ? stationary(nodes, positionOf) : null;

	cursor = before;
	for (let i = nodes.length - 1; i >= 0; i--) {
		const node = nodes[i]!;
		if (keep?.has(node) !== true && node.nextSibling !== cursor) {
			parent.insertBefore(node, cursor);
		}
		cursor = node;
	}
}

/** The `file:line:column` of the first frame in `stack`, without its function name. */
export function frameLocation(stack: string | undefined): string | undefined {
	// Internal to the diagnostics, like `captureStack`: its only callers hand the
	// result to a developer-facing message, and in production there is no stack to
	// read a frame out of anyway.
	if (!import.meta.env.DEV) return undefined;
	const frame = stack?.split("\n")[0]?.trim();
	if (!frame) return undefined;
	// v8: `at name (file:line:col)` or `at file:line:col`
	const parenthesized = /\((.+)\)$/.exec(frame);
	if (parenthesized) return parenthesized[1];
	// spidermonkey/javascriptcore: `name@file:line:col`
	const at = frame.lastIndexOf("@");
	if (at !== -1) return frame.slice(at + 1);
	return frame.replace(/^at\s+/, "");
}

/** The frames of `stack` below its `Error` header line. */
function framesOf(stack: string | undefined): string[] {
	return stack ? stack.split("\n").slice(1) : [];
}

/**
 * Where core's own modules live, read from this file's own frame. Frames are
 * matched against this directory rather than bare file names so an app's
 * `context.ts` is never mistaken for core's; a bundle that no longer ships those
 * names simply matches nothing and keeps every frame.
 *
 * Resolved on first use rather than at load: this is diagnostic-only machinery,
 * and a module that throws and stack-parses on import is one no bundler can
 * treat as side-effect free.
 */
let coreDirectory: string | undefined;
let coreDirectoryResolved = false;

function getCoreDirectory(): string | undefined {
	if (!coreDirectoryResolved) {
		coreDirectoryResolved = true;
		const file = frameLocation(framesOf(new Error().stack).join("\n"))?.replace(/:\d+:\d+$/, "");
		const slash = file?.lastIndexOf("/") ?? -1;
		coreDirectory = slash === -1 ? undefined : file!.slice(0, slash + 1);
	}
	return coreDirectory;
}

/**
 * The frames above core's own, so the first line is the code that called in.
 * `modules` names the core files to trim off the top; this file's own frame
 * always goes with them.
 */
export function captureStack(modules: string[]): string | undefined {
	// Stacks exist to be read by a developer. Bailing before the throw keeps the
	// capture, the directory probe and the frame walk out of a production build.
	if (!import.meta.env.DEV) return undefined;
	const frames = framesOf(new Error().stack);
	const core = getCoreDirectory();
	if (frames.length === 0 || !core) return frames.join("\n") || undefined;
	const directory = core.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const internal = new RegExp(`${directory}(?:${["utils", ...modules].join("|")})\\.[cm]?[jt]s`);
	while (frames.length > 0 && internal.test(frames[0]!)) frames.shift();
	return frames.length > 0 ? frames.join("\n") : undefined;
}
