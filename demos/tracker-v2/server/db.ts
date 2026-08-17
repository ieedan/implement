import { DatabaseSync } from "node:sqlite";
import path from "node:path";

const DB_PATH = path.join(import.meta.dirname, "tracker.db");

export const db = new DatabaseSync(DB_PATH);

db.exec(`
	PRAGMA journal_mode = WAL;
	PRAGMA foreign_keys = ON;

	CREATE TABLE IF NOT EXISTS users (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		color TEXT NOT NULL
	);

	CREATE TABLE IF NOT EXISTS labels (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		color TEXT NOT NULL
	);

	CREATE TABLE IF NOT EXISTS issues (
		id TEXT PRIMARY KEY,
		number INTEGER NOT NULL UNIQUE,
		title TEXT NOT NULL,
		description TEXT NOT NULL DEFAULT '',
		status TEXT NOT NULL DEFAULT 'todo',
		priority TEXT NOT NULL DEFAULT 'none',
		assignee_id TEXT REFERENCES users(id) ON DELETE SET NULL,
		created_at INTEGER NOT NULL,
		updated_at INTEGER NOT NULL
	);

	CREATE TABLE IF NOT EXISTS issue_labels (
		issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
		label_id TEXT NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
		PRIMARY KEY (issue_id, label_id)
	);

	CREATE TABLE IF NOT EXISTS comments (
		id TEXT PRIMARY KEY,
		issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
		author_id TEXT NOT NULL REFERENCES users(id),
		body TEXT NOT NULL,
		created_at INTEGER NOT NULL
	);
`);

function seed() {
	const count = db.prepare("SELECT COUNT(*) AS count FROM users").get() as { count: number };
	if (count.count > 0) return;

	const users = [
		{ id: crypto.randomUUID(), name: "Aidan Bleser", color: "#6e79d6" },
		{ id: crypto.randomUUID(), name: "Mara Chen", color: "#4cb782" },
		{ id: crypto.randomUUID(), name: "Theo Marchetti", color: "#d68f4c" },
		{ id: crypto.randomUUID(), name: "Ivy Okafor", color: "#c56d80" },
	];

	const labels = [
		{ id: crypto.randomUUID(), name: "Bug", color: "#eb5757" },
		{ id: crypto.randomUUID(), name: "Feature", color: "#bb87fc" },
		{ id: crypto.randomUUID(), name: "Improvement", color: "#4ea7fc" },
		{ id: crypto.randomUUID(), name: "Design", color: "#f2c94c" },
		{ id: crypto.randomUUID(), name: "Docs", color: "#4cb782" },
	];

	const insertUser = db.prepare("INSERT INTO users (id, name, color) VALUES (?, ?, ?)");
	for (const user of users) insertUser.run(user.id, user.name, user.color);

	const insertLabel = db.prepare("INSERT INTO labels (id, name, color) VALUES (?, ?, ?)");
	for (const label of labels) insertLabel.run(label.id, label.name, label.color);

	const issues: Array<{
		title: string;
		description: string;
		status: string;
		priority: string;
		assignee: number | null;
		labels: number[];
	}> = [
		{
			title: "Signal.set always notifies subscribers",
			description:
				"The change detection in `Signal.set` looks inverted. Setting the same value re-notifies every subscriber, which causes redundant renders downstream.",
			status: "in_progress",
			priority: "urgent",
			assignee: 0,
			labels: [0],
		},
		{
			title: "Add router to the UI framework",
			description:
				"Apps currently have to hand-roll hash routing. We should ship a first-class router with typed routes and a Link component.",
			status: "todo",
			priority: "high",
			assignee: 1,
			labels: [1],
		},
		{
			title: "Support arbitrary attributes on components",
			description:
				"There is no way to set `href`, `disabled`, `aria-*`, or `data-*` attributes today. Needs a general `.attr()` binding that works with signals.",
			status: "todo",
			priority: "urgent",
			assignee: 0,
			labels: [1],
		},
		{
			title: "Textarea and Select need value bindings",
			description:
				"Only Input has `.value()` / `.checked()`. Textarea and Select should get the same two-way binding treatment.",
			status: "backlog",
			priority: "high",
			assignee: 2,
			labels: [2],
		},
		{
			title: "SVG element support",
			description:
				"`document.createElement` only creates HTML elements, so inline icons have to go through `.html()`. Add `createElementNS` support for an Svg component tree.",
			status: "backlog",
			priority: "medium",
			assignee: null,
			labels: [1],
		},
		{
			title: "Dark mode design tokens",
			description: "Extract the zinc palette into semantic tokens so demos stay consistent.",
			status: "done",
			priority: "low",
			assignee: 3,
			labels: [3],
		},
		{
			title: "Write framework getting-started guide",
			description: "Cover signals, components, ForEach/If/Await, and the context API.",
			status: "backlog",
			priority: "low",
			assignee: null,
			labels: [4],
		},
		{
			title: "ForEach re-renders rows on deep-equal changes",
			description:
				"Keyed reuse only kicks in when the item value is deep-equal. Any field change rebuilds the whole row instead of patching bindings.",
			status: "todo",
			priority: "medium",
			assignee: 1,
			labels: [0, 2],
		},
		{
			title: "Lifecycle hooks for components",
			description:
				"No onMount/onUnmount means document-level listeners can never be cleaned up when a component goes away.",
			status: "backlog",
			priority: "medium",
			assignee: 2,
			labels: [1],
		},
		{
			title: "Derived signals should be chainable",
			description:
				"Derived's constructor is typed to accept Signals only, so you cannot derive from another Derived without a cast.",
			status: "done",
			priority: "medium",
			assignee: 0,
			labels: [2],
		},
		{
			title: "If helper needs an Else branch",
			description: "Ternary rendering currently requires two If nodes with inverted conditions.",
			status: "todo",
			priority: "low",
			assignee: null,
			labels: [2],
		},
		{
			title: "Kitchen demo styling pass",
			description:
				"The kitchen sink demo is unstyled. Give it the same treatment as the todo demo.",
			status: "canceled",
			priority: "none",
			assignee: 3,
			labels: [3],
		},
	];

	const now = Date.now();
	const insertIssue = db.prepare(
		"INSERT INTO issues (id, number, title, description, status, priority, assignee_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
	);
	const insertIssueLabel = db.prepare(
		"INSERT INTO issue_labels (issue_id, label_id) VALUES (?, ?)",
	);
	const insertComment = db.prepare(
		"INSERT INTO comments (id, issue_id, author_id, body, created_at) VALUES (?, ?, ?, ?, ?)",
	);

	issues.forEach((issue, i) => {
		const id = crypto.randomUUID();
		const createdAt = now - (issues.length - i) * 86_400_000;
		insertIssue.run(
			id,
			i + 1,
			issue.title,
			issue.description,
			issue.status,
			issue.priority,
			issue.assignee === null ? null : users[issue.assignee]!.id,
			createdAt,
			createdAt,
		);
		for (const labelIndex of issue.labels) {
			insertIssueLabel.run(id, labels[labelIndex]!.id);
		}

		if (i === 0) {
			insertComment.run(
				crypto.randomUUID(),
				id,
				users[1]!.id,
				"Repro: `signal.set(signal.get())` triggers every subscriber. The `equal()` call needs a `!`.",
				createdAt + 3_600_000,
			);
			insertComment.run(
				crypto.randomUUID(),
				id,
				users[0]!.id,
				'Confirmed — the comment above it even says "keep an eye on this one". Fixing.',
				createdAt + 7_200_000,
			);
		}
	});
}

seed();
