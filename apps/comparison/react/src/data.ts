/**
 * The app's data model and its deterministic generator. Byte-for-byte
 * identical in all three apps: the benchmark compares frameworks, so every
 * app has to be filling its list with exactly the same rows in exactly the
 * same order.
 */

export type Status = "open" | "done";

export type Priority = "low" | "medium" | "high";

export type Issue = {
	id: number;
	title: string;
	assignee: string;
	priority: Priority;
	status: Status;
};

export type StatusFilter = "all" | "open" | "done";

export type Sort = "id" | "title" | "priority";

const VERBS = ["Fix", "Refactor", "Document", "Profile", "Ship", "Revert", "Cache", "Debounce"];

const ADJECTIVES = ["flaky", "stale", "orphaned", "nested", "eager", "keyed", "scoped", "inert"];

const NOUNS = [
	"reconciler",
	"hydration pass",
	"scroll restore",
	"route guard",
	"list diff",
	"focus trap",
	"tooltip anchor",
	"form binding",
];

const PEOPLE = ["ada", "grace", "linus", "barbara", "alan", "radia", "margaret", "donald"];

const PRIORITIES: Priority[] = ["low", "medium", "high"];

/** mulberry32 — small, fast, and identical across the three apps. */
function random(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = Math.imul(state ^ (state >>> 15), 1 | state);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

let nextId = 1;

function pick<T>(list: readonly T[], next: () => number): T {
	// `noUncheckedIndexedAccess` is on, and the modulo already guarantees a hit
	return list[Math.floor(next() * list.length) % list.length]!;
}

/** `count` issues with ids continuing from wherever the last call left off. */
export function makeIssues(count: number, seed = 1): Issue[] {
	const next = random(seed);
	const issues: Issue[] = [];
	for (let i = 0; i < count; i++) {
		issues.push({
			id: nextId++,
			title: `${pick(VERBS, next)} the ${pick(ADJECTIVES, next)} ${pick(NOUNS, next)}`,
			assignee: pick(PEOPLE, next),
			priority: pick(PRIORITIES, next),
			status: next() < 0.3 ? "done" : "open",
		});
	}
	return issues;
}

/** A blank issue for the "add" form. */
export function newIssue(title: string): Issue {
	return { id: nextId++, title, assignee: "unassigned", priority: "medium", status: "open" };
}

const RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

/**
 * Filter + sort, shared by all three apps so none of them wins by doing less
 * work per keystroke. Returns the input untouched when nothing is filtered
 * or sorted, which is what lets a keyed list skip work on unrelated updates.
 */
export function visibleIssues(
	issues: Issue[],
	query: string,
	status: StatusFilter,
	sort: Sort,
): Issue[] {
	const needle = query.trim().toLowerCase();
	let result = issues;
	if (needle !== "" || status !== "all") {
		result = issues.filter(
			(issue) =>
				(status === "all" || issue.status === status) &&
				(needle === "" ||
					issue.title.toLowerCase().includes(needle) ||
					issue.assignee.includes(needle)),
		);
	}
	if (sort === "id") return result === issues ? result.slice() : result;
	const sorted = result.slice();
	sorted.sort(
		sort === "title"
			? (a, b) => a.title.localeCompare(b.title)
			: (a, b) => RANK[a.priority] - RANK[b.priority] || a.id - b.id,
	);
	return sorted;
}

export type Stats = { total: number; open: number; done: number; percent: number };

export function statsFor(issues: readonly Issue[]): Stats {
	let done = 0;
	for (const issue of issues) if (issue.status === "done") done++;
	const total = issues.length;
	return {
		total,
		open: total - done,
		done,
		percent: total === 0 ? 0 : Math.round((done / total) * 100),
	};
}
