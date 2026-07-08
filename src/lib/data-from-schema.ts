import type { core } from "zod/mini";
import type { output } from "zod/v4/core";

type $ZodType = core.$ZodType;

type FormState<T> = T extends Array<infer U>
	? FormState<U>[]
	: T extends object
	  ? { [K in keyof T]: FormState<T[K]> }
	  : T | null;

export function dataFromSchema<S extends $ZodType>(
	schema: S,
	data?: output<S>,
): FormState<output<S>> {
	let current: $ZodType = schema;
	let defaultValue: unknown;
	let hasDefault = false;

	while (true) {
		const def = current._zod.def;

		if (!hasDefault && (def.type === "default" || def.type === "prefault")) {
			hasDefault = true;
			defaultValue =
				typeof (def as any).defaultValue === "function"
					? ((def as any).defaultValue as () => unknown)()
					: (def as any).defaultValue;
		}

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

	if (data === undefined && hasDefault) {
		data = defaultValue as output<S>;
	}

	if (hasDefault && defaultValue === undefined && data === undefined) {
		return null as FormState<output<S>>;
	}

	if (def.type === "object" && "shape" in def && def.shape) {
		const shape = def.shape as Record<string, $ZodType>;

		const dataObj =
			data && typeof data === "object" && !Array.isArray(data)
				? (data as Record<string, unknown>)
				: undefined;

		const result: Record<string, unknown> = {};

		for (const key in shape) {
			result[key] = dataFromSchema(shape[key] as any, dataObj?.[key] as any);
		}

		return result as FormState<output<S>>;
	}

	if (def.type === "array" && "element" in def && def.element) {
		const element = def.element as $ZodType;

		const arr = Array.isArray(data) ? data : [];

		return arr.map((item) =>
			dataFromSchema(element as any, item as any),
		) as FormState<output<S>>;
	}

	if (def.type === "tuple" && "items" in def && def.items) {
		const items = def.items as $ZodType[];
		const rest = "rest" in def ? (def.rest as $ZodType | undefined) : undefined;

		const arr = Array.isArray(data) ? data : [];

		const result = items.map((item, index) =>
			dataFromSchema(item as any, arr[index] as any),
		);

		if (rest) {
			for (let i = items.length; i < arr.length; i++) {
				result.push(dataFromSchema(rest as any, arr[i] as any));
			}
		}

		return result as FormState<output<S>>;
	}

	if (def.type === "record" && "valueType" in def && def.valueType) {
		const valueType = def.valueType as $ZodType;

		const dataObj =
			data && typeof data === "object" && !Array.isArray(data)
				? (data as Record<string, unknown>)
				: undefined;

		const result: Record<string, unknown> = {};

		if (dataObj) {
			for (const key in dataObj) {
				result[key] = dataFromSchema(valueType as any, dataObj[key] as any);
			}
		}

		return result as FormState<output<S>>;
	}

	if (def.type === "union" && "options" in def && def.options) {
		const options = def.options as $ZodType[];

		for (const option of options) {
			const parsed = (option as any)._zod.run({ value: data, issues: [] }, {});

			if (!(parsed instanceof Promise) && parsed.issues.length === 0) {
				return dataFromSchema(option as any, data as any);
			}
		}

		return dataFromSchema(options[0] as any, data as any);
	}

	return (data === undefined ? null : data) as FormState<output<S>>;
}
