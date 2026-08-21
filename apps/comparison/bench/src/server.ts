/**
 * A static server for the built apps. Deliberately minimal — no compression,
 * no caching — so the only thing the browser is waiting on during a run is the
 * app itself.
 */
import { createServer, type Server } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const TYPES: Record<string, string> = {
	".html": "text/html; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".svg": "image/svg+xml",
	".json": "application/json",
};

export type StaticServer = { url: string; close: () => Promise<void> };

export async function serve(dir: string): Promise<StaticServer> {
	const server: Server = createServer((request, response) => {
		const path = (request.url ?? "/").split("?")[0] ?? "/";
		const file = join(dir, normalize(path === "/" ? "/index.html" : path));
		if (!file.startsWith(dir)) {
			response.writeHead(403).end();
			return;
		}
		readFile(file).then(
			(body) => {
				response.writeHead(200, {
					"content-type": TYPES[extname(file)] ?? "application/octet-stream",
					"cache-control": "no-store",
				});
				response.end(body);
			},
			() => response.writeHead(404).end(),
		);
	});

	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	const address = server.address();
	if (address === null || typeof address === "string") throw new Error("server has no port");

	return {
		url: `http://127.0.0.1:${address.port}/`,
		close: () =>
			new Promise<void>((resolve, reject) => {
				server.close((error) => (error ? reject(error) : resolve()));
			}),
	};
}
