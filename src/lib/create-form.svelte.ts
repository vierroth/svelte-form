import type { Action } from "svelte/action";
import { type core, type output, safeParse, flattenError } from "zod/v4-mini";
import equal from "fast-deep-equal";
import { extractDefaults } from "./extract-defaults.js";

type $ZodType = core.$ZodType;

type FieldErrors<T> = (T extends Date
  ? string[] | undefined
  : T extends object
    ? { [K in keyof T]: FieldErrors<T[K]> }
    : string[] | undefined) & { submit?: string };

export function createForm<S extends core.$ZodType>(props: {
  schema: S;
  initialValues?: output<S>;
  onSubmit?: (data: output<S>) => Promise<void | boolean> | (void | boolean);
  onSuccess?: () => Promise<void> | void;
  onError?: (error: unknown) => Promise<void> | void;
}) {
  let form: HTMLFormElement;
  let data: output<S> = $state({} as output<S>);
  let errors = $state({} as FieldErrors<output<S>>);
  let touched = $state({} as Record<string, unknown>);
  let isSubmitting = $state(false);
  let isDirty = $state(false);
  let isValid = $state(false);

  let defaultData: output<S> = $state(
    props.initialValues
      ? structuredClone(props.initialValues)
      : (extractDefaults(props.schema) as output<S>),
  );

  $effect(() => {
    if (!isDirty) {
      isDirty = !equal(data, defaultData);
    }
  });

  $effect(() => {
    const result = safeParse(props.schema, data);

    if (result.success && result.data) {
      data = result.data;
    }

    const fieldErrors = result.success
      ? {}
      : flattenError(result.error).fieldErrors;
    errors = buildErrorsFromSchema(props.schema, fieldErrors, touched);

    isValid = result.success;
  });

  const handleFormBlur = async (event: Event) => {};

  function handleFormReset(event: Event) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    data = $state.snapshot(defaultData) as output<S>;
    touched = {};
  }

  const handleFormSubmit = async (event: Event) => {
    event.preventDefault();
    isSubmitting = true;

    try {
      if (!isValid) {
        await props.onError?.({});
        return;
      }

      if (props.onSubmit) {
        await props.onSubmit(data);
      } else {
        const response = await fetch("", {
          method: "POST",
          body: new FormData(form),
        });
        if (!response.ok) {
          await props.onError?.(response);
          return;
        }
      }
      await props.onSuccess?.();
    } catch (error) {
      await props.onError?.(error);
    } finally {
      isSubmitting = false;
    }
  };

  function buildErrorsFromSchema(
    schema: $ZodType,
    fieldErrors: any,
    touchedFields: any,
    path: string[] = [],
  ): any {
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
      const result: Record<string, unknown> = {};
      for (const key of Object.keys(shape)) {
        result[key] = buildErrorsFromSchema(
          shape[key],
          fieldErrors?.[key],
          touchedFields?.[key],
          [...path, key],
        );
      }
      return result;
    }

    // Leaf field: return error if touched, undefined otherwise
    if (Array.isArray(fieldErrors) && typeof fieldErrors[0] === "string") {
      return touchedFields ? fieldErrors : undefined;
    }

    return undefined;
  }

  const action: Action = (node) => {
    if (!(node instanceof HTMLFormElement)) {
      throw new Error();
    }

    form = node;

    node.addEventListener("blur", handleFormBlur, true);
    node.addEventListener("reset", handleFormReset);
    node.addEventListener("submit", handleFormSubmit);

    return {
      destroy() {
        node.removeEventListener("blur", handleFormBlur, true);
        node.removeEventListener("reset", handleFormReset);
        node.removeEventListener("submit", handleFormSubmit);
      },
    };
  };

  if (props.initialValues) {
    data = props.initialValues;
  } else {
    data = extractDefaults(props.schema) as output<S>;
  }

  return {
    action,
    submit() {
      form.requestSubmit();
    },
    reset() {
      form.requestReset();
    },
    get data() {
      return data;
    },
    set data(v) {
      data = v;
    },
    get defaultData() {
      return defaultData;
    },
    set defaultData(v) {
      defaultData = v;
    },
    get touched() {
      return touched;
    },
    set touched(v) {
      touched = v;
    },
    get errors() {
      return errors;
    },
    get isValid() {
      return isValid;
    },
    get isDirty() {
      return isDirty;
    },
    get isSubmitting() {
      return isSubmitting;
    },
  };
}
