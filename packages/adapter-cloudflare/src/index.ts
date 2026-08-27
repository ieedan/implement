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
 *
 * WebSocket routes are served through the runtime's own `WebSocketPair`: the
 * worker keeps one half and hands the other back in the `101`. A worker is
 * billed for CPU rather than for waiting, so an idle connection costs nothing
 * — but it lives only as long as the worker instance does, and nothing keeps
 * it across a deploy.
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
const ENTRY = `import { handler, hasSockets, upgrade } from "$implement/handler";
import { setDynamicEnv } from "@implementjs/kit/env";

const report = ({ error, event, status }) => {
	console.error(\`[implement] \${event.request.method} \${event.url.pathname} -> \${status}\`);
	console.error(error);
};

/**
 * A worker's WebSocket model is its own: the runtime hands out a pair of
 * sockets, the worker keeps one and returns the other to the client in a 101.
 * There is no framing to do and no \`bufferedAmount\` to read — which is why
 * \`peer.drained()\` resolves at once here, and flow control has to be a credit
 * scheme over the channel rather than a look at the socket.
 */
async function serveSocket(request, env, context) {
	const result = await upgrade(request, {
		platform: { env, context, caches },
		getClientAddress: () => request.headers.get("cf-connecting-ip") ?? "",
		onError: report,
	});
	// no socket route here — fall through and let the request be handled as the
	// ordinary GET it also is
	if (result === null) return null;
	if (!result.accepted) return result.response;

	const pair = new WebSocketPair();
	const client = pair[0];
	const server = pair[1];
	server.accept();

	const session = result.accept({
		send: (data) => server.send(data),
		close: (code, reason) => server.close(code, reason),
		// workerd queues for the socket and reports nothing about it
		get bufferedAmount() {
			return 0;
		},
		get readyState() {
			return server.readyState;
		},
	});

	server.addEventListener("message", (event) => {
		session.message(
			typeof event.data === "string" ? event.data : new Uint8Array(event.data),
		);
	});
	server.addEventListener("close", (event) => {
		session.closed({ code: event.code, reason: event.reason, clean: event.wasClean });
	});
	server.addEventListener("error", (event) => {
		session.failed(event.error ?? new Error("websocket error"));
	});
	session.open();

	const headers = new Headers(result.headers);
	return new Response(null, { status: 101, webSocket: client, headers });
}

export default {
	async fetch(request, env, context) {
		// a worker has no \`process.env\`: its vars and secrets arrive with the
		// request, so this is where \`env.dynamic.server.ts\` gets pointed at them.
		// One assignment, and kit re-validates only when the object changes
		setDynamicEnv(env);
		// before the assets, and before the app: an upgrade is a GET, and letting
		// the static binding answer it first would 404 a route that is there
		if (hasSockets && request.headers.get("upgrade")?.toLowerCase() === "websocket") {
			const response = await serveSocket(request, env, context);
			if (response !== null) return response;
		}
		if (env.ASSETS !== undefined) {
			const response = await env.ASSETS.fetch(request);
			if (response.status !== 404) return response;
		}
		return await handler(request, {
			platform: { env, context, caches },
			getClientAddress: () => request.headers.get("cf-connecting-ip") ?? "",
			onError: report,
		});
	},
};
`;
