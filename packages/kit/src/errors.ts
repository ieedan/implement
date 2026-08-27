/**
 * Attribution and formatting for the errors kit's request pipeline catches.
 * A stack trace says which line threw; it does not say which of a route's
 * loads was running, which endpoint method was dispatched, or which request
 * was in flight — so the pipeline records that as the error travels out, and
 * the dev server prints it above a trace trimmed down to the app's own files.
 *
 * Dependency-free, like `./match.ts`: the formatter is plain string work so
 * the plugin half can use it without pulling anything in.
 */

import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { RequestEvent } from "./match.ts";

// ---------------------------------------------------------------------------
// error() / redirect()
// ---------------------------------------------------------------------------

/**
 * The expected-failure half of the pipeline lives here rather than in
 * `./server.ts` so `./endpoint.ts` can throw one without importing the server
 * back — a validated handler answering a bad request is the same `HttpError`
 * a load's `error(404)` is, and `hooks.server.ts` must not be able to tell
 * them apart. `./server.ts` re-exports every name below, which is where apps
 * import them from.
 */

/** Thrown by {@link error}: an expected failure with a status and a body. */
export class HttpError {
	readonly status: number;
	readonly body: App.Error;

	constructor(status: number, body: App.Error) {
		this.status = status;
		this.body = body;
	}

	toString(): string {
		return JSON.stringify(this.body);
	}
}

/** Thrown by {@link redirect}. */
export class Redirect {
	readonly status: number;
	readonly location: string;

	constructor(status: number, location: string) {
		this.status = status;
		this.location = location;
	}
}

/**
 * Throws an expected error: the request ends with `status` and `body`, the
 * error page renders it, and `handleError` is not called.
 *
 * ```ts
 * if (event.locals.user === null) error(401, "Not logged in");
 * ```
 */
export function error(status: number, body: App.Error | string): never {
	if (status < 400 || status > 599) {
		throw new Error(`error() status must be between 400 and 599, got ${status}`);
	}
	throw new HttpError(status, typeof body === "string" ? { message: body } : body);
}

/**
 * Throws a redirect: the request ends with `status` and a `location` header.
 *
 * ```ts
 * if (event.locals.user === null) redirect(303, "/login");
 * ```
 */
export function redirect(status: number, location: string | URL): never {
	if (status < 300 || status > 308) {
		throw new Error(`redirect() status must be between 300 and 308, got ${status}`);
	}
	throw new Redirect(status, location.toString());
}

export function isHttpError(thrown: unknown): thrown is HttpError {
	return thrown instanceof HttpError;
}

export function isRedirect(thrown: unknown): thrown is Redirect {
	return thrown instanceof Redirect;
}

/**
 * Standard Schema issues as one line: `title: too short; tags.0: expected a
 * string`. Shared by the env files, which report a whole file at once, and by
 * validated endpoints, which report one request part at a time.
 */
export function formatSchemaIssues(issues: readonly StandardSchemaV1.Issue[]): string {
	return issues
		.map((issue) => {
			const path = (issue.path ?? [])
				.map((segment) => (typeof segment === "object" ? String(segment.key) : String(segment)))
				.join(".");
			return path === "" ? issue.message : `${path}: ${issue.message}`;
		})
		.join("; ");
}

// ---------------------------------------------------------------------------
// Attribution
// ---------------------------------------------------------------------------

/** What the pipeline was doing when an unexpected error came out of the app. */
export type ErrorSource =
	/** A `page.server.ts` / `layout.server.ts` load, by its routes-relative file. */
	| { kind: "load"; file: string }
	/** A `server.ts` handler, by its routes-relative file and the method dispatched. */
	| { kind: "endpoint"; file: string; method: string }
	/** A `server.ts` socket handler, by its routes-relative file. */
	| { kind: "socket"; file: string }
	/** The page render — a component threw while the matched route rendered. */
	| { kind: "render" }
	/** The app's `error.ts`, which threw while rendering another error. */
	| { kind: "error-page" };

/** What a reporter receives for every unexpected error the pipeline catches. */
export type ServerErrorReport = {
	error: unknown;
	event: RequestEvent;
	/** The status the response will carry — `500` for anything unexpected. */
	status: number;
	/** Where it came from, or `null` when it was thrown by `handle` itself. */
	source: ErrorSource | null;
};

/**
 * Sources by thrown value, rather than a property on the error: the error is
 * the app's own object, it may be frozen, and it is about to be handed to the
 * app's `handleError` — kit has no business writing to it.
 */
const sources = new WeakMap<object, ErrorSource>();

/**
 * Records where `thrown` came from and returns it, for `throw markErrorSource(…)`
 * at the boundary that knows. The innermost boundary wins: an error marked by
 * the load that threw keeps that attribution as the page render rethrows it.
 */
export function markErrorSource<T>(thrown: T, source: ErrorSource): T {
	if (typeof thrown === "object" && thrown !== null && !sources.has(thrown)) {
		sources.set(thrown, source);
	}
	return thrown;
}

/** Where a thrown value came from, or `null` when nothing attributed it. */
export function errorSource(thrown: unknown): ErrorSource | null {
	if (typeof thrown !== "object" || thrown === null) return null;
	return sources.get(thrown) ?? null;
}

/**
 * The report as one block of terminal output: a headline naming the request,
 * the status, and the server file that threw, then the error with its stack
 * trimmed to the app's own frames.
 *
 * ```
 * GET /docs/install → 500 — load in src/routes/docs/[...slug]/page.server.ts
 *
 * Error: no such file
 *     at readDoc (src/lib/docs.ts:14:9)
 *     at load (src/routes/docs/[...slug]/page.server.ts:6:10)
 * ```
 */
export function formatServerError(
	report: ServerErrorReport,
	options: { root: string; routes: string },
): string {
	const { error, event, status, source } = report;
	// a data request carries the page's url, so say which of the two it was
	const suffix = event.isDataRequest ? " (__data.json)" : "";
	const request = `${event.request.method} ${event.url.pathname}${event.url.search}${suffix}`;
	const where = describeSource(source, event, options.routes);
	const headline = `${request} → ${status}${where === null ? "" : ` — ${where}`}`;
	return `${headline}\n\n${errorBlock(error, options.root)}`;
}

/** The route file behind an error, in the form the app's editor can open. */
function describeSource(
	source: ErrorSource | null,
	event: RequestEvent,
	routes: string,
): string | null {
	const route = event.route.id;
	if (source === null) return route === null ? null : `route ${route}`;
	if (source.kind === "load") return `load in ${routes}/${source.file}`;
	if (source.kind === "endpoint") return `${source.method} handler in ${routes}/${source.file}`;
	if (source.kind === "socket") return `the socket handler in ${routes}/${source.file}`;
	if (source.kind === "error-page") return `the error page (${routes}/error.ts)`;
	if (source.kind === "render") {
		return route === null ? "the page render" : `the page render for ${route}`;
	}
	return null;
}

/** The error and its `cause` chain, each with its own trimmed stack. */
function errorBlock(thrown: unknown, root: string): string {
	if (!(thrown instanceof Error)) return describeThrown(thrown);
	const parts = [stackOf(thrown, root)];
	const seen = new Set<unknown>([thrown]);
	let cause: unknown = thrown.cause;
	// a cause may be anything, including a cycle back to an error already printed
	while (cause !== undefined && cause !== null && !seen.has(cause) && parts.length < 5) {
		seen.add(cause);
		parts.push(
			`caused by: ${cause instanceof Error ? stackOf(cause, root) : describeThrown(cause)}`,
		);
		cause = cause instanceof Error ? cause.cause : undefined;
	}
	return parts.join("\n");
}

/** Something that isn't an `Error` — say what it was rather than `[object Object]`. */
function describeThrown(thrown: unknown): string {
	if (typeof thrown === "object" && thrown !== null) {
		try {
			return `thrown value (not an Error): ${JSON.stringify(thrown)}`;
		} catch {
			return `thrown value (not an Error): ${Object.prototype.toString.call(thrown)}`;
		}
	}
	return `thrown value (not an Error): ${typeof thrown === "string" ? JSON.stringify(thrown) : String(thrown)}`;
}

/**
 * The error's stack with every frame outside the app's own source dropped —
 * kit's pipeline, the framework's node_modules, and node internals sit
 * between the app's frames and the request, and none of them is where the bug
 * is. The count of what was dropped stays, so a trace is never quietly short.
 */
function stackOf(error: Error, root: string): string {
	const stack = error.stack ?? "";
	const lines = stack.split("\n");
	const start = lines.findIndex((line) => /^\s*at\s/.test(line));
	// a message may be several lines, and a stackless error has none of this
	const message = start === -1 ? stack.trim() : lines.slice(0, start).join("\n").trimEnd();
	const frames = start === -1 ? [] : lines.slice(start);
	const header = message === "" ? `${error.name}: ${error.message}` : message;
	if (frames.length === 0) return header;

	const app: string[] = [];
	for (const frame of frames) {
		const file = frameFile(frame);
		if (file === null || !isAppFile(file, root)) continue;
		app.push(frame.replace(file, relativeTo(file, root)));
	}
	// nothing of the app's own in the trace (a dependency threw on its own
	// stack) — a full trace beats no trace at all
	if (app.length === 0) return [header, ...frames].join("\n");
	const hidden = frames.length - app.length;
	const note =
		hidden === 0 ? [] : [`    … ${hidden} frame${hidden === 1 ? "" : "s"} outside your app`];
	return [header, ...app, ...note].join("\n");
}

/** The absolute path a stack frame points at, or `null` when it names none. */
function frameFile(frame: string): string | null {
	const match = /\(?((?:file:\/\/)?(?:\/|[A-Za-z]:[\\/])[^()]*):\d+:\d+\)?\s*$/.exec(frame.trim());
	return match === null ? null : match[1]!;
}

/** The app's own source: under the root, and neither a dependency nor generated. */
function isAppFile(file: string, root: string): boolean {
	const path = normalize(fromFileUrl(file));
	const base = normalize(root).replace(/\/+$/, "");
	if (!path.startsWith(`${base}/`)) return false;
	const inside = path.slice(base.length + 1);
	return !inside.includes("node_modules/") && !inside.startsWith(".implement/");
}

/** A frame's path as the app would write it — clickable from the project root. */
function relativeTo(file: string, root: string): string {
	const path = normalize(fromFileUrl(file));
	const base = normalize(root).replace(/\/+$/, "");
	return path.startsWith(`${base}/`) ? path.slice(base.length + 1) : path;
}

function normalize(path: string): string {
	return path.replaceAll("\\", "/");
}

/** `file:///src/app.ts` → `/src/app.ts`, with the windows drive prefix unwrapped. */
function fromFileUrl(file: string): string {
	if (!file.startsWith("file://")) return file;
	const path = decodeURIComponent(file.slice("file://".length));
	return /^\/[A-Za-z]:/.test(path) ? path.slice(1) : path;
}
