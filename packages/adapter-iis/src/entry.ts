/**
 * The Node server kit builds for this adapter, as source.
 *
 * It is a template rather than a module of its own because it is built *into*
 * the app's server bundle — it imports `$implement/handler`, which only exists
 * inside that build — and because the two facts it needs from the build
 * (which path prefixes are hashed, and which pages prerendered) are known only
 * once the build has run.
 *
 * What separates it from the plain Node server is how it is told where to
 * listen. IIS starts the process itself and hands it a socket to answer on:
 * iisnode puts a **named pipe** in `PORT`, and HttpPlatformHandler puts a TCP
 * port in `HTTP_PLATFORM_PORT`. Neither is a number-or-nothing, so the entry
 * has to read both and pick.
 *
 * Being a template literal, it is source code inside a string: a backslash
 * meant for the generated file has to be written twice, or the template eats
 * it. `\\n` in a message, `\\\\` for one literal backslash. A single `\` is
 * for the template's own escapes — `` \` `` and `\${` — which land as a
 * backtick and a `${` in the output.
 */

export type EntrySettings = {
	/** Path prefixes whose files are content-hashed, and so cacheable forever. */
	immutable: string[];
	/** The paths the build prerendered into documents. */
	pages: string[];
	/** Prefix on every environment variable the server reads. */
	envPrefix: string;
	/** Path answered with `ok` without touching the app, or `null` for none. */
	healthcheck: string | null;
};

export function entrySource(settings: EntrySettings): string {
	return `import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { handler as app, hasSockets, upgrade } from "$implement/handler";
import {
	compose,
	serveApp,
	servePrerendered,
	serveSockets,
	serveStatic,
} from "@implementjs/kit/node";

const IMMUTABLE = ${JSON.stringify(settings.immutable)};
const PAGES = ${JSON.stringify(settings.pages)};
const PREFIX = ${JSON.stringify(settings.envPrefix)};
const HEALTHCHECK = ${JSON.stringify(settings.healthcheck)};

/** The client bundle sits beside this one in the adapter's output. */
const client = fileURLToPath(new URL("../client", import.meta.url));

const env = (name, fallback) => process.env[PREFIX + name] ?? fallback;
const number = (name, fallback) => {
	const value = env(name, undefined);
	return value === undefined ? fallback : Number(value);
};

const ORIGIN = env("ORIGIN", undefined);
const PROTOCOL_HEADER = env("PROTOCOL_HEADER", undefined);
const HOST_HEADER = env("HOST_HEADER", undefined);

/**
 * Answered before the app is reached at all, so it keeps saying \`ok\` while a
 * load is failing — IIS is asking whether the process is up, and a check that
 * goes through the app answers a different question.
 */
const healthcheck = (req, res, next) => {
	if (HEALTHCHECK === null || req.method !== "GET") return next();
	const path = (req.url ?? "/").split("?")[0];
	if (path !== HEALTHCHECK) return next();
	res.statusCode = 200;
	res.setHeader("content-type", "text/plain; charset=utf-8");
	res.setHeader("cache-control", "no-store");
	res.end("ok");
};

/**
 * Everything in front of the app: the health check, hashed assets, whatever
 * else the build put in the client directory, the prerendered documents, and
 * only then the app itself.
 *
 * IIS could serve the files instead, and faster, but only by knowing where the
 * build put each one and which of them are hashed — a second copy of the
 * routing, in XML, that goes stale the first time the build changes. Node
 * serving them keeps the deployed site's behaviour identical to the dev
 * server's and to every other adapter's.
 */
export const handler = compose([
	healthcheck,
	serveStatic(client, { immutable: IMMUTABLE }),
	servePrerendered(client, { pages: PAGES }),
	serveApp(app, {
		origin: ORIGIN,
		protocolHeader: PROTOCOL_HEADER,
		hostHeader: HOST_HEADER,
		address: { header: env("ADDRESS_HEADER", undefined), depth: number("XFF_DEPTH", 1) },
		onError: ({ error, event, status }) => {
			// the app's own handleError decides what the visitor is told; this is
			// the operator's copy, which under iisnode is stdout and so the
			// iisnode log, and under HttpPlatformHandler is stdoutLogFile
			console.error(\`[implement] \${event.request.method} \${event.url.pathname} -> \${status}\`);
			console.error(error);
		},
	}),
]);

/**
 * Where IIS wants the server to listen.
 *
 * HttpPlatformHandler picks a free TCP port and reverse-proxies to it, so the
 * process must bind loopback and nothing else. iisnode instead passes a named
 * pipe (\`\\\\.\\pipe\\…\`) in \`PORT\`, which is a path rather than a number and has
 * to be handed to \`listen\` as one. Neither is set when the built server is run
 * by hand, which is what the defaults are for.
 */
function address(options) {
	const host = options.host ?? env("HOST", "127.0.0.1");
	if (options.port !== undefined) return { port: options.port, host };

	const platform = process.env.HTTP_PLATFORM_PORT;
	if (platform !== undefined) return { port: Number(platform), host };

	const port = env("PORT", undefined);
	if (port === undefined) return { port: 3000, host };
	// a pipe name is not a number, and Number() would quietly make it NaN —
	// which listen() reads as "any free port", so the site would come up on a
	// socket IIS is not talking to and every request would time out
	if (!Number.isFinite(Number(port))) return { path: port };
	return { port: Number(port), host };
}

/**
 * The app's WebSocket routes as an \`upgrade\` listener, or \`null\` when the app
 * declares none.
 *
 * IIS does not forward an upgrade on its own: the site needs
 * \`webSocket enabled="false"\` in \`web.config\` — which the adapter writes when
 * the app has socket routes — so that the WebSocket module stops intercepting
 * the handshake and lets the handler in front proxy it through.
 */
export const sockets = hasSockets
	? serveSockets(upgrade, {
			origin: ORIGIN,
			protocolHeader: PROTOCOL_HEADER,
			hostHeader: HOST_HEADER,
			address: { header: env("ADDRESS_HEADER", undefined), depth: number("XFF_DEPTH", 1) },
			onError: ({ error, event, status }) => {
				console.error(\`[implement] socket \${event.url.pathname} -> \${status}\`);
				console.error(error);
			},
		})
	: null;

/** Attaches the app's socket routes to a \`node:http\` server's \`upgrade\` event. */
export function attachSockets(server) {
	if (sockets === null) return server;
	server.on("upgrade", (req, socket, head) => {
		sockets(req, socket, head).then(
			(handled) => {
				if (!handled) socket.destroy();
			},
			(error) => {
				console.error(error);
				socket.destroy();
			},
		);
	});
	return server;
}

/**
 * Starts the server. Under IIS nothing needs to be passed: the module in front
 * has already decided where it listens.
 */
export function start(options = {}) {
	const server = createServer((req, res) => {
		handler(req, res, (error) => {
			if (error !== undefined) {
				console.error(error);
				res.statusCode = 500;
				res.end("Internal Error");
				return;
			}
			res.statusCode = 404;
			res.end("Not Found");
		});
	});
	attachSockets(server);

	// IIS forwards the visitor's own Host header, so event.url.origin is
	// attacker-controlled unless something pins it — enabling host-header
	// injection (poisoned password-reset links, open redirects, OAuth callback
	// hijacking). Being on a loopback socket does not help: the header travelled
	// the whole way. Fail here rather than serve the app on a forgeable origin.
	if (process.env.NODE_ENV === "production") {
		if (ORIGIN === undefined && PROTOCOL_HEADER === undefined && HOST_HEADER === undefined) {
			console.error(
				"[implement] No trusted origin source is configured.\\n\\n" +
					"Pass \`origin\` to the adapter — adapter({ origin: \\"https://your-domain.com\\" }) —\\n" +
					"which writes ORIGIN into web.config, or set PROTOCOL_HEADER and HOST_HEADER to\\n" +
					"the headers IIS is configured to forward. Without one of these,\\n" +
					"event.url.origin is attacker-controlled in production, enabling host-header\\n" +
					"injection.\\n\\n" +
					"See packages/kit/SECURITY_AUDIT.md (M-1).",
			);
			process.exit(1);
		}
	}

	const target = address(options);
	const listening = () => {
		console.log(\`listening on \${target.path ?? \`http://\${target.host}:\${target.port}\`}\`);
	};
	if (target.path === undefined) server.listen(target.port, target.host, listening);
	else server.listen(target.path, listening);

	// IIS stops a worker by signalling it, and an in-flight request should still
	// finish — an app pool recycle happens on a schedule, under load
	const shutdown = () => {
		server.close(() => process.exit(0));
	};
	process.on("SIGINT", shutdown);
	process.on("SIGTERM", shutdown);

	return server;
}
`;
}
