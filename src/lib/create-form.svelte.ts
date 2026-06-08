import { type output, safeParse } from "zod/v4-mini";
import equal from "fast-deep-equal";
import type { $ZodType } from "zod/v4/core";
import { errorsFromSchema } from "./errors-from-schema.js";
import { dataFromSchema } from "./data-from-schema.js";
import type { Attachment } from "svelte/attachments";
import { createFields } from "./create-fields.js";
import { metadataFromSchema } from "./metadata-from-schema.js";

export function createForm<S extends $ZodType>(props: {
	schema: S;
	initialValues?: output<S>;
	onSubmit?: (data: output<S>) => Promise<void | boolean> | (void | boolean);
	onSuccess?: () => Promise<void> | void;
	onError?: (error: unknown) => Promise<void> | void;
}) {
	let form: HTMLFormElement;

	let data = $state(dataFromSchema(props.schema, props.initialValues));
	let defaultData = $state<output<S>>($state.snapshot(data) as any);
	let parsedData = $state<output<S>>();
	let errors = $state(errorsFromSchema(props.schema));
	let metadata = $state(metadataFromSchema(props.schema));

	let isSubmitting = $state(false);
	let isSubmitted = $state(false);
	let isValid = $state(false);
	let isDirty = $derived(!equal(data, defaultData));

	let fields = createFields(
		() => data,
		() => errors,
		() => metadata,
		() => defaultData,
		() => isSubmitted,
	);

	$effect(() => {
		const result = safeParse(props.schema, data);

		parsedData = result.success ? result.data : (undefined as any);

		const issues = result.success ? [] : result.error.issues;
		const newErrors = errorsFromSchema(props.schema, issues, metadata);

		if (!equal(errors, newErrors)) {
			errors = newErrors;
		}

		if (isValid !== result.success) {
			isValid = result.success;
		}
	});

	function handleFormReset(event: Event) {
		event.preventDefault();

		if (isSubmitting) return;

		isSubmitted = false;
		data = dataFromSchema(props.schema, props.initialValues);
		metadata = metadataFromSchema(props.schema);

		fields = createFields(
			() => data,
			() => errors,
			() => metadata,
			() => defaultData,
			() => isSubmitted,
		);
	}

	const handleFormSubmit = async (event: Event) => {
		event.preventDefault();

		if (isSubmitting) return;

		isSubmitting = true;
		isSubmitted = true;

		metadata = metadataFromSchema(props.schema, true);

		try {
			if (!isValid) {
				await props.onError?.(errors);
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
					await props.onError?.(response);
					return;
				}
			}

			await props.onSuccess?.();
		} catch (error) {
			await props.onError?.(error);
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
		get fields() {
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
		get metadata() {
			return metadata;
		},
		set metadata(v) {
			metadata = v;
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
	};
}
