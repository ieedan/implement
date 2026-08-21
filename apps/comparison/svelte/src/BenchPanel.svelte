<script lang="ts">
	import type { BenchApi } from "./bench";

	let { bench }: { bench: BenchApi } = $props();

	let last = $state("");

	async function run(name: string) {
		const result = await bench.run(name);
		last = `${name} — ${result.ms.toFixed(1)} ms, ${result.rows} rows`;
	}
</script>

<section class="panel bench">
	<h2>Benchmark</h2>
	<div class="bench-buttons">
		{#each bench.names as name (name)}
			<button onclick={() => void run(name)}>{name}</button>
		{/each}
	</div>
	<p class="bench-result">last: <b>{last}</b></p>
</section>
