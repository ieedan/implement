import { relative } from "node:path";

/** `foo.server.ts`, `foo.server.js`, … — a resolved module id that is a server file. */
const SERVER_MODULE = /\.server\.[cm]?[jt]sx?$/;
/** The same, plus the extensionless form a TypeScript import writes: `@/lib/env.server`. */
const SERVER_SPECIFIER = /\.server(\.[cm]?[jt]sx?)?$/;

/**
 * Vite queries that ask for a file as a resource rather than as a module —
 * `?raw` is its text, `?url` its emitted path. Neither links the module's
 * bindings, and asking for a server file that way is a deliberate act (this
 * docs site renders lesson `*.server.ts` sources with `?raw`), so both layers
 * leave them alone.
 */
const RESOURCE_QUERY = /[?&](raw|url|inline)(?:&|$)/;

function withoutQuery(id: string): string {
	const cut = id.search(/[?#]/);
	return cut === -1 ? id : id.slice(0, cut);
}

/** Whether a resolved module id names a server file. */
export function isServerModule(id: string): boolean {
	return !RESOURCE_QUERY.test(id) && SERVER_MODULE.test(withoutQuery(id));
}

/**
 * Whether an import specifier looks like it points at a server file — checked
 * before resolving, so the guard only pays for resolution on the imports that
 * could possibly be violations.
 */
export function isServerSpecifier(source: string): boolean {
	return !RESOURCE_QUERY.test(source) && SERVER_SPECIFIER.test(withoutQuery(source));
}

/** Returns the modules that import `id`, for walking a chain back to an entry. */
export type ImporterLookup = (id: string) => Iterable<string>;

/**
 * The shortest chain of importers from `id` up to a module nothing imports —
 * an entry. Best effort: dev and build expose the module graph differently and
 * a chain may be incomplete, so the caller always has the direct importer to
 * fall back on. `id` itself is not included.
 */
export function importerChain(id: string, importers: ImporterLookup, limit = 16): string[] {
	const seen = new Set([id]);
	const chain: string[] = [];
	let current = id;
	while (chain.length < limit) {
		let next: string | undefined;
		for (const importer of importers(current)) {
			if (seen.has(importer)) continue;
			next = importer;
			break;
		}
		if (next === undefined) return chain;
		seen.add(next);
		chain.push(next);
		current = next;
	}
	return chain;
}

/** A module id as it should read in an error: root-relative, virtual ids unwrapped. */
export function displayId(id: string, root: string): string {
	if (id.startsWith("\0")) return id.slice(1);
	if (id.startsWith("$implement/") || !id.startsWith("/")) return id;
	const rel = relative(root, withoutQuery(id));
	return rel === "" || rel.startsWith("..") ? id : rel.replaceAll("\\", "/");
}

export type ServerImportViolation = {
	/** Resolved id of the server file that was imported. */
	server: string;
	/** Resolved id of the client module that imported it. */
	importer: string;
	/** The specifier as it was written. */
	source: string;
	/** Importers of `importer`, nearest first — may be empty. */
	chain: string[];
	root: string;
};

/**
 * The Layer 1 error. Names the server file, the client file that reached for
 * it, and the chain back to the entry — `$implement/router` imports every page
 * eagerly, so one bad import poisons the whole client bundle and the chain is
 * the only thing that makes it actionable.
 */
export function serverImportError(violation: ServerImportViolation): string {
	const { root } = violation;
	const server = displayId(violation.server, root);
	const importer = displayId(violation.importer, root);
	// the specifier reads differently per environment — dev sees what was written, the build
	// sees it after `vite:alias` — so it is only worth showing when it adds something
	const source = displayId(violation.source, root);
	const lines = [
		`${server} is a server file and cannot be imported by client code.`,
		``,
		`  ${server}`,
		`  imported by ${importer}${source === server ? "" : ` as "${source}"`}`,
	];
	for (const link of violation.chain) lines.push(`    ← ${displayId(link, root)}`);
	lines.push(
		``,
		`Server files run only on the server — their values never reach the browser.`,
		`Move what the client needs into a shared module (or, for environment`,
		`variables, into the public env file), or write \`import type { … }\` if the`,
		`import is only for types.`,
	);
	return lines.join("\n");
}
