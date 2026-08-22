/**
 * Takes a heap snapshot with 10k rows on screen and reports which constructors
 * account for the retained bytes, so the per-row cost is measurable rather
 * than inferred.
 */
import { resolve } from "node:path";
import { chromium } from "playwright";
import { chromiumPath } from "./chromium.ts";
import { serve } from "./server.ts";

const DIR = process.env.CENSUS_DIR ?? "";
const TOP = Number(process.env.CENSUS_TOP ?? 30);

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
	const snapshot: unknown = JSON.parse(chunks.join(""));
	if (typeof snapshot !== "object" || snapshot === null) throw new Error("no snapshot");

	const meta = Reflect.get(snapshot, "snapshot") as { meta: { node_fields: string[] } };
	const nodes = Reflect.get(snapshot, "nodes") as number[];
	const strings = Reflect.get(snapshot, "strings") as string[];
	const fields = meta.meta.node_fields;
	const width = fields.length;
	const nameIdx = fields.indexOf("name");
	const sizeIdx = fields.indexOf("self_size");
	const typeIdx = fields.indexOf("type");

	const totals = new Map<string, { count: number; bytes: number }>();
	let all = 0;
	for (let i = 0; i < nodes.length; i += width) {
		const name = strings[nodes[i + nameIdx]!] ?? "?";
		const size = nodes[i + sizeIdx]!;
		const type = nodes[i + typeIdx]!;
		all += size;
		// Type 3 is "string"; lump those together rather than one bucket per value.
		const bucket = type === 3 ? "(strings)" : name;
		const entry = totals.get(bucket) ?? { count: 0, bytes: 0 };
		entry.count += 1;
		entry.bytes += size;
		totals.set(bucket, entry);
	}

	console.log(`${DIR}\ntotal self size ${(all / 1e6).toFixed(1)} MB\n`);
	console.log(
		"constructor".padEnd(34) + "count".padStart(10) + "MB".padStart(9) + "B/row".padStart(9),
	);
	const ranked = [...totals].sort((a, b) => b[1].bytes - a[1].bytes).slice(0, TOP);
	for (const [name, { count, bytes }] of ranked) {
		console.log(
			name.slice(0, 33).padEnd(34) +
				count.toLocaleString().padStart(10) +
				(bytes / 1e6).toFixed(2).padStart(9) +
				(bytes / 10_000).toFixed(0).padStart(9),
		);
	}
} finally {
	await server.close();
	await browser.close();
}
