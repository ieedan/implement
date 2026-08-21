export type ConsoleLevel = "log" | "info" | "warn" | "error" | "debug";

export type ConsoleEntry = {
	id: number;
	level: ConsoleLevel;
	text: string;
	/** How many consecutive identical messages this entry represents. */
	count: number;
	/** Call/throw site as "file.ts:12", when it could be determined. */
	location: string | null;
	/** Formatted stack lines for error entries; empty otherwise. */
	stack: string[];
};

export const CONSOLE_LEVELS: readonly ConsoleLevel[] = ["log", "info", "warn", "error", "debug"];

export type StackFrame = { fn: string | null; file: string; line: number };

// "at fn (url:1:2)" | "at url:1:2" | "at async fn (url:1:2)"
const V8_FRAME = /^\s*at\s+(?:async\s+)?(?:(.*?)\s+\()?(.+?):(\d+):(\d+)\)?\s*$/;
// "fn@url:1:2" | "@url:1:2" (Firefox/Safari)
const GECKO_FRAME = /^\s*(?:(.*?)@)?(.+?):(\d+):(\d+)\s*$/;

/**
 * Parse an Error#stack string into display frames. Lesson code executes from
 * blob modules whose line numbers match the editor source (sucrase keeps lines
 * stable and import rewriting is same-line), so blob frames map to index.ts.
 */
export function parseStack(stack: string | undefined | null): StackFrame[] {
	if (stack == null || stack === "") return [];
	const frames: StackFrame[] = [];
	for (const line of stack.split("\n")) {
		const match = V8_FRAME.exec(line) ?? GECKO_FRAME.exec(line);
		if (match == null) continue;
		const fn = match[1] != null && match[1] !== "" ? match[1] : null;
		frames.push({ fn, file: displayFile(match[2] ?? ""), line: Number(match[3]) });
	}
	return frames;
}

export function formatStackLines(frames: readonly StackFrame[], max = 10): string[] {
	return frames.slice(0, max).map((frame) => {
		return `at ${frame.fn ?? "<anonymous>"} (${frame.file}:${frame.line})`;
	});
}

export function frameLocation(frame: StackFrame | undefined | null): string | null {
	if (frame == null) return null;
	return `${frame.file}:${frame.line}`;
}

export function formatFileLocation(url: string, line: number): string {
	return `${displayFile(url)}:${line}`;
}

/** The stack of an error-like value from any realm, if it has one. */
export function getErrorStack(value: unknown): string | undefined {
	if (value == null || typeof value !== "object") return undefined;
	const candidate = value as { message?: unknown; stack?: unknown };
	if (typeof candidate.stack !== "string" || typeof candidate.message !== "string") {
		return undefined;
	}
	return candidate.stack;
}

function displayFile(url: string): string {
	if (url.startsWith("blob:")) return "index.ts";
	const clean = url.split("?")[0] ?? url;
	const last = clean.split("/").pop();
	return last == null || last === "" ? url : last;
}

const MAX_DEPTH = 2;
const MAX_ITEMS = 10;

/** Format console arguments the way devtools would print them, joined by spaces. */
export function formatConsoleArgs(args: readonly unknown[]): string {
	return args.map((arg) => formatValue(arg, 0, new Set())).join(" ");
}

// Values arrive from the preview iframe's realm, so checks must not rely on
// `instanceof` against this realm's constructors.
function formatValue(value: unknown, depth: number, seen: Set<object>): string {
	if (typeof value === "string") return depth === 0 ? value : JSON.stringify(value);
	if (value === null || value === undefined) return String(value);
	if (typeof value === "number" || typeof value === "boolean") return String(value);
	if (typeof value === "bigint") return `${value}n`;
	if (typeof value === "symbol") return value.toString();
	if (typeof value === "function") {
		const name = (value as { name?: string }).name;
		return name ? `ƒ ${name}()` : "ƒ ()";
	}

	const obj = value;
	if (seen.has(obj)) return "[Circular]";

	const error = asError(obj);
	if (error != null) return `${error.name}: ${error.message}`;

	const node = asDomNode(obj);
	if (node != null) return node;

	const tag = Object.prototype.toString.call(obj);
	if (tag === "[object Date]") return (obj as Date).toString();
	if (tag === "[object RegExp]") return (obj as RegExp).toString();
	if (tag === "[object Map]") return `Map(${(obj as Map<unknown, unknown>).size})`;
	if (tag === "[object Set]") return `Set(${(obj as Set<unknown>).size})`;
	if (tag === "[object Promise]") return "Promise";

	if (Array.isArray(obj)) {
		if (depth >= MAX_DEPTH) return "[…]";
		seen.add(obj);
		const items = obj
			.slice(0, MAX_ITEMS)
			.map((item) => formatValue(item, depth + 1, seen))
			.join(", ");
		seen.delete(obj);
		const more = obj.length > MAX_ITEMS ? ", …" : "";
		return `[${items}${more}]`;
	}

	if (depth >= MAX_DEPTH) return "{…}";
	seen.add(obj);
	const name = constructorName(obj);
	const prefix = name === "Object" ? "" : `${name} `;
	let entries: [string, unknown][];
	try {
		entries = Object.entries(obj);
	} catch {
		return `${prefix}{}`;
	}
	const body = entries
		.slice(0, MAX_ITEMS)
		.map(([key, item]) => `${key}: ${formatValue(item, depth + 1, seen)}`)
		.join(", ");
	seen.delete(obj);
	const more = entries.length > MAX_ITEMS ? ", …" : "";
	return `${prefix}{${body}${more}}`;
}

function asError(value: object): { name: string; message: string } | null {
	const candidate = value as { name?: unknown; message?: unknown; stack?: unknown };
	if (typeof candidate.name !== "string") return null;
	if (typeof candidate.message !== "string") return null;
	if (typeof candidate.stack !== "string") return null;
	return { name: candidate.name, message: candidate.message };
}

function asDomNode(value: object): string | null {
	const candidate = value as { nodeType?: unknown; nodeName?: unknown; id?: string };
	if (typeof candidate.nodeType !== "number" || typeof candidate.nodeName !== "string") {
		return null;
	}
	if (candidate.nodeType === 1) {
		const el = value as Element;
		const id = el.id ? `#${el.id}` : "";
		const classes =
			typeof el.className === "string" && el.className !== ""
				? `.${el.className.trim().split(/\s+/).join(".")}`
				: "";
		return `<${el.tagName.toLowerCase()}${id}${classes}>`;
	}
	if (candidate.nodeType === 3) return JSON.stringify((value as Text).nodeValue ?? "");
	if (candidate.nodeType === 9) return "#document";
	return candidate.nodeName.toLowerCase();
}

function constructorName(value: object): string {
	const ctor = (value as { constructor?: { name?: string } }).constructor;
	return ctor?.name != null && ctor.name !== "" ? ctor.name : "Object";
}
