import type { core } from "zod/mini";
import type { output } from "zod/v4/core";

type $ZodType = core.$ZodType;

export type FormState<T> = T extends Set<infer U>
	? Set<U>
	: T extends Map<infer K, infer V>
	  ? Map<K, V>
	  : T extends Date
	    ? Date
	    : T extends Array<infer U>
	      ? FormState<U>[]
	      : T extends object
	        ? { [K in keyof T]: FormState<T[K]> }
	        : T | null;

type WrapperInfo = {
	schema: $ZodType;
	isOptionalOrNullable: boolean;
	hasDefault: boolean;
	defaultValue: unknown;
};

function inspectWrappers(schema: $ZodType): WrapperInfo {
	let current = schema;
	let isOptionalOrNullable = false;
	let hasDefault = false;
	let defaultValue: unknown;

	while (true) {
		const def = current._zod.def;

		if (def.type === "optional" || def.type === "nullable") {
			isOptionalOrNullable = true;
		}

		if (!hasDefault && (def.type === "default" || def.type === "prefault")) {
			hasDefault = true;

			const value = (def as unknown as { defaultValue: unknown }).defaultValue;

			defaultValue =
				typeof value === "function" ? (value as () => unknown)() : value;
		}

		if (
			(def.type === "optional" ||
				def.type === "nullable" ||
				def.type === "default" ||
				def.type === "prefault" ||
				def.type === "catch") &&
			"innerType" in def &&
			def.innerType
		) {
			current = def.innerType as $ZodType;
			continue;
		}

		return {
			schema: current,
			isOptionalOrNullable,
			hasDefault,
			defaultValue,
		};
	}
}

export function dataFromSchema<S extends $ZodType>(
	schema: S,
	data?: output<S>,
): FormState<output<S>> {
	return dataFromSchemaImpl(schema, data) as FormState<output<S>>;
}

function dataFromSchemaImpl(schema: $ZodType, data?: unknown): unknown {
	const {
		schema: current,
		isOptionalOrNullable,
		hasDefault,
		defaultValue,
	} = inspectWrappers(schema);

	if (data === undefined) {
		if (hasDefault) {
			data = defaultValue;

			if (data === undefined) {
				return null;
			}
		} else if (isOptionalOrNullable) {
			return null;
		}
	}

	if (data === null && isOptionalOrNullable) {
		return null;
	}

	const def = current._zod.def;

	if (def.type === "object" && "shape" in def && def.shape) {
		const shape = def.shape as Record<string, $ZodType>;
		const source =
			data !== null && typeof data === "object" && !Array.isArray(data)
				? (data as Record<string, unknown>)
				: undefined;
		const result: Record<string, unknown> = {};

		for (const key in shape) {
			result[key] = dataFromSchemaImpl(shape[key], source?.[key]);
		}

		return result;
	}

	if (def.type === "array" && "element" in def && def.element) {
		const element = def.element as $ZodType;
		const source = Array.isArray(data) ? data : [];

		return source.map((value) => dataFromSchemaImpl(element, value));
	}

	if (def.type === "tuple" && "items" in def && def.items) {
		const items = def.items as $ZodType[];
		const rest = "rest" in def ? (def.rest as $ZodType | undefined) : undefined;
		const source = Array.isArray(data) ? data : [];
		const result = items.map((item, index) =>
			dataFromSchemaImpl(item, source[index]),
		);

		if (rest) {
			for (let index = items.length; index < source.length; index++) {
				result.push(dataFromSchemaImpl(rest, source[index]));
			}
		}

		return result;
	}

	if (def.type === "record" && "valueType" in def && def.valueType) {
		const valueType = def.valueType as $ZodType;
		const source =
			data !== null && typeof data === "object" && !Array.isArray(data)
				? (data as Record<string, unknown>)
				: undefined;
		const result: Record<string, unknown> = {};

		if (source) {
			for (const key in source) {
				result[key] = dataFromSchemaImpl(valueType, source[key]);
			}
		}

		return result;
	}

	if (def.type === "union" && "options" in def && def.options) {
		const options = def.options as $ZodType[];

		for (const option of options) {
			const parsed = (option as any)._zod.run({ value: data, issues: [] }, {});

			if (!(parsed instanceof Promise) && parsed.issues.length === 0) {
				return dataFromSchemaImpl(option, data);
			}
		}

		return dataFromSchemaImpl(options[0], data);
	}

	return data === undefined ? null : data;
}
