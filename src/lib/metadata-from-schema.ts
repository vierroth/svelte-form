import type { $ZodType } from "zod/v4/core";

type FieldMetadata = {
	attached: boolean;
	blurred: boolean;
	dirty: boolean;
};

type FormMetadata<T> = T extends Array<infer U>
	? FormMetadata<U>[]
	: T extends object
	  ? { [K in keyof T]: FormMetadata<T[K]> }
	  : FieldMetadata;

export function metadataFromSchema<S extends $ZodType>(
	schema: S,
	state?: FormMetadata<S> | true,
): FormMetadata<S> {
	function recurse(schema: $ZodType, state?: any): any {
		let current = schema;

		while (true) {
			const innerDef = (current as any)._zod.def;

			if (
				(innerDef.type === "optional" ||
					innerDef.type === "nullable" ||
					innerDef.type === "default" ||
					innerDef.type === "catch") &&
				innerDef.innerType
			) {
				current = innerDef.innerType;
			} else {
				break;
			}
		}

		const def = (current as any)._zod.def;

		if (def.type === "object") {
			const shape = def.shape as Record<string, $ZodType>;
			const result: Record<string, any> = {};

			for (const key of Object.keys(shape)) {
				const childState =
					state === true
						? true
						: state && typeof state === "object" && !Array.isArray(state)
						  ? state[key]
						  : undefined;

				result[key] = recurse(shape[key], childState);
			}

			return result;
		}

		if (def.type === "array") {
			const element = def.element as $ZodType;

			if (Array.isArray(state)) {
				return state.map((s) => recurse(element, s));
			}

			return [];
		}

		if (state === true) {
			return { attached: true, blurred: true, dirty: true };
		}

		if (state && typeof state === "object") {
			return {
				attached: !!state.attached,
				blurred: !!state.blurred,
				dirty: !!state.dirty,
			};
		}

		return { attached: false, blurred: false, dirty: false };
	}

	return recurse(schema, state);
}
