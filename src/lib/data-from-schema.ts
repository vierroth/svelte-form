import type { core } from "zod/mini";
import type { output } from "zod/v4/core";

type $ZodType = core.$ZodType;

export function dataFromSchema<S extends $ZodType>(
	schema: S,
	data?: output<S>,
): output<S> {
	let current: $ZodType = schema;
	let defaultValue: unknown = undefined;

	while (true) {
		const def = current._zod.def;

		const isWrapper =
			def.type === "optional" ||
			def.type === "nullable" ||
			def.type === "default" ||
			def.type === "catch";

		if (isWrapper && "innerType" in def && def.innerType) {
			const inner = def.innerType as $ZodType;
			const innerDef = inner._zod.def;

			if (
				def.type === "optional" &&
				(innerDef.type === "object" || innerDef.type === "array")
			) {
				return undefined as output<S>;
			}

			if ("defaultValue" in def && def.defaultValue !== undefined) {
				defaultValue = def.defaultValue;
			}

			current = inner;
		} else {
			break;
		}
	}

	if (data === undefined && defaultValue !== undefined) {
		data = defaultValue as output<S>;
	}

	const def = current._zod.def;

	if (def.type === "object" && "shape" in def && def.shape) {
		const shape = def.shape as Record<string, $ZodType>;

		const result: Record<string, unknown> = {};
		const dataObj =
			typeof data === "object" && data !== null && !Array.isArray(data)
				? (data as Record<string, unknown>)
				: {};

		for (const key of Object.keys(shape)) {
			result[key] = dataFromSchema(
				shape[key] as any,
				dataObj[key] === undefined ? undefined : dataObj[key],
			);
		}

		return result as output<S>;
	}

	if (def.type === "array" && "element" in def && def.element) {
		const elementSchema = def.element as $ZodType;

		let dataArray: unknown[];

		if (data === undefined && defaultValue !== undefined) {
			dataArray = defaultValue as unknown[];
		} else if (Array.isArray(data)) {
			dataArray = data;
		} else {
			dataArray = [];
		}

		return dataArray.map((item) =>
			dataFromSchema(elementSchema as any, item as any),
		) as output<S>;
	}

	return data as output<S>;
}
