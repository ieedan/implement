/**
 * Which routes the build turns into files.
 *
 * Without an adapter there is no other option: a page that is not prerendered
 * is a page the built site does not have, so everything prerenders and a load
 * runs once, at build time. An adapter that ships a server changes the
 * question — a page whose load reads a database must be rendered per request,
 * or every visitor gets whatever the build machine saw — so the default flips
 * to prerendering only what has no server load behind it, and routes say
 * otherwise for themselves:
 *
 * ```ts
 * // src/routes/blog/[slug]/page.server.ts
 * export const prerender = true;
 * ```
 *
 * The flag lives on the server files (`page.server.ts`, `layout.server.ts`,
 * `server.ts`) because those are the modules that make a route dynamic in the
 * first place. The nearest one to the page wins, so a layout can prerender a
 * whole section and one page underneath it can opt back out.
 */

import { pageDataChains, type ServerRoute } from "./codegen.ts";
import { comparePatterns, matchRoutePattern, normalizeRoutePath } from "./match.ts";
import type { RouteTree } from "./scan.ts";

/**
 * What a route prerenders by default:
 *
 * - `true` — everything, which is the only thing a static build can mean.
 * - `false` — nothing; the server answers every request.
 * - `"auto"` — pages with no server load prerender, pages with one do not,
 *   and endpoints wait for the server. What a server adapter gets.
 */
export type PrerenderDefault = boolean | "auto";

export type PrerenderPolicy = {
	/** Whether the page serving `path` should be prerendered. */
	page(path: string): Promise<boolean>;
	/** Whether a `server.ts` endpoint should be prerendered. */
	endpoint(route: Pick<ServerRoute, "file">): Promise<boolean>;
};

/** A module's `prerender` export, when it declares one as a boolean. */
function declaredFlag(module: Record<string, unknown>): boolean | undefined {
	const value = module["prerender"];
	return typeof value === "boolean" ? value : undefined;
}

export function prerenderPolicy(options: {
	tree: RouteTree;
	/** Routes directory relative to the Vite root, leading slash included. */
	routesBase: string;
	/** Load a route module through the build's SSR module runner. */
	load: (id: string) => Promise<Record<string, unknown>>;
	/** What a route prerenders when nothing declares otherwise. */
	fallback: PrerenderDefault;
}): PrerenderPolicy {
	const { tree, routesBase, load, fallback } = options;
	// most specific first, matching how the pipeline resolves a path
	const chains = pageDataChains(tree).toSorted((a, b) => comparePatterns(a.pattern, b.pattern));
	const flags = new Map<string, Promise<boolean | undefined>>();

	/** A route file's `prerender` export, loaded once per build. */
	const flagOf = (file: string): Promise<boolean | undefined> => {
		let flag = flags.get(file);
		if (flag === undefined) {
			// a synthetic endpoint (the OpenAPI route) has no file to read a flag
			// from, and a route that cannot be loaded is the build's problem to
			// report, not this policy's
			flag = load(`${routesBase}/${file}`).then(declaredFlag, () => undefined);
			flags.set(file, flag);
		}
		return flag;
	};

	return {
		async page(path) {
			const normalized = normalizeRoutePath(path);
			const match = chains.find((entry) => matchRoutePattern(entry.pattern, normalized) !== null);
			// a path no page serves is the caller's to explain — the prerenderer
			// reports it as a route that rendered nothing
			const files = match?.files ?? [];
			// the nearest declaration wins, so a layout can turn a section on and
			// a single page under it can still opt out
			for (const file of files.toReversed()) {
				const flag = await flagOf(file);
				if (flag !== undefined) return flag;
			}
			return fallback === "auto" ? files.length === 0 : fallback;
		},
		async endpoint(route) {
			const flag = await flagOf(route.file);
			if (flag !== undefined) return flag;
			return fallback === "auto" ? false : fallback;
		},
	};
}
