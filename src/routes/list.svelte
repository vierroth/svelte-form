<script lang="ts">
	import Item from "./item.svelte";

	let {
		items = $bindable(),
	}: {
		items: any[];
	} = $props();
</script>

<div>
	<button
		onclick={(event: Event) => {
			event.preventDefault();
			items = [...items, { title: "" }];
		}}
		style="display: block">Add Item</button
	>
	<ul>
		{#each items as item, i}
			<Item bind:item={items[i]} />
		{/each}
	</ul>
</div>
