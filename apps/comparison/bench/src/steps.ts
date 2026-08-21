/**
 * The benchmark sequence. Every app exposes the same operation names on
 * `window.__bench`; this is the order they run in, and the order matters
 * because each step leaves the app in the state the next one expects.
 *
 * `check` is what makes the timings trustworthy. Each step asserts against the
 * DOM as it was when the timer stopped, so a framework that deferred its work
 * past that point fails the run instead of posting a fast number.
 */
export type Probe = {
	rows: number;
	selected: number;
	title0: string;
	title1: string;
	title998: string;
};

export type Step = {
	label: string;
	op: string;
	/** Returns an error message, or null when the DOM is where it should be. */
	check: (after: Probe, before: Probe) => string | null;
};

function rows(expected: number) {
	return (after: Probe): string | null =>
		after.rows === expected ? null : `expected ${expected} rows, saw ${after.rows}`;
}

export const STEPS: Step[] = [
	{ label: "create 1k rows", op: "create1k", check: rows(1000) },
	{
		label: "update every 10th of 1k",
		op: "updateEvery10th",
		check: (after, before) =>
			after.title0 === `${before.title0} !!!`
				? null
				: `row 0 title did not update (${after.title0})`,
	},
	{
		label: "select one row of 1k",
		op: "selectRow",
		check: (after) => (after.selected === 1 ? null : `expected 1 selected, saw ${after.selected}`),
	},
	{
		label: "swap two rows of 1k",
		op: "swapRows",
		check: (after, before) =>
			after.title1 === before.title998 && after.title998 === before.title1
				? null
				: "rows 1 and 998 did not swap",
	},
	{
		label: "filter 1k by text",
		op: "search",
		check: (after) =>
			after.rows > 0 && after.rows < 1000 ? null : `filter left ${after.rows} rows`,
	},
	{ label: "clear the filter", op: "clearSearch", check: rows(1000) },
	{
		label: "sort 1k by title",
		op: "sortByTitle",
		check: (after, before) =>
			after.title0 !== before.title0 || after.title998 !== before.title998
				? null
				: "sorting moved nothing",
	},
	{ label: "sort 1k back by id", op: "sortById", check: rows(1000) },
	{ label: "append 1k to 1k", op: "append1k", check: rows(2000) },
	{ label: "clear 2k rows", op: "clear", check: rows(0) },
	{ label: "create 10k rows", op: "create10k", check: rows(10_000) },
	{
		label: "update every 10th of 10k",
		op: "updateEvery10th",
		check: (after, before) =>
			after.title0 === `${before.title0} !!!`
				? null
				: `row 0 title did not update (${after.title0})`,
	},
	{
		label: "select one row of 10k",
		op: "selectRow",
		check: (after) => (after.selected === 1 ? null : `expected 1 selected, saw ${after.selected}`),
	},
	{
		label: "swap two rows of 10k",
		op: "swapRows",
		check: (after, before) =>
			after.title1 === before.title998 && after.title998 === before.title1
				? null
				: "rows 1 and 998 did not swap",
	},
	{ label: "clear 10k rows", op: "clear", check: rows(0) },
];

/** The step after which heap usage is sampled. */
export const HEAP_AFTER = "create 10k rows";
