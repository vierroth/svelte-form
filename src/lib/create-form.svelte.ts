import { type output, safeParse } from "zod/mini";
import equal from "fast-deep-equal";
import type { $ZodType } from "zod/v4/core";
import { dataFromSchema } from "./data-from-schema.js";
import type { Attachment } from "svelte/attachments";
import { metadataFromSchema } from "./metadata-from-schema.js";
import { errorsFromSchema } from "./errors-from-schema.js";
import { createFields } from "./create-fields.js";
import { untrack } from "svelte";

export function createForm<S extends $ZodType>(props: {
	schema: S;
	initialValues?: output<S>;
	onSubmit?: (data: output<S>) => Promise<void | boolean> | (void | boolean);
	onSuccess?: () => Promise<void> | void;
	onError?: () => Promise<void> | void;
}) {
	let form: HTMLFormElement;

	let data = $state(dataFromSchema(props.schema, props.initialValues));
	let metadata = $state(metadataFromSchema(props.schema));
	let errors = $state(errorsFromSchema(props.schema));

	let defaultData = $state<output<S>>($state.snapshot(data) as any);
	let parsedData = $state<output<S>>();

	let isSubmitting = $state(false);
	let wasSubmitted = $state(false);
	let isValid = $state(false);
	let isDirty = $derived(!equal(data, defaultData));

	const state = {
		get data() {
			return data;
		},
		get errors() {
			return errors;
		},
		get metadata() {
			return metadata;
		},
		get defaultData() {
			return defaultData;
		},
		get wasSubmitted() {
			return wasSubmitted;
		},
	};

	const fields = createFields(props.schema, state);

	$effect(() => {
		const result = safeParse(props.schema, data);

		parsedData = result.success ? result.data : undefined;

		const issues = result.success ? [] : result.error.issues;
		const newErrors = errorsFromSchema(props.schema, issues);

		if (
			!equal(
				untrack(() => errors),
				newErrors,
			)
		) {
			errors = newErrors;
		}

		if (isValid !== result.success) {
			isValid = result.success;
		}
	});

	function handleFormReset(event: Event) {
		event.preventDefault();

		if (isSubmitting) return;

		wasSubmitted = false;
		data = dataFromSchema(props.schema, props.initialValues);
		metadata = metadataFromSchema(props.schema);
	}

	const handleFormSubmit = async (event: Event) => {
		event.preventDefault();

		if (isSubmitting) return;

		isSubmitting = true;
		wasSubmitted = true;

		metadata = metadataFromSchema(props.schema);

		try {
			if (!isValid) {
				await props.onError?.();
				return;
			}

			if (props.onSubmit && parsedData) {
				await props.onSubmit(parsedData);
			} else {
				const response = await fetch("", {
					method: "POST",
					body: new FormData(form),
				});
				if (!response.ok) {
					await props.onError?.();
					return;
				}
			}

			await props.onSuccess?.();
		} catch {
			await props.onError?.();
		} finally {
			isSubmitting = false;
		}
	};

	const attachment: Attachment = (node) => {
		if (!(node instanceof HTMLFormElement)) {
			throw new Error();
		}

		form = node;

		node.addEventListener("reset", handleFormReset);
		node.addEventListener("submit", handleFormSubmit);

		return () => {
			node.removeEventListener("reset", handleFormReset);
			node.removeEventListener("submit", handleFormSubmit);
		};
	};

	return {
		attachment,
		submit() {
			form?.requestSubmit();
		},
		reset() {
			form?.requestReset();
		},
		get data() {
			return data;
		},
		get metadata() {
			return fields;
		},
		get errors() {
			return errors;
		},
		get defaultData() {
			return defaultData;
		},
		set defaultData(v) {
			defaultData = v;
		},
		get isValid() {
			return isValid;
		},
		get isDirty() {
			return isDirty;
		},
		get isSubmitting() {
			return isSubmitting;
		},
		get wasSubmitted() {
			return wasSubmitted;
		},
	};
}
