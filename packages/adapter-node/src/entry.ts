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

/**
 * Everything in front of the app: hashed assets first, then whatever else the
 * build put in the client directory, then the prerendered documents, and only
 * then the app itself.
 */
export const handler = compose([
	serveStatic(client, { immutable: IMMUTABLE }),
	servePrerendered(client, { pages: PAGES }),
	serveApp(app, {
		origin: env("ORIGIN", undefined),
		protocolHeader: env("PROTOCOL_HEADER", undefined),
		hostHeader: env("HOST_HEADER", undefined),
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
