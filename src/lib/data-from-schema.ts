import type { core } from "zod/mini";
import type { output } from "zod/v4/core";

type $ZodType = core.$ZodType;

export function dataFromSchema<S extends $ZodType>(
	schema: S,
	data?: output<S>,
): output<S> {
	let current: $ZodType = schema;
	let defaultValue: unknown;
	let isOptional = false;

	while (true) {
		const def = current._zod.def;

		if (def.type === "optional") isOptional = true;

		if ("defaultValue" in def && def.defaultValue !== undefined) {
			defaultValue = def.defaultValue;
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

	if (data === undefined) {
		if (defaultValue !== undefined) {
			data = defaultValue as output<S>;
		} else if (isOptional && (def.type === "object" || def.type === "array")) {
			return undefined as output<S>;
		}
	}

	if (def.type === "object" && "shape" in def && def.shape) {
		const shape = def.shape as Record<string, $ZodType>;

		const dataObj =
			data && typeof data === "object" && !Array.isArray(data)
				? (data as Record<string, unknown>)
				: undefined;

		const result: Record<string, unknown> = dataObj ? { ...dataObj } : {};

		for (const key in shape) {
			const value = dataObj?.[key];

			if (value === undefined) {
				const generated = dataFromSchema(shape[key] as any, undefined);
				if (generated !== undefined) result[key] = generated;
			} else {
				result[key] = dataFromSchema(shape[key] as any, value as any);
			}
		}

		return result as output<S>;
	}

	if (def.type === "array" && "element" in def && def.element) {
		const element = def.element as $ZodType;

		const arr = Array.isArray(data)
			? data
			: data === undefined && defaultValue !== undefined
			  ? (defaultValue as unknown[])
			  : [];

		return arr.map((item) =>
			dataFromSchema(element as any, item as any),
		) as output<S>;
	}

	return data as output<S>;
}
