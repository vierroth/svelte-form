import type { $ZodType, output } from "zod/v4/core";

export function dataFromSchema<S extends $ZodType>(
  schema: S,
  data?: output<S>,
): output<S> {
  let innerSchema: $ZodType = schema;

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

    const result: Record<string, unknown> = {};
    const dataObj =
      typeof data === "object" && data !== null && !Array.isArray(data)
        ? (data as Record<string, unknown>)
        : {};

    for (const key of Object.keys(shape)) {
      result[key] = dataFromSchema(shape[key] as any, dataObj[key] as any);
    }

    return result as output<S>;
  }

  if (def.type === "array" && "element" in def && def.element) {
    const elementSchema = def.element as $ZodType;
    const dataArray = Array.isArray(data) ? data : [];

    return dataArray.map((item) =>
      dataFromSchema(elementSchema as any, item as any),
    ) as output<S>;
  }

  return data as output<S>;
}
