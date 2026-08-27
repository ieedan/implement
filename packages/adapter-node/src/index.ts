import { join, relative } from "node:path";
import type { Adapter } from "@implementjs/kit/adapter";
import { entrySource } from "./entry.ts";

export type NodeAdapterOptions = {
	/** Where the deployable output goes, relative to the app. @default "dist" */
	out?: string;
	/**
	 * Prefix on the environment variables the built server reads, for
	 * environments where bare `PORT` or `HOST` mean something else already.
	 *
	 * ```ts
	 * adapter({ envPrefix: "MY_APP_" }); // MY_APP_PORT, MY_APP_HOST, …
	 * ```
	 *
	 * @default ""
	 */
	envPrefix?: string;
};

/**
 * Builds the app into a Node server.
 *
 * ```ts
 * // vite.config.ts
 * import { kit } from "@implementjs/kit";
 * import adapter from "@implementjs/adapter-node";
 *
 * export default defineConfig({ plugins: [kit({ adapter: adapter() })] });
 * ```
 *
 * `vite build` writes `dist/`, and `node dist` serves the app: hashed assets
 * with a year-long cache, the pages that prerendered as files, and everything
 * else — pages with server loads, `POST` endpoints, webhooks, uploads —
 * rendered per request through the app's `hooks.server.ts`.
 *
 * The server reads its configuration from the environment: `PORT` (3000),
 * `HOST` (`0.0.0.0`), `SOCKET_PATH`, `ORIGIN`, and behind a proxy
 * `PROTOCOL_HEADER`, `HOST_HEADER`, `ADDRESS_HEADER`, and `XFF_DEPTH`.
 *
 * `dist/handler.js` exports the same pipeline as a connect-style middleware,
 * for mounting the app inside an Express or Polka server you already have:
 *
 * ```js
 * import { attachSockets, handler } from "./dist/handler.js";
 * app.use(handler);
 * attachSockets(server); // when the app has `SOCKET` routes
 * ```
 *
 * WebSocket routes are served end to end: the generated server attaches an
 * `upgrade` listener of its own, and `attachSockets` is the seam for doing it
 * on a server you built yourself.
 *
 * Dependencies stay external, so the output is deployed alongside the
 * `node_modules` the app was built with.
 */
export default function adapter(options: NodeAdapterOptions = {}): Adapter {
	const out = options.out ?? "dist";

	return {
		name: "@implementjs/adapter-node",
		build: {
			// the entry is the server itself, so what kit builds is already the
			// thing that starts listening — no shim in between to keep in step.
			// It needs the finished build to know which paths are prerendered and
			// which are hashed, so it is written from it
			entry: (build) =>
				entrySource({
					immutable: [`${build.base}${build.assetsDir}/`.replace("//", "/")],
					pages: build.prerendered.pages,
					envPrefix: options.envPrefix ?? "",
				}),
		},
		adapt(builder) {
			const target = join(builder.root, out);
			builder.rimraf(target);
			builder.copy(builder.clientDir, join(target, "client"));
			builder.copy(builder.serverDir!, join(target, "server"));

			// `type: module` regardless of what the app's own package.json says,
			// since the built server is ESM whether or not the app is
			builder.writeFile(
				join(target, "package.json"),
				`${JSON.stringify({ private: true, type: "module" }, null, "\t")}\n`,
			);
			builder.writeFile(
				join(target, "index.js"),
				['import { start } from "./server/index.js";', "", "start();", ""].join("\n"),
			);
			builder.writeFile(
				join(target, "handler.js"),
				['export { attachSockets, handler, sockets, start } from "./server/index.js";', ""].join(
					"\n",
				),
			);

			builder.log.info(`wrote ${relative(builder.root, target)} — run it with \`node ${out}\``);
		},
	};
}
