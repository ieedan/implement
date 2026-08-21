/**
 * The benchmark harness. Identical in all three apps: the driver in
 * `@comparison/bench` calls `window.__bench.run(name)` and times whatever the
 * framework does in response, so the only thing that differs between runs is
 * the framework itself.
 *
 * Timing a DOM update fairly across frameworks is the fiddly part. One writes
 * the DOM synchronously, one flushes on a microtask, and React commits from
 * its own `MessageChannel` scheduler and will slice a large render across
 * several tasks. So a run is: apply the change, hop through the task queue
 * until the document stops changing, then wait out the frame that paints it.
 * Without the settling loop React sometimes commits after the timer stopped,
 * which shows up as a scattering of impossibly fast samples.
 */

export type BenchOps = Record<string, () => void>;

/**
 * What the DOM looks like at the end of a measured window. The driver asserts
 * against it, which is what rules out a framework "winning" by deferring work
 * past the point where the timer stopped.
 */
export type Probe = {
	rows: number;
	selected: number;
	title0: string;
	title1: string;
	title998: string;
};

export type BenchResult = Probe & { ms: number; settleHops: number };

export type BenchApi = {
	names: string[];
	/** Runs one operation and resolves once the browser has painted the result. */
	run(name: string): Promise<BenchResult>;
};

declare global {
	interface Window {
		__bench: BenchApi;
	}
}

/**
 * Resolves on the next macrotask, at the same priority React's scheduler uses.
 * The microtask tick first is what keeps the hop honest: React decides its
 * lanes in a microtask and only then posts its own message, so posting ours
 * straight away would jump the queue and let the timer stop before React had
 * rendered anything.
 */
async function nextTask(): Promise<void> {
	await Promise.resolve();
	await new Promise<void>((resolve) => {
		const channel = new MessageChannel();
		channel.port1.addEventListener("message", () => resolve(), { once: true });
		channel.port1.start();
		channel.port2.postMessage(null);
	});
}

/**
 * Resolves after the frame that paints the mutation. `requestAnimationFrame`
 * fires before paint, so the timeout inside it is what lands after it.
 */
function afterPaint(): Promise<void> {
	return new Promise((resolve) => {
		requestAnimationFrame(() => {
			setTimeout(resolve, 0);
		});
	});
}

/**
 * Cheap fingerprint of the list. Every operation in the benchmark moves at
 * least one part of it: the row count, the first, second, 999th or last row's
 * text, or which row carries `.selected`.
 */
function text(node: Element | null | undefined): string {
	return node?.textContent ?? "";
}

function signature(): string {
	const container = document.querySelector(".rows");
	const children = container?.children;
	return [
		container?.childElementCount ?? 0,
		text(children?.[0]),
		text(children?.[1]),
		text(children?.[998]),
		text(container?.lastElementChild),
		text(document.querySelector(".row.selected")),
	].join("|");
}

function probe(): Probe {
	const rows = document.querySelectorAll(".row");
	const titleAt = (index: number) => rows[index]?.querySelector(".title")?.textContent ?? "";
	return {
		rows: rows.length,
		selected: document.querySelectorAll(".row.selected").length,
		title0: titleAt(0),
		title1: titleAt(1),
		title998: titleAt(998),
	};
}

export function installBench(ops: BenchOps): BenchApi {
	const api: BenchApi = {
		names: Object.keys(ops),
		async run(name) {
			const op = ops[name];
			if (op === undefined) throw new Error(`No such benchmark operation: ${name}`);

			// Captured before the change so the settle loop needs the same number
			// of hops in all three apps: one to observe the new DOM, one to
			// confirm nothing else moved.
			let previous = signature();

			const start = performance.now();
			op();

			let settleHops = 0;
			// 64 is far above what any of the three needs; it exists so a bug
			// cannot turn into an infinite loop.
			while (settleHops < 64) {
				await nextTask();
				settleHops++;
				const current = signature();
				// Two hops minimum: one for the change to land, one to confirm
				// nothing else is still coming.
				if (settleHops >= 2 && current === previous) break;
				previous = current;
			}

			await afterPaint();
			const ms = performance.now() - start;
			return { ms, settleHops, ...probe() };
		},
	};
	window.__bench = api;
	return api;
}
