<script lang="ts">
	import type { Issue } from "./data";

	let {
		issue,
		selected,
		onselect,
		ontoggle,
		onremove,
	}: {
		issue: Issue;
		selected: boolean;
		onselect: (id: number) => void;
		ontoggle: (id: number, done: boolean) => void;
		onremove: (id: number) => void;
	} = $props();

	const done = $derived(issue.status === "done");
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="row" class:done class:selected onclick={() => onselect(issue.id)}>
	<input
		type="checkbox"
		checked={done}
		aria-label="Toggle done"
		onclick={(event) => event.stopPropagation()}
		onchange={(event) => ontoggle(issue.id, event.currentTarget.checked)}
	/>
	<span class="title">{issue.title}</span>
	<span class="badge {issue.priority}">{issue.priority}</span>
	<span class="assignee">{issue.assignee}</span>
	<button
		class="remove"
		aria-label="Delete issue"
		onclick={(event) => {
			event.stopPropagation();
			onremove(issue.id);
		}}
	>
		×
	</button>
</div>
