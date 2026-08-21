<script lang="ts">
	import BenchPanel from "./BenchPanel.svelte";
	import IssueRow from "./IssueRow.svelte";
	import { installBench, type BenchApi } from "./bench";
	import {
		makeIssues,
		newIssue,
		statsFor,
		visibleIssues,
		type Sort,
		type StatusFilter,
	} from "./data";

	const STATUSES: StatusFilter[] = ["all", "open", "done"];

	// `$state.raw` rather than `$state`: every update here replaces the whole
	// array, the same way the other two apps do, so there is nothing for a deep
	// proxy to observe and 10k rows never get wrapped.
	let issues = $state.raw(makeIssues(200));
	let query = $state("");
	let status = $state<StatusFilter>("all");
	let sort = $state<Sort>("id");
	let selected = $state<number | null>(null);
	let draft = $state("");
	let bench = $state<BenchApi | null>(null);

	const visible = $derived(visibleIssues(issues, query, status, sort));
	const stats = $derived(statsFor(issues));

	function setIssueStatus(id: number, done: boolean) {
		issues = issues.map((issue) =>
			issue.id === id ? { ...issue, status: done ? "done" : "open" } : issue,
		);
	}

	function remove(id: number) {
		issues = issues.filter((issue) => issue.id !== id);
	}

	function add(event: SubmitEvent) {
		event.preventDefault();
		const title = draft.trim();
		if (title === "") return;
		issues = [newIssue(title), ...issues];
		draft = "";
	}

	// Nothing reactive is read while installing, so this runs exactly once.
	$effect(() => {
		bench = installBench({
			create1k: () => (issues = makeIssues(1000)),
			create10k: () => (issues = makeIssues(10_000)),
			append1k: () => (issues = [...issues, ...makeIssues(1000)]),
			updateEvery10th: () =>
				(issues = issues.map((issue, i) =>
					i % 10 === 0 ? { ...issue, title: `${issue.title} !!!` } : issue,
				)),
			swapRows: () => {
				if (issues.length < 999) return;
				const next = issues.slice();
				const [a, b] = [next[1]!, next[998]!];
				next[1] = b;
				next[998] = a;
				issues = next;
			},
			selectRow: () => (selected = issues[500]?.id ?? null),
			search: () => (query = "cache"),
			clearSearch: () => (query = ""),
			sortByTitle: () => (sort = "title"),
			sortById: () => (sort = "id"),
			clear: () => (issues = []),
		});
	});
</script>

<div class="app">
	<div class="masthead">
		<h1>Issue triage <span class="framework">· svelte</span></h1>
		<div class="stats">
			<span>{stats.total} total</span>
			<span>open <b>{stats.open}</b></span>
			<span>{stats.percent}% done</span>
		</div>
	</div>

	<div class="panel toolbar">
		<input
			class="grow"
			bind:value={query}
			placeholder="Filter by title or assignee…"
			aria-label="Filter issues"
		/>
		<div class="segmented">
			{#each STATUSES as value (value)}
				<button class={status === value ? "on" : ""} onclick={() => (status = value)}>
					{value}
				</button>
			{/each}
		</div>
		<select bind:value={sort} aria-label="Sort by">
			<option value="id">Sort: newest</option>
			<option value="title">Sort: title</option>
			<option value="priority">Sort: priority</option>
		</select>
		<form onsubmit={add} class="segmented">
			<input bind:value={draft} placeholder="New issue…" aria-label="New issue title" />
			<button type="submit" class="primary">Add</button>
		</form>
	</div>

	<section class="panel rows">
		{#each visible as issue (issue.id)}
			<IssueRow
				{issue}
				selected={selected === issue.id}
				onselect={(id) => (selected = id)}
				ontoggle={setIssueStatus}
				onremove={remove}
			/>
		{/each}
		{#if visible.length === 0}
			<div class="empty">Nothing matches this filter.</div>
		{/if}
	</section>

	{#if bench !== null}
		<BenchPanel {bench} />
	{/if}
</div>
