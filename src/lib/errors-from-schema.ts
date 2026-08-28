import type { core } from "zod/mini";
import type { $ZodIssue, $ZodType, output } from "zod/v4/core";

type FieldErrors<T> = T extends Set<unknown>
	? string[] | undefined
	: T extends Map<unknown, unknown>
	  ? string[] | undefined
	  : T extends Date
	    ? string[] | undefined
	    : T extends Array<infer U>
	      ? FieldErrors<U>[]
	      : T extends object
	        ? { [K in keyof T]: FieldErrors<T[K]> }
	        : string[] | undefined;

type FormErrors<T> = FieldErrors<T> & {
	submit?: string;
};

function emptyFromSchema(schema: core.$ZodType): any {
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
			current = def.innerType as core.$ZodType;
			continue;
		}

		break;
	}

	const def = current._zod.def;

	if (def.type === "object" && "shape" in def && def.shape) {
		const shape = def.shape as Record<string, core.$ZodType>;
		const result: Record<string, any> = {};

		for (const key in shape) {
			result[key] = emptyFromSchema(shape[key]);
		}

		return result;
	}

	if (def.type === "array") return [];

	return undefined;
}

function errorsFromSchemaImpl(schema: core.$ZodType, issues: $ZodIssue[]): any {
	const result = emptyFromSchema(schema);

	for (const issue of issues) {
		if (issue.path.length === 0) {
			result.submit = result.submit
				? `${result.submit}\n${issue.message}`
				: issue.message;
			continue;
		}

		let current = result;

		for (let i = 0; i < issue.path.length; i++) {
			const key = issue.path[i] as string | number;

			if (i === issue.path.length - 1) {
				if (!Array.isArray(current[key])) current[key] = [];
				current[key].push(issue.message);
				continue;
			}

			if (current[key] === undefined || current[key] === null) {
				current[key] = typeof issue.path[i + 1] === "number" ? [] : {};
			}

			current = current[key];
		}
	}

	return result;
}

export function errorsFromSchema<S extends $ZodType>(
	schema: S,
	issues: $ZodIssue[] = [],
): FormErrors<output<S>> {
	return errorsFromSchemaImpl(schema as core.$ZodType, issues) as FormErrors<
		output<S>
	>;
}
