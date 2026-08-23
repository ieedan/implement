import { relative } from "node:path";
import { ENDPOINT_FILE } from "./scan.ts";

/** `foo.server.ts`, `foo.server.js`, … — a resolved module id that is a server file. */
const SERVER_MODULE = /\.server\.[cm]?[jt]sx?$/;
/** The same, plus the extensionless form a TypeScript import writes: `@/lib/env.server`. */
const SERVER_SPECIFIER = /\.server(\.[cm]?[jt]sx?)?$/;
/**
 * `…/server`, `…/server.ts` — how an import of a route endpoint reads. Nothing
 * in that name says server (a `lib/server.ts` is ordinary code), so it is only
 * a pre-filter: {@link isEndpointModule} decides, once the id is resolved.
 */
const ENDPOINT_SPECIFIER = /(?:^|\/)server(\.[cm]?[jt]sx?)?$/;

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

/**
 * Whether a resolved id is a route's `server.ts` — an endpoint. These are as
 * server-only as any `*.server.ts`: they import databases and secrets, and the
 * router never puts one in the client graph. The directory is what makes the
 * file an endpoint, so this is the one check that needs to know where routes
 * live; `null` (routes not resolved yet) means no id qualifies.
 */
export function isEndpointModule(id: string, routesDir: string | null): boolean {
	if (routesDir === null || RESOURCE_QUERY.test(id)) return false;
	const file = withoutQuery(id).replaceAll("\\", "/");
	const dir = routesDir.replaceAll("\\", "/").replace(/\/$/, "");
	return file.startsWith(`${dir}/`) && file.endsWith(`/${ENDPOINT_FILE}`);
}

/** Whether a specifier could name an endpoint — checked before paying for resolution. */
export function isEndpointSpecifier(source: string): boolean {
	return !RESOURCE_QUERY.test(source) && ENDPOINT_SPECIFIER.test(withoutQuery(source));
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

/**
 * How one module wrote its import of another. A chain of file names says a
 * client file reached a server file; this says which import to delete.
 */
export type ImportSite = {
	/** `import` for a static import, `export` for a re-export, `dynamic` for `import(…)`. */
	kind: "import" | "export" | "dynamic";
	/** The clause as written — `{ NewIssueSchema }`, `* as db` — `null` for a bare import. */
	clause: string | null;
	/** The specifier as written. */
	source: string;
	/** 1-based line of the statement. */
	line: number;
};

/** A module in an importer chain, with the import that made it a link when it is known. */
export type ChainLink = { id: string; site?: ImportSite | undefined };

/** How `parent` imports `child` — best effort, so it may come back undefined. */
export type ImportSiteLookup = (parent: string, child: string) => Promise<ImportSite | undefined>;

/**
 * Import and re-export statements with the clause each one wrote. Regexes
 * rather than a parse: this only enriches an error message, and every hit is
 * confirmed by resolving its specifier to the module it claims to reach, so a
 * stray match inside a comment goes unused rather than lying. The clause is
 * held to characters an import clause can actually contain, which is what
 * keeps `export const x = 1` from swallowing the `from` on the next line.
 */
const STATIC_IMPORT =
	/(?:^|[\s;}])(import|export)\s+([A-Za-z0-9_$*,{}\s]*?)\s*\bfrom\s*["']([^"']+)["']/g;
const BARE_IMPORT = /(?:^|[\s;}])import\s*["']([^"']+)["']/g;
const DYNAMIC_IMPORT = /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g;

function lineAt(code: string, index: number): number {
	let line = 1;
	for (let i = 0; i < index; i++) if (code[i] === "\n") line++;
	return line;
}

/** Where the keyword sits: the leading group matches one character, or nothing at all. */
function keywordIndex(match: RegExpExecArray): number {
	return /^(?:import|export)/.test(match[0]) ? match.index : match.index + 1;
}

/** Every import in `code`, type-only ones excluded — they are erased before a bundler sees them. */
export function scanImports(code: string): ImportSite[] {
	const sites: ImportSite[] = [];
	for (const match of code.matchAll(STATIC_IMPORT)) {
		const clause = (match[2] ?? "").replace(/\s+/g, " ").trim();
		if (/^type\b/.test(clause)) continue;
		sites.push({
			kind: match[1] === "export" ? "export" : "import",
			clause: clause === "" ? null : clause,
			source: match[3] ?? "",
			line: lineAt(code, keywordIndex(match)),
		});
	}
	for (const match of code.matchAll(BARE_IMPORT)) {
		sites.push({
			kind: "import",
			clause: null,
			source: match[1] ?? "",
			line: lineAt(code, keywordIndex(match)),
		});
	}
	for (const match of code.matchAll(DYNAMIC_IMPORT)) {
		sites.push({
			kind: "dynamic",
			clause: null,
			source: match[1] ?? "",
			line: lineAt(code, match.index),
		});
	}
	return sites;
}

/** The import phrase an error line reads out: `imports { NewIssueSchema }`. */
function importPhrase(site: ImportSite): string {
	if (site.kind === "dynamic") return `imports "${site.source}" dynamically`;
	if (site.clause === null) return `imports "${site.source}" for its side effects`;
	return `${site.kind === "export" ? "re-exports" : "imports"} ${site.clause}`;
}

/**
 * Pairs every id in a chain with the import that reached the module below it —
 * `chain[0]`'s import of `id`, `chain[1]`'s of `chain[0]`, and so on.
 */
export async function chainLinks(
	id: string,
	chain: string[],
	site: ImportSiteLookup,
): Promise<ChainLink[]> {
	const links: ChainLink[] = [];
	let child = id;
	for (const parent of chain) {
		links.push({ id: parent, site: await site(parent, child) });
		child = parent;
	}
	return links;
}

/** A module id as it should read in an error: root-relative, virtual ids unwrapped. */
export function displayId(id: string, root: string): string {
	if (id.startsWith("\0")) return id.slice(1);
	if (id.startsWith("$implement/") || !id.startsWith("/")) return id;
	const rel = relative(root, withoutQuery(id));
	return rel === "" || rel.startsWith("..") ? id : rel.replaceAll("\\", "/");
}

/** What the client reached for: a `*.server.ts`, or a route's `server.ts`. */
export type ServerKind = "server" | "endpoint";

export type ServerImportViolation = {
	/** Resolved id of the server file that was imported. */
	server: string;
	/** Which flavour of server-only module it is — the two read differently. */
	kind?: ServerKind | undefined;
	/** Resolved id of the client module that imported it. */
	importer: string;
	/** The specifier as it was written. */
	source: string;
	/** Importers of `importer`, nearest first — may be empty. */
	chain: ChainLink[];
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
	const endpoint = violation.kind === "endpoint";
	const lines = [
		`${server} is ${endpoint ? "a route endpoint" : "a server file"} and cannot be imported by client code.`,
		``,
		`  ${server}`,
		`  imported by ${importer}${source === server ? "" : ` as "${source}"`}`,
	];
	for (const link of violation.chain) {
		const where = link.site === undefined ? "" : `:${link.site.line}`;
		const how = link.site === undefined ? "" : ` ${importPhrase(link.site)}`;
		lines.push(`    ← ${displayId(link.id, root)}${where}${how}`);
	}
	lines.push(``);
	lines.push(
		...(endpoint
			? [
					`A route's \`${ENDPOINT_FILE}\` runs only on the server — its handlers, and`,
					`everything they import, never reach the browser. Move what the client`,
					`needs — a schema, a constant, a type — into a shared module both sides`,
					`import, or write \`import type { … }\` if the import is only for types.`,
				]
			: [
					`Server files run only on the server — their values never reach the browser.`,
					`Move what the client needs into a shared module (or, for environment`,
					`variables, into the public env file), or write \`import type { … }\` if the`,
					`import is only for types.`,
				]),
	);
	return lines.join("\n");
}
