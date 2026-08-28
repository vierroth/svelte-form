import type { $ZodType, output } from "zod/v4/core";

type FieldMetadata = {
	attached: boolean;
	blurred: boolean;
	dirty: boolean;
};

type FormMetadata<T> = T extends Set<unknown> | Map<unknown, unknown> | Date
	? FieldMetadata
	: T extends Array<infer U>
	  ? FormMetadata<U>[]
	  : T extends object
	    ? { [K in keyof T]: FormMetadata<T[K]> }
	    : FieldMetadata;

const empty = {
	attached: false,
	blurred: false,
	dirty: false,
};

function metadataFromSchemaImpl(schema: $ZodType, state?: unknown): unknown {
	let current = schema;

	while (true) {
		const def = current._zod.def;

		if (
			(def.type === "optional" ||
				def.type === "nullable" ||
				def.type === "default" ||
				def.type === "catch") &&
			"innerType" in def &&
			def.innerType
		) {
			current = def.innerType as $ZodType;
			continue;
		}

		break;
	}

	const def = current._zod.def;

	if (def.type === "object" && "shape" in def && def.shape) {
		const shape = def.shape as Record<string, $ZodType>;
		const source =
			state !== true &&
			state !== null &&
			typeof state === "object" &&
			!Array.isArray(state)
				? (state as Record<string, unknown>)
				: undefined;
		const result: Record<string, unknown> = {};

		for (const key in shape) {
			result[key] = metadataFromSchemaImpl(
				shape[key],
				state === true ? true : source?.[key],
			);
		}

		return result;
	}

	if (def.type === "array" && "element" in def && def.element) {
		const element = def.element as $ZodType;

		return Array.isArray(state)
			? state.map((value) => metadataFromSchemaImpl(element, value))
			: [];
	}

	if (state === true) {
		return { attached: true, blurred: true, dirty: true };
	}

	if (state !== null && typeof state === "object") {
		const value = state as Partial<FieldMetadata>;

		return {
			attached: !!value.attached,
			blurred: !!value.blurred,
			dirty: !!value.dirty,
		};
	}

	return { ...empty };
}

export function metadataFromSchema<S extends $ZodType>(
	schema: S,
	state?: FormMetadata<output<S>> | true,
): FormMetadata<output<S>> {
	return metadataFromSchemaImpl(schema, state) as FormMetadata<output<S>>;
}
