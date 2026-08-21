import {
	Button,
	derived,
	Div,
	ForEach,
	Form,
	H1,
	H2,
	If,
	Input,
	Option,
	P,
	Section,
	Select,
	signal,
	Span,
	type Mountable,
	type Readable,
	type Signal,
} from "@implementjs/core";
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

export function IssueApp(): Mountable {
	const issues = signal(makeIssues(200));
	const query = signal("");
	const status = signal<StatusFilter>("all");
	const sort = signal<Sort>("id");
	const selected = signal<number | null>(null);
	const draft = signal("");

	// Explicit dependencies, so this recomputes on exactly these four and
	// nothing else. Row identity survives the recompute because `ForEach` keys
	// by id, so a filter change moves rows instead of rebuilding them.
	const visible = derived([issues, query, status, sort], visibleIssues);
	const stats = derived([issues], statsFor);

	function setStatus(id: number, done: boolean) {
		issues.update((list) =>
			list.map((issue) => (issue.id === id ? { ...issue, status: done ? "done" : "open" } : issue)),
		);
	}

	function remove(id: number) {
		issues.update((list) => list.filter((issue) => issue.id !== id));
	}

	function add(event: SubmitEvent) {
		event.preventDefault();
		const title = draft.get().trim();
		if (title === "") return;
		issues.unshift(newIssue(title));
		draft.set("");
	}

	const bench = installBench({
		create1k: () => issues.set(makeIssues(1000)),
		create10k: () => issues.set(makeIssues(10_000)),
		append1k: () => issues.update((list) => [...list, ...makeIssues(1000)]),
		updateEvery10th: () =>
			issues.update((list) =>
				list.map((issue, i) => (i % 10 === 0 ? { ...issue, title: `${issue.title} !!!` } : issue)),
			),
		swapRows: () =>
			issues.update((list) => {
				if (list.length < 999) return list;
				const next = list.slice();
				const [a, b] = [next[1]!, next[998]!];
				next[1] = b;
				next[998] = a;
				return next;
			}),
		selectRow: () => selected.set(issues.get()[500]?.id ?? null),
		search: () => query.set("cache"),
		clearSearch: () => query.set(""),
		sortByTitle: () => sort.set("title"),
		sortById: () => sort.set("id"),
		clear: () => issues.set([]),
	});

	return Div(
		{ class: "app" },
		Div(
			{ class: "masthead" },
			H1("Issue triage ", Span({ class: "framework" }, "· implement")),
			Div(
				{ class: "stats" },
				Span(stats.bind((s) => `${s.total} total`)),
				Span(
					"open ",
					Span(
						{ style: { fontWeight: "600" } },
						stats.bind((s) => String(s.open)),
					),
				),
				Span(stats.bind((s) => `${s.percent}% done`)),
			),
		),
		Div(
			{ class: "panel toolbar" },
			Input({
				class: "grow",
				value: query,
				placeholder: "Filter by title or assignee…",
				"aria-label": "Filter issues",
			}),
			Div(
				{ class: "segmented" },
				...STATUSES.map((value) =>
					Button(
						{
							class: status.bind((current) => (current === value ? "on" : "")),
							onClick: () => status.set(value),
						},
						value,
					),
				),
			),
			Select(
				{ value: sort, "aria-label": "Sort by" },
				Option({ value: "id" }, "Sort: newest"),
				Option({ value: "title" }, "Sort: title"),
				Option({ value: "priority" }, "Sort: priority"),
			),
			Form(
				{ onSubmit: add, class: "segmented" },
				Input({ value: draft, placeholder: "New issue…", "aria-label": "New issue title" }),
				Button({ type: "submit", class: "primary" }, "Add"),
			),
		),
		Section(
			{ class: "panel rows" },
			ForEach(
				visible,
				(issue) => issue.id,
				(issue) => IssueRow(issue, selected, setStatus, remove),
			),
			If(visible.bind((list) => list.length === 0)).Then(
				Div({ class: "empty" }, "Nothing matches this filter."),
			),
		),
		BenchPanel(bench),
	);
}

function IssueRow(
	issue: Readable<Issue>,
	selected: Signal<number | null>,
	setStatus: (id: number, done: boolean) => void,
	remove: (id: number) => void,
): Mountable {
	const done = issue.bind((value) => value.status === "done");

	return Div(
		{
			// Both sources are per-row, so selecting a row touches two rows'
			// class attributes and nothing else in the list.
			class: derived(
				[issue, selected],
				(value, current) =>
					`row${value.status === "done" ? " done" : ""}${current === value.id ? " selected" : ""}`,
			),
			onClick: () => selected.set(issue.get().id),
		},
		Input({
			type: "checkbox",
			checked: done,
			"aria-label": "Toggle done",
			onClick: (event) => event.stopPropagation(),
			onChange: (event) => setStatus(issue.get().id, event.target.checked),
		}),
		Span({ class: "title" }, issue.bind("title")),
		Span({ class: issue.bind((value) => `badge ${value.priority}`) }, issue.bind("priority")),
		Span({ class: "assignee" }, issue.bind("assignee")),
		Button(
			{
				class: "remove",
				"aria-label": "Delete issue",
				onClick: (event) => {
					event.stopPropagation();
					remove(issue.get().id);
				},
			},
			"×",
		),
	);
}

function BenchPanel(bench: BenchApi): Mountable {
	const last = signal("");

	async function run(name: string) {
		const result = await bench.run(name);
		last.set(`${name} — ${result.ms.toFixed(1)} ms, ${result.rows} rows`);
	}

	return Section(
		{ class: "panel bench" },
		H2("Benchmark"),
		Div(
			{ class: "bench-buttons" },
			...bench.names.map((name) => Button({ onClick: () => void run(name) }, name)),
		),
		P({ class: "bench-result" }, "last: ", Span({ style: { fontWeight: "600" } }, last)),
	);
}
