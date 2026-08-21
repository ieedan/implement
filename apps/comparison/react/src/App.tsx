import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { installBench, type BenchApi } from "./bench";
import {
	makeIssues,
	newIssue,
	statsFor,
	visibleIssues,
	type Issue,
	type Sort,
	type StatusFilter,
} from "./data";

const STATUSES: StatusFilter[] = ["all", "open", "done"];

function isSort(value: string): value is Sort {
	return value === "id" || value === "title" || value === "priority";
}

export function App() {
	const [issues, setIssues] = useState(() => makeIssues(200));
	const [query, setQuery] = useState("");
	const [status, setStatus] = useState<StatusFilter>("all");
	const [sort, setSort] = useState<Sort>("id");
	const [selected, setSelected] = useState<number | null>(null);
	const [draft, setDraft] = useState("");
	const [bench, setBench] = useState<BenchApi | null>(null);

	// Recomputed on every render that changes one of these, and skipped
	// otherwise — the closest React equivalent of the other two apps' derived
	// values.
	const visible = useMemo(
		() => visibleIssues(issues, query, status, sort),
		[issues, query, status, sort],
	);
	const stats = useMemo(() => statsFor(issues), [issues]);

	// Stable identities, so `memo` on the row actually holds.
	const setIssueStatus = useCallback((id: number, done: boolean) => {
		setIssues((list) =>
			list.map((issue) => (issue.id === id ? { ...issue, status: done ? "done" : "open" } : issue)),
		);
	}, []);

	const remove = useCallback((id: number) => {
		setIssues((list) => list.filter((issue) => issue.id !== id));
	}, []);

	const select = useCallback((id: number) => setSelected(id), []);

	function add(event: React.FormEvent) {
		event.preventDefault();
		const title = draft.trim();
		if (title === "") return;
		setIssues((list) => [newIssue(title), ...list]);
		setDraft("");
	}

	// The benchmark ops are installed once, so they read the current list
	// through a ref rather than closing over a stale render's copy.
	const issuesRef = useRef(issues);
	useEffect(() => {
		issuesRef.current = issues;
	}, [issues]);

	useEffect(() => {
		setBench(
			installBench({
				create1k: () => setIssues(makeIssues(1000)),
				create10k: () => setIssues(makeIssues(10_000)),
				append1k: () => setIssues((list) => [...list, ...makeIssues(1000)]),
				updateEvery10th: () =>
					setIssues((list) =>
						list.map((issue, i) =>
							i % 10 === 0 ? { ...issue, title: `${issue.title} !!!` } : issue,
						),
					),
				swapRows: () =>
					setIssues((list) => {
						if (list.length < 999) return list;
						const next = list.slice();
						const [a, b] = [next[1]!, next[998]!];
						next[1] = b;
						next[998] = a;
						return next;
					}),
				selectRow: () => setSelected(issuesRef.current[500]?.id ?? null),
				search: () => setQuery("cache"),
				clearSearch: () => setQuery(""),
				sortByTitle: () => setSort("title"),
				sortById: () => setSort("id"),
				clear: () => setIssues([]),
			}),
		);
	}, []);

	return (
		<div className="app">
			<div className="masthead">
				<h1>
					Issue triage <span className="framework">· react</span>
				</h1>
				<div className="stats">
					<span>{stats.total} total</span>
					<span>
						open <b>{stats.open}</b>
					</span>
					<span>{stats.percent}% done</span>
				</div>
			</div>

			<div className="panel toolbar">
				<input
					className="grow"
					value={query}
					onChange={(event) => setQuery(event.target.value)}
					placeholder="Filter by title or assignee…"
					aria-label="Filter issues"
				/>
				<div className="segmented">
					{STATUSES.map((value) => (
						<button
							key={value}
							className={status === value ? "on" : ""}
							onClick={() => setStatus(value)}
						>
							{value}
						</button>
					))}
				</div>
				<select
					value={sort}
					aria-label="Sort by"
					onChange={(event) => {
						if (isSort(event.target.value)) setSort(event.target.value);
					}}
				>
					<option value="id">Sort: newest</option>
					<option value="title">Sort: title</option>
					<option value="priority">Sort: priority</option>
				</select>
				<form onSubmit={add} className="segmented">
					<input
						value={draft}
						onChange={(event) => setDraft(event.target.value)}
						placeholder="New issue…"
						aria-label="New issue title"
					/>
					<button type="submit" className="primary">
						Add
					</button>
				</form>
			</div>

			<section className="panel rows">
				{visible.map((issue) => (
					<IssueRow
						key={issue.id}
						issue={issue}
						selected={selected === issue.id}
						onSelect={select}
						onToggle={setIssueStatus}
						onRemove={remove}
					/>
				))}
				{visible.length === 0 && <div className="empty">Nothing matches this filter.</div>}
			</section>

			{bench !== null && <BenchPanel bench={bench} />}
		</div>
	);
}

type RowProps = {
	issue: Issue;
	selected: boolean;
	onSelect: (id: number) => void;
	onToggle: (id: number, done: boolean) => void;
	onRemove: (id: number) => void;
};

const IssueRow = memo(function IssueRow({
	issue,
	selected,
	onSelect,
	onToggle,
	onRemove,
}: RowProps) {
	const done = issue.status === "done";

	return (
		<div
			className={`row${done ? " done" : ""}${selected ? " selected" : ""}`}
			onClick={() => onSelect(issue.id)}
		>
			<input
				type="checkbox"
				checked={done}
				aria-label="Toggle done"
				onClick={(event) => event.stopPropagation()}
				onChange={(event) => onToggle(issue.id, event.target.checked)}
			/>
			<span className="title">{issue.title}</span>
			<span className={`badge ${issue.priority}`}>{issue.priority}</span>
			<span className="assignee">{issue.assignee}</span>
			<button
				className="remove"
				aria-label="Delete issue"
				onClick={(event) => {
					event.stopPropagation();
					onRemove(issue.id);
				}}
			>
				×
			</button>
		</div>
	);
});

function BenchPanel({ bench }: { bench: BenchApi }) {
	const [last, setLast] = useState("");

	async function run(name: string) {
		const result = await bench.run(name);
		setLast(`${name} — ${result.ms.toFixed(1)} ms, ${result.rows} rows`);
	}

	return (
		<section className="panel bench">
			<h2>Benchmark</h2>
			<div className="bench-buttons">
				{bench.names.map((name) => (
					<button key={name} onClick={() => void run(name)}>
						{name}
					</button>
				))}
			</div>
			<p className="bench-result">
				last: <b>{last}</b>
			</p>
		</section>
	);
}
