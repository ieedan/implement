/**
 * Drives the three built apps through the same sequence of state changes in
 * the same browser and records how long each one takes to paint the result.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium, type Browser, type Page } from "playwright";
import { APPS, RESULTS_DIR, type AppId } from "./apps.ts";
import { chromiumPath } from "./chromium.ts";
import { serve } from "./server.ts";
import { HEAP_AFTER, STEPS, type Probe } from "./steps.ts";

const REPS = Number(process.env.BENCH_REPS ?? 12);
const WARMUP = Number(process.env.BENCH_WARMUP ?? 2);

export type Samples = { median: number; mean: number; min: number; max: number; samples: number[] };

export type AppResult = {
	id: AppId;
	steps: Record<string, Samples>;
	/** Task-queue hops the harness needed before the DOM stopped changing. */
	settleHops: Record<string, Samples>;
	/** ms from navigation start to the app's `app-mounted` mark. */
	mounted: Samples;
	/** Bytes of JS heap in use with 10k rows on screen. */
	heap10k: Samples;
};

export type BenchReport = {
	reps: number;
	warmup: number;
	browser: string;
	apps: AppResult[];
};

function summarize(values: number[]): Samples {
	const sorted = values.toSorted((a, b) => a - b);
	const middle = sorted.length >> 1;
	const median =
		sorted.length % 2 === 0
			? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
			: (sorted[middle] ?? 0);
	return {
		median,
		mean: values.reduce((a, b) => a + b, 0) / values.length,
		min: sorted[0] ?? 0,
		max: sorted[sorted.length - 1] ?? 0,
		samples: values,
	};
}

async function heapBytes(page: Page): Promise<number> {
	return await page.evaluate(() => {
		// `gc()` exists because the browser is launched with `--expose-gc`, and
		// `performance.memory` is Chromium-only; neither is in the DOM types.
		const collect: unknown = Reflect.get(globalThis, "gc");
		if (typeof collect === "function") Reflect.apply(collect, globalThis, []);
		const memory: unknown = Reflect.get(performance, "memory");
		if (memory === null || typeof memory !== "object") return 0;
		const used: unknown = Reflect.get(memory, "usedJSHeapSize");
		return typeof used === "number" ? used : 0;
	});
}

const EMPTY_PROBE: Probe = { rows: 0, selected: 0, title0: "", title1: "", title998: "" };

async function runOnce(browser: Browser, url: string, label: string) {
	const page = await browser.newPage();
	const timings: Record<string, number> = {};
	const hops: Record<string, number> = {};
	let heap = 0;
	try {
		await page.goto(url, { waitUntil: "load" });
		await page.waitForFunction(() => window.__bench !== undefined);

		const mounted = await page.evaluate(
			() => performance.getEntriesByName("app-mounted")[0]?.startTime ?? 0,
		);

		let before = EMPTY_PROBE;
		for (const step of STEPS) {
			const result = await page.evaluate((op) => window.__bench.run(op), step.op);
			const problem = step.check(result, before);
			if (problem !== null) throw new Error(`${label} failed "${step.label}": ${problem}`);
			timings[step.label] = result.ms;
			hops[step.label] = result.settleHops;
			before = result;
			if (step.label === HEAP_AFTER) heap = await heapBytes(page);
		}
		return { timings, hops, mounted, heap };
	} finally {
		await page.close();
	}
}

async function measureApp(
	browser: Browser,
	dir: string,
	label: string,
): Promise<Omit<AppResult, "id">> {
	const server = await serve(resolve(dir, "dist"));
	try {
		const perStep: Record<string, number[]> = {};
		const perStepHops: Record<string, number[]> = {};
		const mounted: number[] = [];
		const heaps: number[] = [];

		for (let rep = 0; rep < REPS + WARMUP; rep++) {
			const run = await runOnce(browser, server.url, label);
			if (rep < WARMUP) continue;
			for (const step of STEPS) {
				(perStep[step.label] ??= []).push(run.timings[step.label] ?? 0);
				(perStepHops[step.label] ??= []).push(run.hops[step.label] ?? 0);
			}
			mounted.push(run.mounted);
			heaps.push(run.heap);
		}

		return {
			steps: Object.fromEntries(
				STEPS.map((step) => [step.label, summarize(perStep[step.label] ?? [])]),
			),
			settleHops: Object.fromEntries(
				STEPS.map((step) => [step.label, summarize(perStepHops[step.label] ?? [])]),
			),
			mounted: summarize(mounted),
			heap10k: summarize(heaps),
		};
	} finally {
		await server.close();
	}
}

async function main() {
	const browser = await chromium.launch({
		executablePath: chromiumPath(),
		args: ["--js-flags=--expose-gc", "--disable-extensions", "--no-sandbox"],
	});

	const apps: AppResult[] = [];
	try {
		for (const app of APPS) {
			apps.push({ id: app.id, ...(await measureApp(browser, app.dir, app.label)) });
			console.log(`${app.label}: done (${REPS} timed runs)`);
		}
	} finally {
		await browser.close();
	}

	const report: BenchReport = { reps: REPS, warmup: WARMUP, browser: browser.version(), apps };
	mkdirSync(RESULTS_DIR, { recursive: true });
	writeFileSync(resolve(RESULTS_DIR, "bench.json"), `${JSON.stringify(report, null, 2)}\n`);
	console.log(`wrote ${resolve(RESULTS_DIR, "bench.json")}`);
}

await main();
