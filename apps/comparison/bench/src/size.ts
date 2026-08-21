/**
 * Measures what each build actually puts on the wire: every asset the entry
 * html pulls in, raw and after the two compressions a static host would use.
 */
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { brotliCompressSync, constants, gzipSync } from "node:zlib";
import { APPS, RESULTS_DIR, type AppId } from "./apps.ts";

export type Sizes = { raw: number; gzip: number; brotli: number };

export type BuildSizes = {
	js: Sizes;
	css: Sizes;
	html: Sizes;
	total: Sizes;
	files: { name: string; sizes: Sizes }[];
};

export type AppSizes = { id: AppId; app: BuildSizes; baseline: BuildSizes };

export type SizeReport = AppSizes[];

function measure(bytes: Buffer): Sizes {
	return {
		raw: bytes.byteLength,
		gzip: gzipSync(bytes, { level: 9 }).byteLength,
		brotli: brotliCompressSync(bytes, {
			params: { [constants.BROTLI_PARAM_QUALITY]: 11 },
		}).byteLength,
	};
}

function add(a: Sizes, b: Sizes): Sizes {
	return { raw: a.raw + b.raw, gzip: a.gzip + b.gzip, brotli: a.brotli + b.brotli };
}

const ZERO: Sizes = { raw: 0, gzip: 0, brotli: 0 };

function walk(dir: string, prefix = ""): { name: string; path: string }[] {
	const out: { name: string; path: string }[] = [];
	for (const entry of readdirSync(dir)) {
		const path = join(dir, entry);
		if (statSync(path).isDirectory()) out.push(...walk(path, `${prefix}${entry}/`));
		else out.push({ name: `${prefix}${entry}`, path });
	}
	return out;
}

export function measureBuild(dir: string): BuildSizes {
	const files = walk(dir)
		.filter(({ name }) => [".js", ".css", ".html"].includes(extname(name)))
		.map(({ name, path }) => ({ name, sizes: measure(readFileSync(path)) }))
		.toSorted((a, b) => b.sizes.raw - a.sizes.raw);

	const bucket = (ext: string): Sizes =>
		files.filter((file) => extname(file.name) === ext).reduce((a, b) => add(a, b.sizes), ZERO);

	const js = bucket(".js");
	const css = bucket(".css");
	const html = bucket(".html");
	return { js, css, html, total: add(add(js, css), html), files };
}

function main() {
	const report: SizeReport = APPS.map((app) => ({
		id: app.id,
		app: measureBuild(resolve(app.dir, "dist")),
		baseline: measureBuild(resolve(app.dir, "dist-baseline")),
	}));

	mkdirSync(RESULTS_DIR, { recursive: true });
	writeFileSync(resolve(RESULTS_DIR, "sizes.json"), `${JSON.stringify(report, null, 2)}\n`);

	for (const app of APPS) {
		const sizes = report.find((entry) => entry.id === app.id);
		if (sizes === undefined) continue;
		console.log(
			`${app.label.padEnd(12)} app js ${String(sizes.app.js.raw).padStart(7)} raw` +
				` ${String(sizes.app.js.gzip).padStart(6)} gzip` +
				` ${String(sizes.app.js.brotli).padStart(6)} br   |   hello world js` +
				` ${String(sizes.baseline.js.raw).padStart(7)} raw` +
				` ${String(sizes.baseline.js.gzip).padStart(6)} gzip`,
		);
	}
}

main();
