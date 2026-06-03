import type { Action } from "svelte/action";
import { type output, safeParse } from "zod/v4-mini";
import equal from "fast-deep-equal";
import { extractDefaults } from "./extract-defaults.js";
import type { $ZodType } from "zod/v4/core";
import { touchedFromSchema } from "./touched-from-schema.js";
import { errorsFromSchema } from "./errors-from-schema.js";
import { markChangedAsTouched } from "./mark-changed-as-touched.js";
import { untrack } from "svelte";
import { dataFromSchema } from "./data-from-schema.js";

export function createForm<S extends $ZodType>(props: {
  schema: S;
  initialValues?: output<S>;
  onSubmit?: (data: output<S>) => Promise<void | boolean> | (void | boolean);
  onSuccess?: () => Promise<void> | void;
  onError?: (error: unknown) => Promise<void> | void;
}) {
  let form: HTMLFormElement;
  let data = $state(dataFromSchema(props.schema));
  let errors = $state(errorsFromSchema(props.schema));
  let touched = $state(touchedFromSchema(props.schema));
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

    touched = markChangedAsTouched(
      props.schema,
      data,
      defaultData,
      untrack(() => touched),
    );
  });

  $effect(() => {
    const result = safeParse(props.schema, data);

    const issues = result.success ? [] : result.error.issues;
    errors = errorsFromSchema(props.schema, issues, touched);

    isValid = result.success;
  });

  const handleFormBlur = async (event: Event) => {
    event.preventDefault();
  };

  function handleFormReset(event: Event) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    data = $state.snapshot(defaultData) as output<S>;
    touched = touchedFromSchema(props.schema);
    isDirty = false;
  }

  const handleFormSubmit = async (event: Event) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    isSubmitting = true;

    touched = touchedFromSchema(props.schema, true);

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
