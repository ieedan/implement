/** Which string values the heap is full of, ranked by total bytes. */
import { resolve } from "node:path";
import { chromium } from "playwright";
import { chromiumPath } from "./chromium.ts";
import { serve } from "./server.ts";

const DIR = process.env.CENSUS_DIR ?? "";

const browser = await chromium.launch({
	executablePath: chromiumPath(),
	args: ["--js-flags=--expose-gc", "--disable-extensions", "--no-sandbox"],
});
const server = await serve(resolve(DIR));
try {
	const page = await browser.newPage();
	await page.goto(server.url, { waitUntil: "load" });
	await page.waitForFunction(() => window.__bench !== undefined);
	await page.evaluate(() => window.__bench.run("create10k"));
	await page.waitForTimeout(500);

	const cdp = await page.context().newCDPSession(page);
	await cdp.send("HeapProfiler.enable");
	await cdp.send("HeapProfiler.collectGarbage");
	const chunks: string[] = [];
	cdp.on("HeapProfiler.addHeapSnapshotChunk", (e) => chunks.push(e.chunk));
	await cdp.send("HeapProfiler.takeHeapSnapshot", { reportProgress: false });
	const snapshot = JSON.parse(chunks.join("")) as Record<string, unknown>;

	const meta = snapshot.snapshot as { meta: { node_fields: string[]; node_types: string[][] } };
	const nodes = snapshot.nodes as number[];
	const strings = snapshot.strings as string[];
	const fields = meta.meta.node_fields;
	const width = fields.length;
	const nameIdx = fields.indexOf("name");
	const sizeIdx = fields.indexOf("self_size");
	const typeIdx = fields.indexOf("type");

	const typeNames = meta.meta.node_types[0] ?? [];
	const totals = new Map<string, { count: number; bytes: number }>();
	for (let i = 0; i < nodes.length; i += width) {
		const kind = typeNames[nodes[i + typeIdx]!] ?? "?";
		const value = strings[nodes[i + nameIdx]!] ?? "";
		// Collapse per-row varying text so shapes group instead of scattering.
		const shape = `${kind}  ${value.replaceAll(/\d+/g, "#").slice(0, 34)}`;
		const entry = totals.get(shape) ?? { count: 0, bytes: 0 };
		entry.count += 1;
		entry.bytes += nodes[i + sizeIdx]!;
		totals.set(shape, entry);
	}

	console.log(`${DIR}\n`);
	console.log("string shape".padEnd(50) + "count".padStart(10) + "MB".padStart(8));
	for (const [shape, { count, bytes }] of [...totals]
		.sort((a, b) => b[1].bytes - a[1].bytes)
		.slice(0, 25)) {
		console.log(
			JSON.stringify(shape).slice(0, 49).padEnd(50) +
				count.toLocaleString().padStart(10) +
				(bytes / 1e6).toFixed(2).padStart(8),
		);
	}
} finally {
	await server.close();
	await browser.close();
}
