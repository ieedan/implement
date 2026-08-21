/**
 * Hydration: adopting server-rendered DOM instead of recreating it.
 *
 * The server ran the exact same mount + `syncDomOrder` code, so the serialized
 * markup is already in the final arrangement a fresh client mount converges
 * to. Hydration therefore replays the normal mount choreography unchanged —
 * helpers keep appending fresh anchor comments and running their sync passes —
 * while element and text creation goes through a claim cursor that adopts the
 * next matching serialized node instead of building a new one. The server's
 * own anchor comments are never claimed; whatever a pass leaves unclaimed is
 * swept when it ends.
 *
 * Any structural mismatch (the claimed node is not what the code creates,
 * which means client state diverged from the server render) fails the whole
 * pass, recording what diverged and where for `App.render` to report. Creation
 * falls back to building fresh nodes mid-pass and `App.render` discards
 * everything and remounts from scratch, so a mismatch degrades to exactly the
 * tier-1 behavior.
 */

import { captureStack } from "./utils";

type ParentState = {
	/** Next serialized node this parent may hand out. */
	cursor: Node | null;
	/** The parent's children before any claiming, for the leftover sweep. */
	preexisting: Set<Node>;
};

type HydrationState = {
	root: Element;
	parents: Map<Node, ParentState>;
	claimed: Set<Node>;
	/** The element the current `mount(parent)` call is mounting into. */
	currentParent: Node | null;
	/** What went wrong, recorded at the first failing claim. */
	mismatch: HydrationMismatch | null;
};

/**
 * Where a pass stopped matching. Recorded at the claim that failed — the only
 * point where both sides are still known: what the client render asked for,
 * what the server left there, and the stack of component frames that got here.
 * By the time `App.render` reports it the pass has moved on, so nothing about
 * the failure is recoverable from the fallback path itself.
 */
export type HydrationMismatch = {
	/** What the client render tried to create. */
	expected: string;
	/** What the server markup had in that position. */
	found: string;
	/** Path from the hydration root down to the parent being filled. */
	path: string;
	/** The parent whose children diverged, for an inspectable console entry. */
	parent: Node | null;
	/** The serialized node the claim rejected, if there was one. */
	node: Node | null;
	/** Stack from the failing claim: the component frames that built this node. */
	stack: string | undefined;
};

let state: HydrationState | null = null;

export function beginHydration(root: Element): void {
	state = {
		root,
		parents: new Map(),
		claimed: new Set(),
		currentParent: null,
		mismatch: null,
	};
}

/**
 * Ends the pass. On success, sweeps every serialized node that was never
 * claimed (the server's anchor comments, plus any subtree the client render
 * legitimately no longer produces) and returns `null`. Returns the recorded
 * mismatch when the pass failed and the caller must discard the server markup
 * and mount fresh.
 */
export function endHydration(): HydrationMismatch | null {
	const current = state;
	state = null;
	if (!current) return null;
	if (current.mismatch) return current.mismatch;
	for (const { preexisting } of current.parents.values()) {
		for (const node of preexisting) {
			// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Unclaimed SSR nodes are removed from the live DOM tree.
			if (!current.claimed.has(node)) (node as ChildNode).remove();
		}
	}
	return null;
}

export function isHydrating(): boolean {
	return state !== null && state.mismatch === null;
}

/**
 * A structural mismatch: record what diverged (the first one only — every
 * later claim in the pass is downstream of it and would only bury the cause)
 * and fall back to fresh creation for the rest of the pass.
 */
function fail(expected: string, found: Node | null): null {
	if (state && !state.mismatch) {
		state.mismatch = {
			expected,
			found: describeNode(found),
			path: domPath(state.currentParent, state.root),
			parent: state.currentParent,
			node: found,
			// the component functions that built this node, which is the thing worth
			// knowing and the thing the fallback path's own stack cannot show
			stack: captureStack(["hydrate", "dom"]),
		};
	}
	return null;
}

/** Track the element a mount call is inserting into, so claims know their parent. */
export function withMountParent<T>(parent: HTMLElement, fn: () => T): T {
	if (!state) return fn();
	const previous = state.currentParent;
	state.currentParent = parent;
	try {
		return fn();
	} finally {
		if (state) state.currentParent = previous;
	}
}

/** Claimable parents: the hydration root and any element claimed this pass. */
function parentStateFor(parent: Node | null): ParentState | null {
	if (!state || state.mismatch || !parent) return null;
	if (parent !== state.root && !state.claimed.has(parent)) return null;
	let entry = state.parents.get(parent);
	if (!entry) {
		entry = { cursor: parent.firstChild, preexisting: new Set(parent.childNodes) };
		state.parents.set(parent, entry);
	}
	return entry;
}

function parentState(): ParentState | null {
	return parentStateFor(state?.currentParent ?? null);
}

/**
 * Position a freshly created node (a helper's anchor comment) during
 * hydration. Fresh mounting appends anchors and lets `syncDomOrder` pull
 * content into place, but during hydration an anchor appended at the end
 * would sit beyond later siblings' still-unclaimed nodes and the sync pass
 * would drag content past them. Inserting at the cursor — the exact spot the
 * replay has reached — keeps every subsequent sync convergent with the
 * arrangement a fresh mount produces. Returns false when not hydrating (the
 * caller appends normally).
 */
export function attachAtCursor(parent: HTMLElement, node: Node): boolean {
	const entry = parentStateFor(parent);
	if (!entry) return false;
	if (entry.cursor) {
		parent.insertBefore(node, entry.cursor);
	} else {
		parent.appendChild(node);
	}
	return true;
}

/**
 * Serialized anchor comments belong to helpers that always create fresh ones,
 * so claims for content nodes step over them (the sweep removes them later).
 */
function skipComments(entry: ParentState): void {
	while (entry.cursor && entry.cursor.nodeType === 8) {
		entry.cursor = entry.cursor.nextSibling;
	}
}

export function claimElement(tag: string): HTMLElement | null {
	const entry = parentState();
	if (!entry) return null;
	skipComments(entry);
	const node = entry.cursor;
	if (!(node instanceof Element) || node.localName !== tag) return fail(`<${tag}>`, node);
	entry.cursor = node.nextSibling;
	state!.claimed.add(node);
	// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Element tag and localName were verified above.
	return node as HTMLElement;
}

export function claimSvgRoot(): SVGSVGElement | null {
	const entry = parentState();
	if (!entry) return null;
	skipComments(entry);
	const node = entry.cursor;
	if (!(node instanceof Element) || node.localName !== "svg") return fail("<svg>", node);
	entry.cursor = node.nextSibling;
	state!.claimed.add(node);
	// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- SVG root localName was verified above.
	return node as SVGSVGElement;
}

export function claimText(data: string): Text | null {
	const entry = parentState();
	if (!entry) return null;
	skipComments(entry);
	// the serializer emits nothing for empty text, so recreate it in place
	if (data === "") {
		const node = state!.root.ownerDocument.createTextNode("");
		if (entry.cursor) {
			entry.cursor.parentNode!.insertBefore(node, entry.cursor);
		} else {
			state!.currentParent!.appendChild(node);
		}
		state!.claimed.add(node);
		return node;
	}
	const node = entry.cursor;
	if (!(node instanceof Text)) return fail(`text ${quote(data)}`, node);
	if (node.data === data) {
		entry.cursor = node.nextSibling;
		state!.claimed.add(node);
		return node;
	}
	// adjacent text mountables serialize merged; carve this one's piece off
	if (node.data.startsWith(data)) {
		const tail = node.splitText(data.length);
		entry.preexisting.add(tail);
		entry.cursor = tail;
		state!.claimed.add(node);
		return node;
	}
	return fail(`text ${quote(data)}`, node);
}

/** True when `node` was adopted this pass and is already in position. */
export function wasClaimed(node: Node): boolean {
	return state !== null && state.claimed.has(node);
}

export type HtmlBlock = {
	/** Where the helper's own start comment belongs (first content node, or the end position). */
	before: Node | null;
	/** Where the helper's own end comment belongs (the node after the block). */
	after: Node | null;
};

/**
 * Claims an `Html` block: the span the server serialized between its
 * `<!--html-->` / `<!--/html-->` delimiters. Content is adopted as-is — the
 * markup is trusted and deterministic, so it is not re-parsed or compared.
 */
export function claimHtmlBlock(): HtmlBlock | null {
	const entry = parentState();
	if (!entry) return null;
	// step over other helpers' anchors, but stop at content — an Html mount
	// whose cursor is not at an html delimiter is a structural mismatch
	while (entry.cursor && entry.cursor.nodeType === 8 && entry.cursor.nodeValue !== "html") {
		entry.cursor = entry.cursor.nextSibling;
	}
	const start = entry.cursor;
	if (!start || start.nodeType !== 8) return fail("<!--html--> block", start);
	let node = start.nextSibling;
	const first = node && !(node.nodeType === 8 && node.nodeValue === "/html") ? node : null;
	while (node && !(node.nodeType === 8 && node.nodeValue === "/html")) {
		state!.claimed.add(node);
		node = node.nextSibling;
	}
	if (!node) return fail("<!--/html--> end of an Html block", null);
	const after = node.nextSibling;
	entry.cursor = after;
	return { before: first ?? after, after };
}

/* -- Reporting ----------------------------------------------------------- */

function truncate(value: string, max: number): string {
	return value.length > max ? `${value.slice(0, max)}…` : value;
}

function quote(data: string): string {
	return `"${truncate(data.replace(/\s+/g, " "), 40)}"`;
}

/** A one-line rendering of a serialized node, close to how it reads in markup. */
function describeNode(node: Node | null): string {
	if (!node) return "nothing (the parent had no more children)";
	if (node instanceof Element) {
		const attributes = Array.from(node.attributes)
			.map((attribute) => ` ${attribute.name}="${truncate(attribute.value, 30)}"`)
			.join("");
		return `<${node.localName}${truncate(attributes, 80)}>`;
	}
	if (node.nodeType === 3) return `text ${quote(node.nodeValue ?? "")}`;
	if (node.nodeType === 8) return `<!--${truncate(node.nodeValue ?? "", 40)}-->`;
	return `node of type ${node.nodeType}`;
}

/** `tag#id.class:nth-child(n)`, with the parts that actually distinguish it. */
function describeStep(node: Node): string {
	if (!(node instanceof Element)) return describeNode(node);
	let step = node.localName;
	if (node.id) step += `#${node.id}`;
	const parent = node.parentElement;
	if (parent && parent.children.length > 1) {
		step += `:nth-child(${Array.prototype.indexOf.call(parent.children, node) + 1})`;
	}
	return step;
}

/** The chain of elements from the hydration root down to `node`, inclusive. */
function domPath(node: Node | null, root: Element): string {
	if (!node) return "(unknown)";
	const steps: string[] = [];
	let current: Node | null = node;
	while (current) {
		steps.unshift(current === root ? "[data-ssr]" : describeStep(current));
		if (current === root) break;
		current = current.parentNode;
	}
	return steps.join(" > ");
}

/**
 * The developer-facing report. Names both sides of the divergence and where in
 * the tree it happened, then points at the usual cause: a render that read
 * something the server could not see.
 */
export function describeMismatch(mismatch: HydrationMismatch): string {
	return [
		"[implement] hydration mismatch: discarding server-rendered markup and mounting fresh.",
		`  expected: ${mismatch.expected}`,
		`  found:    ${mismatch.found}`,
		`  in:       ${mismatch.path}`,
		"The client render produced different markup than the server did. The usual cause is",
		"reading browser-only state while rendering (localStorage, matchMedia, window sizes,",
		"Date, randomness) — move that into onMount, or render the server's value first and",
		"let a signal update it. The page is correct, but it paid for a full re-render.",
		mismatch.stack ? `\n${mismatch.stack}` : "",
	].join("\n");
}
