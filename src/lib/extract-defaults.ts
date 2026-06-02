import type { ZodType } from "zod";

export function extractDefaults<T extends ZodType>(schema: T): unknown {
  const def = schema._zod.def;
  const type = def.type;

  if ("defaultValue" in def && def.defaultValue !== undefined) {
    return def.defaultValue;
  }

  if ("innerType" in def && def.innerType) {
    return extractDefaults(def.innerType as ZodType);
  }

  if (type === "object" && "shape" in def && def.shape) {
    const shape = def.shape as Record<string, ZodType>;
    const result: Record<string, unknown> = {};
    for (const key in shape) {
      const fieldDefault = extractDefaults(shape[key]);
      if (fieldDefault !== undefined) {
        result[key] = fieldDefault;
      }
    }
    return Object.keys(result).length > 0 ? result : undefined;
  }

  if (type === "tuple" && "items" in def && Array.isArray(def.items)) {
    const items = def.items as ZodType[];
    const result = items.map((item) => extractDefaults(item));
    return result.some((v) => v !== undefined) ? result : undefined;
  }

  if (type === "union" && "options" in def && Array.isArray(def.options)) {
    for (const option of def.options as ZodType[]) {
      const optionDefault = extractDefaults(option);
      if (optionDefault !== undefined) {
        return optionDefault;
      }
    }
    return undefined;
  }

  if (type === "intersection" && "left" in def && "right" in def) {
    const left = extractDefaults(def.left as ZodType);
    const right = extractDefaults(def.right as ZodType);
    if (
      left !== undefined &&
      right !== undefined &&
      typeof left === "object" &&
      typeof right === "object"
    ) {
      return { ...left, ...right };
    }
    return left ?? right;
  }

  return undefined;
}
