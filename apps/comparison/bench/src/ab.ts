/**
 * Paired A/B: runs two builds of the same app rep-by-rep in one browser and
 * reports the per-rep ratio of B over A, so machine drift cancels out.
 */
import { resolve } from "node:path";
import { chromium, type Browser, type Page } from "playwright";
import { chromiumPath } from "./chromium.ts";
import { serve } from "./server.ts";
import { HEAP_AFTER, STEPS, type Probe } from "./steps.ts";

const REPS = Number(process.env.AB_REPS ?? 15);
const WARMUP = Number(process.env.AB_WARMUP ?? 3);
const A_DIR = process.env.AB_A ?? "";
const B_DIR = process.env.AB_B ?? "";

const EMPTY: Probe = { rows: 0, selected: 0, title0: "", title1: "", title998: "" };

async function heapBytes(page: Page): Promise<number> {
	return await page.evaluate(() => {
		const collect: unknown = Reflect.get(globalThis, "gc");
		if (typeof collect === "function") Reflect.apply(collect, globalThis, []);
		const memory: unknown = Reflect.get(performance, "memory");
		if (memory === null || typeof memory !== "object") return 0;
		const used: unknown = Reflect.get(memory, "usedJSHeapSize");
		return typeof used === "number" ? used : 0;
	});
}

async function runOnce(browser: Browser, url: string, label: string) {
	const page = await browser.newPage();
	const timings: Record<string, number> = {};
	let heap = 0;
	try {
		await page.goto(url, { waitUntil: "load" });
		await page.waitForFunction(() => window.__bench !== undefined);
		let before = EMPTY;
		for (const step of STEPS) {
			const result = await page.evaluate((op) => window.__bench.run(op), step.op);
			// A variant built to price one feature cannot satisfy probes for the
			// feature it dropped; skip them and read only the timings.
			const problem = process.env.AB_NOCHECK ? null : step.check(result, before);
			if (problem !== null) throw new Error(`${label} failed "${step.label}": ${problem}`);
			timings[step.label] = result.ms;
			before = result;
			if (step.label === HEAP_AFTER) heap = await heapBytes(page);
		}
		return { timings, heap };
	} finally {
		await page.close();
	}
}

function median(values: number[]): number {
	const sorted = values.toSorted((a, b) => a - b);
	const middle = sorted.length >> 1;
	return sorted.length % 2 === 0
		? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
		: (sorted[middle] ?? 0);
}

const browser = await chromium.launch({
	executablePath: chromiumPath(),
	args: ["--js-flags=--expose-gc", "--disable-extensions", "--no-sandbox"],
});
const a = await serve(resolve(A_DIR));
const b = await serve(resolve(B_DIR));
const ratios: Record<string, number[]> = {};
const rawA: Record<string, number[]> = {};
const rawB: Record<string, number[]> = {};
const heapA: number[] = [];
const heapB: number[] = [];
try {
	for (let rep = 0; rep < REPS + WARMUP; rep++) {
		// Alternate which side goes first so ordering cannot favour either.
		const aFirst = rep % 2 === 0;
		const first = aFirst ? await runOnce(browser, a.url, "A") : await runOnce(browser, b.url, "B");
		const second = aFirst ? await runOnce(browser, b.url, "B") : await runOnce(browser, a.url, "A");
		const runA = aFirst ? first : second;
		const runB = aFirst ? second : first;
		if (rep < WARMUP) continue;
		for (const step of STEPS) {
			const ta = runA.timings[step.label] ?? 0;
			const tb = runB.timings[step.label] ?? 0;
			(rawA[step.label] ??= []).push(ta);
			(rawB[step.label] ??= []).push(tb);
			if (ta > 0) (ratios[step.label] ??= []).push(tb / ta);
		}
		heapA.push(runA.heap);
		heapB.push(runB.heap);
	}
} finally {
	await a.close();
	await b.close();
	await browser.close();
}

console.log(`\n${REPS} paired reps (A = ${A_DIR}, B = ${B_DIR})\n`);
console.log("step".padEnd(22) + "A ms".padStart(9) + "B ms".padStart(9) + "B/A".padStart(9));
for (const step of STEPS) {
	const ma = median(rawA[step.label] ?? []);
	const mb = median(rawB[step.label] ?? []);
	const r = median(ratios[step.label] ?? []);
	console.log(
		step.label.padEnd(22) +
			ma.toFixed(1).padStart(9) +
			mb.toFixed(1).padStart(9) +
			`${r.toFixed(3)}×`.padStart(9),
	);
}
console.log(
	`\nheap 10k: A ${(median(heapA) / 1e6).toFixed(1)} MB   B ${(median(heapB) / 1e6).toFixed(1)} MB`,
);
