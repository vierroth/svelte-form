import type { $ZodType } from "zod/v4/core";

type FieldTouched<T> = T extends Array<infer U>
  ? FieldTouched<U>[]
  : T extends object
    ? { [K in keyof T]: FieldTouched<T[K]> }
    : boolean;

export function touchedFromSchema<S extends $ZodType>(
  schema: S,
  touched?: FieldTouched<S> | true,
): FieldTouched<S> {
  return recurse(schema, touched);
}

function unwrap(schema: $ZodType): $ZodType {
  let current = schema;

  while (true) {
    const def = (current as any)._zod.def;

    if (
      (def.type === "optional" ||
        def.type === "nullable" ||
        def.type === "default" ||
        def.type === "catch") &&
      def.innerType
    ) {
      current = def.innerType;
    } else {
      return current;
    }
  }
}

function recurse(schema: $ZodType, touched?: any): any {
  const inner = unwrap(schema);
  const def = (inner as any)._zod.def;

  if (def.type === "object") {
    const shape = def.shape as Record<string, $ZodType>;
    const result: Record<string, any> = {};

    for (const key of Object.keys(shape)) {
      const childTouched =
        touched === true
          ? true
          : touched && typeof touched === "object" && !Array.isArray(touched)
            ? touched[key]
            : undefined;

      result[key] = recurse(shape[key], childTouched);
    }

    return result;
  }

  if (def.type === "array") {
    const element = def.element as $ZodType;

    if (touched === true) {
      return [];
    }

    if (Array.isArray(touched)) {
      return touched.map((t) => recurse(element, t));
    }

    return [];
  }

  if (touched === true) return true;
  if (typeof touched === "boolean") return touched;

  return false;
}
