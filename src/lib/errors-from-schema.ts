import type { $ZodIssue, $ZodType, output } from "zod/v4/core";
import { dataFromSchema } from "./data-from-schema.js";

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
  // ✅ build full structure first
  const result: any = dataFromSchema(schema);

  for (const issue of issues) {
    let current = result;
    let currentTouched = touched;

    for (let i = 0; i < issue.path.length; i++) {
      const key = issue.path[i];

      if (i === issue.path.length - 1) {
        const isTouched = currentTouched ? currentTouched?.[key] : true;

        if (!isTouched) break;

        if (!current[key]) current[key] = [];

        current[key] = current[key] ?? [];
        current[key].push(issue.message);
      } else {
        current[key] = current[key] ?? {};
        current = current[key];

        currentTouched = currentTouched?.[key];
      }
    }
  }

  return result;
}
