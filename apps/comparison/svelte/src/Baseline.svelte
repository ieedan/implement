<script lang="ts">
	let count = $state(0);
</script>

<div class="app">
	<h1>Baseline</h1>
	<p>count: {count}</p>
	<button onclick={() => count++}>increment</button>
</div>
