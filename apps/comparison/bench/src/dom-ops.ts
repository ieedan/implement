/**
 * A diagnostic pass, separate from the timing run: it patches the DOM mutation
 * methods before the app boots and counts what each framework actually does to
 * the document per operation. Patched methods make the page slower, so what
 * comes out of here is counts only — the timings come from `bench.ts`.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { APPS, RESULTS_DIR, type AppId } from "./apps.ts";
import { chromiumPath } from "./chromium.ts";
import { serve } from "./server.ts";
import { STEPS } from "./steps.ts";

export type DomCounts = {
	/** Nodes brought into existence, including every node a `cloneNode(true)` produces. */
	created: number;
	/** Insertions and moves — `appendChild`, `insertBefore`, `before`, `after`, and friends. */
	inserted: number;
	/** `removeChild` and `remove`. */
	removed: number;
	/** `setAttribute`, `removeAttribute`, `className`, and `classList` mutations. */
	attrWrites: number;
	/** `textContent`, `nodeValue`, and `CharacterData#data` assignments. */
	textWrites: number;
};

export type DomResult = { id: AppId; steps: Record<string, DomCounts> };

export type DomReport = DomResult[];

/**
 * Runs before any app code. The three frameworks reach the DOM by very
 * different routes — one builds nodes call by call, another clones a
 * `<template>` — so the counters are grouped by what happened to the document
 * rather than by which method was used to do it.
 */
/* oxlint-disable unicorn/consistent-function-scoping -- This whole function is stringified and evaluated in the page, so its helpers have to live inside it. */
const COUNTER_SCRIPT = () => {
	const counts: DomCounts = {
		created: 0,
		inserted: 0,
		removed: 0,
		attrWrites: 0,
		textWrites: 0,
	};

	const bump = (field: keyof DomCounts, amount = 1) => {
		counts[field] += amount;
	};

	/** Number of nodes in a subtree, so a deep clone counts as what it produced. */
	const size = (node: Node): number => {
		let total = 1;
		node.childNodes.forEach((child) => {
			total += size(child);
		});
		return total;
	};

	const wrap = (proto: object, name: string, after: (result: unknown) => void) => {
		const original: unknown = Reflect.get(proto, name);
		if (typeof original !== "function") return;
		Reflect.set(proto, name, function patched(this: unknown, ...args: unknown[]): unknown {
			const result: unknown = Reflect.apply(original, this, args);
			after(result);
			return result;
		});
	};

	const counted = (field: keyof DomCounts) => () => bump(field);
	const countedTree = (result: unknown) => {
		if (result instanceof Node) bump("created", size(result));
	};

	for (const name of ["createElement", "createTextNode", "createComment"]) {
		wrap(Document.prototype, name, counted("created"));
	}
	wrap(Document.prototype, "importNode", countedTree);
	wrap(Node.prototype, "cloneNode", countedTree);

	for (const name of ["appendChild", "insertBefore", "replaceChild"]) {
		wrap(Node.prototype, name, counted("inserted"));
	}
	for (const name of ["append", "prepend", "before", "after", "replaceWith"]) {
		wrap(Element.prototype, name, counted("inserted"));
		wrap(CharacterData.prototype, name, counted("inserted"));
	}
	wrap(Node.prototype, "removeChild", counted("removed"));
	wrap(Element.prototype, "remove", counted("removed"));
	wrap(CharacterData.prototype, "remove", counted("removed"));
	for (const name of ["setAttribute", "removeAttribute"]) {
		wrap(Element.prototype, name, counted("attrWrites"));
	}
	for (const name of ["add", "remove", "toggle"]) {
		wrap(DOMTokenList.prototype, name, counted("attrWrites"));
	}

	const setters: [object, string, keyof DomCounts][] = [
		[Node.prototype, "textContent", "textWrites"],
		[Node.prototype, "nodeValue", "textWrites"],
		[CharacterData.prototype, "data", "textWrites"],
		[Element.prototype, "innerHTML", "textWrites"],
		[Element.prototype, "className", "attrWrites"],
	];
	for (const [proto, prop, field] of setters) {
		const descriptor = Object.getOwnPropertyDescriptor(proto, prop);
		// oxlint-disable-next-line typescript/unbound-method -- Re-bound below through `call`, which is the point of holding the original setter.
		const original = descriptor?.set;
		if (descriptor === undefined || original === undefined) continue;
		Object.defineProperty(proto, prop, {
			...descriptor,
			set(this: unknown, value: unknown) {
				bump(field);
				original.call(this, value);
			},
		});
	}

	/* oxlint-enable unicorn/consistent-function-scoping */
	Object.assign(window, {
		__domCounts: (): DomCounts => ({ ...counts }),
		__resetDomCounts: () => {
			counts.created = 0;
			counts.inserted = 0;
			counts.removed = 0;
			counts.attrWrites = 0;
			counts.textWrites = 0;
		},
	});
};

async function main() {
	const browser = await chromium.launch({
		executablePath: chromiumPath(),
		args: ["--no-sandbox"],
	});
	const report: DomReport = [];

	try {
		for (const app of APPS) {
			const server = await serve(resolve(app.dir, "dist"));
			try {
				const page = await browser.newPage();
				await page.addInitScript(COUNTER_SCRIPT);
				await page.goto(server.url, { waitUntil: "load" });
				await page.waitForFunction(() => window.__bench !== undefined);

				const steps: Record<string, DomCounts> = {};
				for (const step of STEPS) {
					await page.evaluate(() => window.__resetDomCounts());
					await page.evaluate((op) => window.__bench.run(op), step.op);
					steps[step.label] = await page.evaluate(() => window.__domCounts());
				}
				report.push({ id: app.id, steps });
				await page.close();
				console.log(`${app.label}: counted`);
			} finally {
				await server.close();
			}
		}
	} finally {
		await browser.close();
	}

	mkdirSync(RESULTS_DIR, { recursive: true });
	writeFileSync(resolve(RESULTS_DIR, "dom-ops.json"), `${JSON.stringify(report, null, 2)}\n`);
	console.log(`wrote ${resolve(RESULTS_DIR, "dom-ops.json")}`);
}

await main();
