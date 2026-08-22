/**
 * The Node server kit builds for this adapter, as source.
 *
 * It is a template rather than a module of its own because it is built *into*
 * the app's server bundle — it imports `$implement/handler`, which only exists
 * inside that build — and because the two facts it needs from the build
 * (which path prefixes are hashed, and which pages prerendered) are known only
 * once the build has run.
 */

export type EntrySettings = {
	/** Path prefixes whose files are content-hashed, and so cacheable forever. */
	immutable: string[];
	/** The paths the build prerendered into documents. */
	pages: string[];
	/** Prefix on every environment variable the server reads. */
	envPrefix: string;
};

export function entrySource(settings: EntrySettings): string {
	return `import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { handler as app } from "$implement/handler";
import { compose, serveApp, servePrerendered, serveStatic } from "@implementjs/kit/node";

const IMMUTABLE = ${JSON.stringify(settings.immutable)};
const PAGES = ${JSON.stringify(settings.pages)};
const PREFIX = ${JSON.stringify(settings.envPrefix)};

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

const LOOPBACK = /^(127\.|::1|localhost$)/;

/**
 * Everything in front of the app: hashed assets first, then whatever else the
 * build put in the client directory, then the prerendered documents, and only
 * then the app itself.
 */
export const handler = compose([
	serveStatic(client, { immutable: IMMUTABLE }),
	servePrerendered(client, { pages: PAGES }),
	serveApp(app, {
		origin: ORIGIN,
		protocolHeader: PROTOCOL_HEADER,
		hostHeader: HOST_HEADER,
		address: { header: env("ADDRESS_HEADER", undefined), depth: number("XFF_DEPTH", 1) },
		onError: ({ error, event, status }) => {
			// the app's own handleError decides what the visitor is told; this is
			// the operator's copy, which must exist either way
			console.error(\`[implement] \${event.request.method} \${event.url.pathname} -> \${status}\`);
			console.error(error);
		},
	}),
]);

/** Starts the server. \`PORT\`, \`HOST\`, and \`SOCKET_PATH\` come from the environment. */
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

	const socket = options.socketPath ?? env("SOCKET_PATH", undefined);
	const port = options.port ?? number("PORT", 3000);
	const host = options.host ?? env("HOST", "0.0.0.0");

	// In production the request's Host and X-Forwarded-Proto headers are
	// attacker-controlled unless a proxy is trusted to set them or the origin is
	// pinned. Without one of these, event.url.origin resolves to whatever the
	// client sent — enabling host-header injection (poisoned password-reset links,
	// open redirects, OAuth callback hijacking). Fail fast rather than serve the
	// app on a forgeable origin. Loopback and unix sockets are not reachable by an
	// attacker, so local development is unaffected.
	const exposed = socket !== undefined || (host !== undefined && !LOOPBACK.test(host));
	if (exposed && process.env.NODE_ENV === "production") {
		if (ORIGIN === undefined && PROTOCOL_HEADER === undefined && HOST_HEADER === undefined) {
			console.error(
				"[implement] No trusted origin source is configured.\n\n" +
					"Set ORIGIN=https://your-domain.com to pin it, or set PROTOCOL_HEADER and\n" +
					"HOST_HEADER to the headers a trusted reverse proxy sets (or HOST_HEADER alone\n" +
					"when only the host is forwarded). Without one of these, event.url.origin is\n" +
					"attacker-controlled in production, enabling host-header injection.\n\n" +
					"See packages/kit/SECURITY_AUDIT.md (M-1).",
			);
			process.exit(1);
		}
	}

	const listening = () => {
		console.log(\`listening on \${socket === undefined ? \`http://\${host}:\${port}\` : socket}\`);
	};
	if (socket === undefined) server.listen(port, host, listening);
	else server.listen(socket, listening);

	// a container stops by signal, and an in-flight request should still finish
	const shutdown = () => {
		server.close(() => process.exit(0));
	};
	process.on("SIGINT", shutdown);
	process.on("SIGTERM", shutdown);

	return server;
}
`;
}
