import { join } from "node:path";
import type { Adapter, Builder } from "@implementjs/kit/adapter";

export type CloudflareAdapterOptions = {
	/** Where the deployable output goes, relative to the app. @default "dist" */
	out?: string;
	/**
	 * Paths the worker must never see, as
	 * [`_routes.json`](https://developers.cloudflare.com/pages/functions/routing/)
	 * exclusions. The hashed asset directory is always excluded; add anything
	 * else the static assets answer on their own.
	 */
	exclude?: string[];
};

/**
 * Builds the app into a Cloudflare worker with static assets beside it.
 *
 * ```ts
 * // vite.config.ts
 * import { kit } from "@implementjs/kit";
 * import adapter from "@implementjs/adapter-cloudflare";
 *
 * export default defineConfig({ plugins: [kit({ adapter: adapter() })] });
 * ```
 *
 * `vite build` writes `dist/`: the client bundle and everything prerendered at
 * the root, a `_worker.js` beside them, and a `_routes.json` keeping the worker
 * out of requests the assets already answer. That is the layout Cloudflare
 * Pages deploys as-is, and the one a Workers project points at:
 *
 * ```jsonc
 * // wrangler.jsonc
 * {
 * 	"main": "dist/_worker.js",
 * 	"compatibility_flags": ["nodejs_compat"],
 * 	"assets": { "directory": "dist", "binding": "ASSETS" }
 * }
 * ```
 *
 * The worker's `env` and `ctx` reach the app as `event.platform`, which is how
 * a route gets at a KV namespace, a D1 database, or a queue. Declare what the
 * project binds in `src/app.d.ts`:
 *
 * ```ts
 * declare global {
 * 	namespace App {
 * 		interface Platform {
 * 			env: { DB: D1Database };
 * 			context: ExecutionContext;
 * 			caches: CacheStorage;
 * 		}
 * 	}
 * }
 * ```
 *
 * The worker is bundled for `workerd`, so an app that reaches for `node:*`
 * needs the `nodejs_compat` flag — and a dependency that cannot run on workers
 * at all will fail this build rather than the deploy.
 */
export default function adapter(options: CloudflareAdapterOptions = {}): Adapter {
	const out = options.out ?? "dist";

	return {
		name: "@implementjs/adapter-cloudflare",
		build: {
			// a worker is one uploaded module, and workerd is not node
			bundle: true,
			target: "webworker",
			conditions: ["workerd", "worker", "browser"],
			entry: ENTRY,
		},
		adapt(builder) {
			const target = join(builder.root, out);
			builder.rimraf(target);
			builder.copy(builder.clientDir, target);
			builder.copy(join(builder.serverDir!, builder.serverEntry), join(target, "_worker.js"));

			builder.writeFile(
				join(target, "_routes.json"),
				`${JSON.stringify(routes(builder, options.exclude ?? []), null, "\t")}\n`,
			);
			builder.log.info(`wrote ${out} — deploy it with \`wrangler deploy\``);
		},
	};
}

/**
 * Which paths the worker runs for. Everything, minus the hashed assets and the
 * worker's own files: a request the static assets can answer should not pay for
 * a worker invocation, and `_routes.json` is the only way to say so.
 */
function routes(builder: Builder, exclude: string[]): unknown {
	const assets = `${builder.base}${builder.assetsDir}`.replace("//", "/");
	return {
		version: 1,
		include: ["/*"],
		exclude: [...new Set([`${assets}/*`, "/_worker.js", ...exclude])],
	};
}

/**
 * The worker. Static assets answer first through the binding both Pages and
 * Workers provide — a prerendered page is a file, and serving it from the
 * assets is both cheaper and the same answer the app would give.
 */
const ENTRY = `import { handler } from "$implement/handler";
import { setDynamicEnv } from "@implementjs/kit/env";

export default {
	async fetch(request, env, context) {
		// a worker has no \`process.env\`: its vars and secrets arrive with the
		// request, so this is where \`env.dynamic.server.ts\` gets pointed at them.
		// One assignment, and kit re-validates only when the object changes
		setDynamicEnv(env);
		if (env.ASSETS !== undefined) {
			const response = await env.ASSETS.fetch(request);
			if (response.status !== 404) return response;
		}
		return await handler(request, {
			platform: { env, context, caches },
			getClientAddress: () => request.headers.get("cf-connecting-ip") ?? "",
			onError: ({ error, event, status }) => {
				console.error(\`[implement] \${event.request.method} \${event.url.pathname} -> \${status}\`);
				console.error(error);
			},
		});
	},
};
`;
