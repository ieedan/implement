/**
 * The request handler a built kit app ships with — web-standard in and out, no
 * `node:*` anywhere in the graph, so the same module runs behind a Node
 * server, a Vercel function, and a Cloudflare worker.
 *
 * Everything platform-specific stays outside it: an adapter serves the static
 * assets and the prerendered pages however its host does, and hands whatever
 * misses to {@link createHandler}'s handler, which answers with a page render,
 * an endpoint response, or a route's `__data.json` — the app's
 * `hooks.server.ts` wrapped around all three, exactly as in dev.
 *
 * `.implement/entry-handler.ts` is generated to call this with the app's
 * pipeline and the manifest kit emits from the finished client build, so an
 * adapter's runtime only ever imports the built entry.
 */

import { renderDocument } from "@implementjs/vite/inject";
import { injectAssetTags, matchRouteAssets, type RouteAssetEntry } from "./assets.ts";
import type { ServerErrorReport } from "./errors.ts";
import type { RespondOptions, SocketUpgrade } from "./server.ts";

/** What the build knows and the deployed server needs: the shell and the per-route chunks. */
export type ServerManifest = {
	/** Vite's `base` — what asset hrefs are relative to. */
	base: string;
	/** The built `index.html`, which page responses render into. */
	template: string;
	/**
	 * Page patterns with the chunks each route's render needs, most specific
	 * first. `null` when the build wrote no manifest to name them with, which
	 * costs a round trip on first load and nothing else.
	 */
	assets: RouteAssetEntry[] | null;
};

/** The part of the app's pipeline a handler drives. */
export type RespondFn = (request: Request, options?: RespondOptions) => Promise<Response>;

export type HandleOptions = {
	/** The client's address, when the host can name it. */
	getClientAddress?: () => string;
	/** What the host hands the app as `event.platform`. */
	platform?: App.Platform;
	/** Called with every unexpected error the pipeline catches. */
	onError?: (report: ServerErrorReport) => void;
};

export type FetchHandler = (request: Request, options?: HandleOptions) => Promise<Response>;

/** The socket half of the same pipeline — see {@link createUpgradeHandler}. */
export type UpgradeHandler = (
	request: Request,
	options?: HandleOptions,
) => Promise<SocketUpgrade | null>;

/**
 * Binds the app's request pipeline to the built shell: pages render into
 * `manifest.template` with their route's preload hints injected, and
 * everything else — endpoints, `__data.json`, redirects, errors — comes back
 * from the pipeline untouched.
 */
/**
 * The same binding for WebSocket upgrades: an adapter hands a request in and
 * gets back either the app's refusal or the function that binds the route's
 * handlers to the socket its host produced. There is no document to render
 * here, which is why it is a second entry rather than a mode of the first.
 *
 * ```js
 * const result = await upgrade(request, { platform });
 * if (result === null) return; // no socket route here — not this host's to answer
 * if (!result.accepted) return result.response;
 * const session = result.accept(connection);
 * ```
 */
export function createUpgradeHandler(server: {
	upgrade: (request: Request, options?: RespondOptions) => Promise<SocketUpgrade | null>;
}): UpgradeHandler {
	return (request, options = {}) =>
		server.upgrade(request, {
			getClientAddress: options.getClientAddress,
			platform: options.platform,
			onError: options.onError,
		});
}

export function createHandler(
	server: { respond: RespondFn },
	manifest: ServerManifest,
): FetchHandler {
	const { base, template, assets } = manifest;

	return (request, options = {}) =>
		server.respond(request, {
			getClientAddress: options.getClientAddress,
			platform: options.platform,
			onError: options.onError,
			document: async ({ render, event, transform }) => {
				const hints = assets === null ? undefined : matchRouteAssets(assets, event.url.pathname);
				return await renderDocument(
					template,
					{ ...render, transform: transform ?? undefined },
					[],
					hints === undefined ? undefined : (html) => injectAssetTags(html, hints, base),
				);
			},
		});
}
