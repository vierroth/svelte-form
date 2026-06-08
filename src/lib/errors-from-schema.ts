import type { $ZodIssue, $ZodType, output } from "zod/v4/core";
import type { core } from "zod/v4-mini";

type FieldErrors<T> = T extends Array<infer U>
	? FieldErrors<U>[]
	: T extends object
	  ? { [K in keyof T]: FieldErrors<T[K]> }
	  : string[] | undefined;

type FormErrors<T> = FieldErrors<T> & {
	submit?: string;
};

export function errorsFromSchema<S extends $ZodType>(
	schema: S,
	issues: $ZodIssue[] = [],
	touched?: any,
): FormErrors<output<S>> {
	function emptyFromSchema(schema: core.$ZodType): any {
		let current: core.$ZodType = schema;

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
			} else {
				break;
			}
		}

		const def = current._zod.def;

		if (def.type === "object") {
			const shape = (def as any).shape as Record<string, core.$ZodType>;
			const result: Record<string, any> = {};

			for (const key of Object.keys(shape)) {
				result[key] = emptyFromSchema(shape[key]);
			}

			return result;
		}

		if (def.type === "array") {
			return [];
		}

		return undefined;
	}

	const result: any = emptyFromSchema(schema);

	for (const issue of issues) {
		let current = result;
		let currentTouched = touched;

		for (let i = 0; i < issue.path.length; i++) {
			const key = issue.path[i];

			if (i === issue.path.length - 1) {
				const isTouched = currentTouched ? currentTouched?.[key] : true;
				if (!isTouched) break;

				if (!current[key]) current[key] = [];
				current[key].push(issue.message);
			} else {
				current = current[key];
				currentTouched = currentTouched?.[key];
			}
		}
	}

	return result;
}
