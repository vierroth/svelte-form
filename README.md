# Svelte Schema Form

A lightweight, reactive form helper for **Svelte 5** and **Zod Mini**.

### Features

- Schema-based reactive validation
- Typed form data
- Field errors and interaction state
- Nested objects and dynamic arrays
- Dirty and submission state
- Reset with optional new defaults
- Async submission callbacks

### Usage

```svelte
<script lang="ts">
	import { createForm } from "$lib";
	import { z } from "zod/mini";

	const form = createForm({
		schema: z.object({
			name: z.string().check(z.minLength(1, "Name is required")),
			accepted: z.literal(true),
		}),
		initialValues: {
			name: "",
			accepted: true,
		},
		async onSubmit(data) {
			console.log(data);
		},
	});
</script>

<form {@attach form.attachment}>
	<input bind:value={form.data.name} {@attach form.metadata.name.attachment} />

	{#each form.metadata.name.errors ?? [] as error}
		<p>{error}</p>
	{/each}

	<input
		type="checkbox"
		bind:checked={form.data.accepted}
		{@attach form.metadata.accepted.attachment}
	/>

	<button type="submit" disabled={form.isSubmitting}>Submit</button>
	<button type="reset">Reset</button>
</form>
```

### Resetting

Reset to the current defaults:

```ts
form.reset();
```

Replace the defaults and reset:

```ts
form.reset({
	name: "Jane",
	accepted: true,
});
```

### API

#### Methods

- `submit()` — requests form submission
- `reset(values?)` — resets the form and optionally replaces its defaults
- `validateAll()` — reveals all validation errors

#### State

- `data`
- `metadata`
- `errors`
- `defaultData`
- `isValid`
- `isDirty`
- `isSubmitting`
- `wasSubmitted`

Each field exposes `attachment`, `errors`, `dirty`, `blurred`, `focused`, and `touched`.

### Submission

If `onSubmit` is omitted, the form submits using `fetch()` and `FormData`. Returning `false` from `onSubmit` triggers `onError`.

### License

Apache License 2.0
