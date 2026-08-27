import { join, relative } from "node:path";
import type { Adapter } from "@implementjs/kit/adapter";
import { entrySource } from "./entry.ts";
import { type Attributes, type Hosting, webConfig } from "./web-config.ts";

export type { Attributes, Hosting };

export type IISAdapterOptions = {
	/** Where the deployable output goes, relative to the app. @default "dist" */
	out?: string;
	/**
	 * The origin the site is served from (`https://intranet.example.com`).
	 *
	 * IIS forwards the visitor's own `Host` header, so without this every
	 * absolute URL the app builds — a redirect, a canonical link, a password
	 * reset — is whatever the request claimed. It is written into `web.config`
	 * as `ORIGIN`, and the server refuses to start in production without it or
	 * an explicit `PROTOCOL_HEADER`/`HOST_HEADER` pair.
	 */
	origin?: string;
	/**
	 * Which IIS module runs the app.
	 *
	 * `"httpPlatform"` is Microsoft's own
	 * [HttpPlatformHandler](https://learn.microsoft.com/iis/extensions/httpplatformhandler/httpplatformhandler-configuration-reference):
	 * it starts the process on a port it picks and reverse-proxies to it over a
	 * socket. It is still supported, it does not care that the process is Node,
	 * and a streamed response reaches the visitor as it is written — so it is
	 * the default.
	 *
	 * `"iisnode"` is the long-standing one: it starts `node.exe`, hands it a
	 * named pipe, and manages the process alongside the app pool. It is a
	 * separate download, has not seen a release in years, and buffers responses
	 * through the pipe, which stalls SSE and anything else streamed. Pick it
	 * when it is what the server has.
	 *
	 * @default "httpPlatform"
	 */
	hosting?: Hosting;
	/**
	 * The Node executable IIS starts, if `node.exe` is not on the app pool's
	 * `PATH` or the site needs a particular version.
	 *
	 * @default "node.exe"
	 */
	nodeExe?: string;
	/**
	 * Environment variables the site runs with, written into `web.config` —
	 * `<appSettings>` under iisnode, `<environmentVariables>` under
	 * HttpPlatformHandler.
	 *
	 * A Windows server has no `.env` and no `docker run -e`, so this is where
	 * the app's configuration goes. Anything secret is in the deployed file
	 * either way: keep it out of source control, or set it on the app pool
	 * instead and leave this alone.
	 */
	env?: Record<string, string>;
	/**
	 * Prefix on the environment variables the built server reads, for sites
	 * where bare `PORT` or `HOST` mean something else already. Does not apply
	 * to the ones IIS itself sets.
	 *
	 * @default ""
	 */
	envPrefix?: string;
	/**
	 * Paths under this site that IIS answers itself — a virtual directory, an
	 * ASP.NET application mounted beside the app, a folder of legacy files.
	 * They are left alone instead of being handed to Node.
	 *
	 * ```ts
	 * adapter({ externalRoutes: ["reports", "legacy"] });
	 * ```
	 */
	externalRoutes?: string[];
	/**
	 * Add the rewrite rule that redirects `http://` to `https://`. Leave it off
	 * when something in front of IIS already does. @default false
	 */
	redirectToHttps?: boolean;
	/**
	 * A path answered with `ok` without the app running at all, for a load
	 * balancer or an IIS Application Initialization ping. `false` removes it.
	 *
	 * @default "/healthcheck"
	 */
	healthcheck?: string | false;
	/**
	 * The largest request body IIS lets through, in bytes. Its own default is
	 * 30 MB, and a request over it is rejected by IIS with a 404.13 the app
	 * never sees — which is a confusing way to learn that an upload is too big.
	 *
	 * @default 30_000_000
	 */
	maxRequestBodySize?: number;
	/**
	 * Bundle dependencies into the server output, so the deployed folder is
	 * self-contained and can be copied to the server as it is.
	 *
	 * Turn it off for an app with a dependency that cannot be bundled — a
	 * native module, anything that reads its own files at runtime — and deploy
	 * `node_modules` beside the output instead. @default true
	 */
	bundle?: boolean;
	/**
	 * Extra `<iisnode>` attributes, overriding this adapter's defaults.
	 *
	 * ```ts
	 * adapter({ iisnode: { loggingEnabled: true, nodeProcessCountPerApplication: 4 } });
	 * ```
	 */
	iisnode?: Attributes;
	/**
	 * Extra `<httpPlatform>` attributes, overriding this adapter's defaults.
	 *
	 * ```ts
	 * adapter({ hosting: "httpPlatform", httpPlatform: { requestTimeout: "00:20:00" } });
	 * ```
	 */
	httpPlatform?: Attributes;
};

/**
 * The server itself, at the root of the output: ESM, like everything else the
 * build writes, and what `node index.js` runs. HttpPlatformHandler starts it
 * as a process, so this is the file it is pointed at.
 */
const ENTRY = "index.js";

/**
 * What iisnode is pointed at instead.
 *
 * iisnode's `interceptor.js` loads the app with `require()`, and the output is
 * ESM under `"type": "module"` — so pointing it at {@link ENTRY} terminates the
 * site on start with `ERR_REQUIRE_ESM`, on the Node most Windows servers are
 * running. Node 22 does load ESM through `require()`, but only a graph with no
 * top-level await anywhere in it, so that is a version and a bundle away from
 * the same crash rather than a fix. iisnode predates ESM and has had no release
 * in years, so it will not learn `import()` either.
 *
 * The way through is the extension: `.cjs` is CommonJS whatever the enclosing
 * `package.json` says, so this file is one iisnode can require, and it reaches
 * the real entry through a dynamic `import()` — which CommonJS has always been
 * allowed to do. iisnode retries the named pipe until the process is listening,
 * so the import resolving a tick later is not a race.
 */
const IISNODE_ENTRY = "index.cjs";

/** The CommonJS shim above, as source. */
function iisnodeEntrySource(): string {
	return [
		"// iisnode loads this file with require(). The entry beside it is ESM,",
		"// which require() refuses on most versions of node — so this file is",
		"// CommonJS, and the import() is how it reaches the real one.",
		`import("./${ENTRY}").catch((error) => {`,
		"\tconsole.error(error);",
		"\t// a process that stays up with no server on the pipe is a site that",
		"\t// hangs; exiting is what asks iisnode to start it again",
		"\tprocess.exit(1);",
		"});",
		"",
	].join("\n");
}

/**
 * Builds the app for [IIS](https://learn.microsoft.com/iis/), the web server
 * on Windows Server.
 *
 * ```ts
 * // vite.config.ts
 * import { kit } from "@implementjs/kit";
 * import adapter from "@implementjs/adapter-iis";
 *
 * export default defineConfig({
 *   plugins: [kit({ adapter: adapter({ origin: "https://intranet.example.com" }) })],
 * });
 * ```
 *
 * `vite build` writes `dist/`: the app as a Node server, the client bundle
 * beside it, and the `web.config` that tells IIS to start the one and hand it
 * every request. Point a site at the directory and it runs — there is nothing
 * to configure in IIS Manager beyond that.
 *
 * IIS does not run JavaScript itself, so something has to start the process
 * and proxy to it. That is `hosting`: Microsoft's HttpPlatformHandler, which
 * is still supported and is the default, or iisnode, which most existing
 * IIS-and-Node servers already have. Either one has to be installed on the
 * server, along with
 * [URL Rewrite](https://www.iis.net/downloads/microsoft/url-rewrite) for
 * iisnode, which is how requests reach the app at all.
 *
 * Dependencies are bundled into the output by default, so the folder is
 * everything the site needs and `xcopy` or Web Deploy is the whole deployment.
 */
export default function adapter(options: IISAdapterOptions = {}): Adapter {
	const out = options.out ?? "dist";
	const hosting = options.hosting ?? "httpPlatform";
	const healthcheck = options.healthcheck ?? "/healthcheck";

	return {
		name: "@implementjs/adapter-iis",
		build: {
			// a Windows deployment is a folder copy, and node_modules is the part
			// of it that is slowest to copy and easiest to forget
			bundle: options.bundle ?? true,
			// the whole folder ships, so the bundle may keep its chunks — and it
			// must, because inlining every dynamic import would evaluate the lazy
			// ones at load, which `@implementjs/kit/og` cannot survive
			singleFile: false,
			// the entry is the server itself, so what kit builds is already the
			// thing IIS starts — no shim in between to keep in step. It needs the
			// finished build to know which paths are prerendered and which are
			// hashed, so it is written from it
			entry: (build) =>
				entrySource({
					immutable: [`${build.base}${build.assetsDir}/`.replace("//", "/")],
					pages: build.prerendered.pages,
					envPrefix: options.envPrefix ?? "",
					healthcheck: healthcheck === false ? null : healthcheck,
				}),
		},
		adapt(builder) {
			const target = join(builder.root, out);
			builder.rimraf(target);
			builder.copy(builder.clientDir, join(target, "client"));
			builder.copy(builder.serverDir!, join(target, "server"));

			// `type: module` regardless of what the app's own package.json says,
			// since the built server is ESM whether or not the app is — and IIS
			// starts node.exe with this directory as its working directory, so
			// this file is the one that answers the question
			builder.writeFile(
				join(target, "package.json"),
				`${JSON.stringify({ private: true, type: "module" }, null, "\t")}\n`,
			);
			builder.writeFile(
				join(target, ENTRY),
				['import { start } from "./server/index.js";', "", "start();", ""].join("\n"),
			);
			builder.writeFile(
				join(target, "handler.js"),
				['export { handler, start } from "./server/index.js";', ""].join("\n"),
			);
			// only iisnode needs the CommonJS way in, and a `.cjs` in the output of
			// a site HttpPlatformHandler starts is a file nothing loads
			if (hosting === "iisnode") {
				builder.writeFile(join(target, IISNODE_ENTRY), iisnodeEntrySource());
			}

			const env: Record<string, string> = {
				// what the built server checks before it will serve a forgeable
				// origin, and what the app's own code reads
				NODE_ENV: "production",
				// iisnode appends the visitor's address to X-Forwarded-For; nothing
				// in front of IIS is trusted, so the last hop is the one to read
				...(hosting === "iisnode" ? { ADDRESS_HEADER: "x-forwarded-for", XFF_DEPTH: "1" } : {}),
				...(options.origin === undefined ? {} : { ORIGIN: options.origin }),
				...options.env,
			};

			builder.writeFile(
				join(target, "web.config"),
				webConfig({
					hosting,
					entry: hosting === "iisnode" ? IISNODE_ENTRY : ENTRY,
					nodeExe: options.nodeExe ?? "node.exe",
					env,
					externalRoutes: options.externalRoutes ?? [],
					redirectToHttps: options.redirectToHttps ?? false,
					maxRequestBodySize: options.maxRequestBodySize ?? 30_000_000,
					iisnode: options.iisnode ?? {},
					httpPlatform: options.httpPlatform ?? {},
				}),
			);

			// the same three the built server checks for before it will start, so a
			// deploy that is missing them hears about it here rather than as a site
			// that comes up and immediately stops
			const pinned =
				env.ORIGIN !== undefined ||
				env.PROTOCOL_HEADER !== undefined ||
				env.HOST_HEADER !== undefined;
			if (!pinned) {
				builder.log.warn(
					"@implementjs/adapter-iis: no `origin` is configured, and IIS forwards the " +
						"visitor's own Host header — so every absolute URL the app builds is whatever " +
						'the request claimed. Pass origin: "https://your-site" to pin it. The server ' +
						"will refuse to start without it.",
				);
			}

			builder.log.info(
				`wrote ${relative(builder.root, target)} — point an IIS site at it, with ` +
					`${hosting === "iisnode" ? "iisnode and URL Rewrite" : "HttpPlatformHandler"} installed`,
			);
		},
	};
}
