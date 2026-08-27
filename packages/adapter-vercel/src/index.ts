import { join } from "node:path";
import { assertNoSockets, type Adapter, type Builder } from "@implementjs/kit/adapter";

export type VercelAdapterOptions = {
	/**
	 * The Node runtime the function runs on, as Vercel names them.
	 * @default "nodejs22.x"
	 */
	runtime?: string;
	/** Regions to deploy the function to, as Vercel names them (`["iad1"]`). */
	regions?: string[];
	/** Memory in MB for the function. */
	memory?: number;
	/** How long a request may run, in seconds. */
	maxDuration?: number;
	/** Where the Build Output goes, relative to the app. @default ".vercel/output" */
	out?: string;
};

/** The function's directory inside the Build Output, and the route that reaches it. */
const FUNCTION = "fn";

/**
 * Builds the app into [Vercel's Build Output
 * API](https://vercel.com/docs/build-output-api/v3): the client bundle and
 * everything prerendered go to the CDN as static files, and every request that
 * misses them runs the app in a Node function.
 *
 * ```ts
 * // vite.config.ts
 * import { kit } from "@implementjs/kit";
 * import adapter from "@implementjs/adapter-vercel";
 *
 * export default defineConfig({ plugins: [kit({ adapter: adapter() })] });
 * ```
 *
 * Vercel runs `vite build` and deploys `.vercel/output` — no project settings
 * beyond the build command, and nothing about the app in `vercel.json`.
 *
 * The function is bundled with its dependencies, since only the function's own
 * directory is uploaded.
 */
export default function adapter(options: VercelAdapterOptions = {}): Adapter {
	const out = options.out ?? ".vercel/output";

	return {
		name: "@implementjs/adapter-vercel",
		build: {
			// only the .func directory is uploaded, so nothing may be left for a
			// node_modules that will not be there
			bundle: true,
			// the whole .func directory ships, so the bundle may keep its chunks
			// — and it must, because inlining every dynamic import would evaluate
			// the lazy ones at load. `@implementjs/kit/og` imports satori that
			// way, and satori's harfbuzz build reads `__dirname` on evaluation,
			// which an ESM bundle does not have: the function would then throw
			// before it handled a single request
			singleFile: false,
			entry: ENTRY,
		},
		adapt(builder) {
			// a Node function answers one request and is frozen; there is no
			// upgrade path into it, so a socket route deployed here would 404 in
			// production rather than fail here, which is the worse of the two
			assertNoSockets(
				builder,
				"@implementjs/adapter-vercel",
				"a serverless function cannot hold a socket open",
			);
			const target = join(builder.root, out);
			builder.rimraf(target);

			// the CDN serves these; the function never sees a request for one
			builder.copy(builder.clientDir, join(target, "static"));

			const fn = join(target, "functions", `${FUNCTION}.func`);
			builder.copy(builder.serverDir!, fn);

			// only the .func directory is uploaded, so the app's own package.json
			// is not there to say the bundle is ESM — and the Node launcher reads
			// an unmarked .js as CommonJS and dies on the first `import`
			builder.writeFile(
				join(fn, "package.json"),
				`${JSON.stringify({ private: true, type: "module" }, null, "\t")}\n`,
			);

			builder.writeFile(
				join(fn, ".vc-config.json"),
				`${JSON.stringify(
					{
						runtime: options.runtime ?? "nodejs22.x",
						handler: builder.serverEntry,
						launcherType: "Nodejs",
						// kit reads the body off the request itself, and the helpers
						// would consume it first
						shouldAddHelpers: false,
						...(options.regions === undefined ? {} : { regions: options.regions }),
						...(options.memory === undefined ? {} : { memory: options.memory }),
						...(options.maxDuration === undefined ? {} : { maxDuration: options.maxDuration }),
					},
					null,
					"\t",
				)}\n`,
			);

			builder.writeFile(
				join(target, "config.json"),
				`${JSON.stringify(config(builder), null, "\t")}\n`,
			);
			builder.log.info(`wrote ${out} — deploy it with \`vercel deploy --prebuilt\``);
		},
	};
}

/**
 * The routing table. Hashed assets are named to be cached forever; after that
 * the filesystem answers whatever the build wrote — the prerendered pages
 * included — and everything left goes to the function.
 */
function config(builder: Builder): unknown {
	const assets = `${builder.base}${builder.assetsDir}`.replace("//", "/");
	return {
		version: 3,
		routes: [
			{
				src: `^${assets}/(.*)$`,
				headers: { "cache-control": "public, immutable, max-age=31536000" },
				continue: true,
			},
			{ handle: "filesystem" },
			{ src: "/.*", dest: `/${FUNCTION}` },
		],
	};
}

/**
 * The function, as Vercel's Node launcher wants it: a default export taking
 * `(req, res)`. Kit's own Node middleware does the translating, so the only
 * thing here is where the client's address comes from — Vercel terminates TLS
 * and forwards it, so the socket's address is the proxy's.
 */
const ENTRY = `import { handler as app } from "$implement/handler";
import { serveApp } from "@implementjs/kit/node";

// Vercel terminates TLS and overwrites Host and X-Forwarded-Proto before the
// function sees them, so trusting those headers here is safe on this platform.
const serve = serveApp(app, {
	protocolHeader: "x-forwarded-proto",
	hostHeader: "host",
	address: { header: "x-forwarded-for" },
	onError: ({ error, event, status }) => {
		console.error(\`[implement] \${event.request.method} \${event.url.pathname} -> \${status}\`);
		console.error(error);
	},
});

export default function (req, res) {
	serve(req, res, (error) => {
		if (error !== undefined) {
			console.error(error);
			res.statusCode = 500;
			res.end("Internal Error");
			return;
		}
		res.statusCode = 404;
		res.end("Not Found");
	});
}
`;
