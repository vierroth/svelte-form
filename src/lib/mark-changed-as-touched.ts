import type { $ZodType } from "zod/v4/core";

type TouchedState = boolean | { [key: string]: TouchedState } | TouchedState[];

export function markChangedAsTouched<S extends TouchedState>(
  schema: $ZodType,
  current: unknown,
  previous: unknown,
  touched?: S,
): S {
  let innerSchema = schema;
  while (true) {
    const def = innerSchema._zod.def;
    if (
      (def.type === "optional" ||
        def.type === "nullable" ||
        def.type === "default" ||
        def.type === "catch") &&
      "innerType" in def &&
      def.innerType
    ) {
      innerSchema = def.innerType as $ZodType;
    } else {
      break;
    }
  }

  const def = innerSchema._zod.def;
  if (def.type === "object" && "shape" in def && def.shape) {
    const shape = def.shape as Record<string, $ZodType>;
    const result: { [key: string]: TouchedState } = {};
    const currentObj = (current ?? {}) as Record<string, unknown>;
    const previousObj = (previous ?? {}) as Record<string, unknown>;
    const touchedObj: { [key: string]: TouchedState } =
      typeof touched === "object" && !Array.isArray(touched) ? touched : {};

    for (const key of Object.keys(shape)) {
      result[key] = markChangedAsTouched(
        shape[key],
        currentObj[key],
        previousObj[key],
        touchedObj[key],
      );
    }
    return result as S;
  }

  if (def.type === "array" && "element" in def && def.element) {
    const elementSchema = def.element as $ZodType;
    const currentArr = Array.isArray(current) ? current : [];
    const previousArr = Array.isArray(previous) ? previous : [];
    const touchedArr = Array.isArray(touched) ? touched : [];

    // Handle array length changes and element changes
    const maxLength = Math.max(currentArr.length, previousArr.length);
    const result: TouchedState[] = [];

    for (let i = 0; i < currentArr.length; i++) {
      result[i] = markChangedAsTouched(
        elementSchema,
        currentArr[i],
        previousArr[i],
        touchedArr[i],
      );
    }

    return result as S;
  }

  // Leaf value: mark as touched if value changed, or preserve existing touched state
  if (current !== previous) {
    return true as S;
  }
  return (touched === true) as S;
}
