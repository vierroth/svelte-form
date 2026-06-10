<script lang="ts">
	let {
		item = $bindable(),
	}: {
		item: any;
	} = $props();
</script>

<li>
	<input
		name="title"
		bind:value={item.title}
		type="text"
		style="display: block"
	/>
</li>
