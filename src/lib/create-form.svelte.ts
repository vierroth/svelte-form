import type { Action } from "svelte/action";
import { flattenError, ZodType } from "zod";
import equal from "fast-deep-equal";
import { parseFormData } from "./parse-form-data.js";

type ToBoolean<T> = T extends Date
  ? boolean
  : T extends object
    ? PropertiesToBoolean<T>
    : boolean;

type PropertiesToBoolean<T> = T extends any
  ? any
  : {
      [K in keyof T]: ToBoolean<T[K]>;
    };

type ToStringArray<T> = T extends Date
  ? string[] | undefined
  : T extends object
    ? PropertiesToStringArray<T>
    : string[] | undefined;

type PropertiesToStringArray<T> = T extends any
  ? any
  : {
      [K in keyof T]: ToStringArray<T[K]>;
    };

export function createForm<Schema extends ZodType>(props: {
  schema: Schema;
  initialValues?: Schema["_output"];
  onSubmit?: (
    data: Schema["_output"],
  ) => Promise<void | boolean> | (void | boolean);
  onSuccess?: () => Promise<void> | void;
  onError?: (error: any) => Promise<void> | void;
}) {
  let form: HTMLFormElement;
  let lastUpdate: number = 0;
  let data: any = $state({});
  let errors: any = $state({});
  let touched: any = $state({});
  let isValid = $state(false);
  let isDirty = $state(false);
  let isSubmitting = $state(false);

  const updateFormData = () => {
    const timestamp = Date.now();
    const newData = parseFormData(new FormData(form));
    if (!equal(data, newData) && timestamp > lastUpdate) {
      lastUpdate = timestamp;
      data = newData;
      isDirty = true;
    }
  };

  const handleFormChange = () => {
    updateFormData();
  };

  const handleFormInput = () => {
    updateFormData();
  };

  const handleFormBlur = (event: Event) => {
    if (
      event.target &&
      "name" in event.target &&
      typeof event.target.name === "string"
    ) {
      event.target.name.split(".").reduce((position, path, index, array) => {
        if (index + 1 < array.length) {
          if (
            !(
              (Array.isArray(position) &&
                position.length > Number(path) &&
                position[Number(path)]) ||
              path in position
            )
          ) {
            position[isNaN(Number(path)) ? path : Number(path)] = isNaN(
              Number(array[index + 1]),
            )
              ? {}
              : [];
          }
        } else {
          if (!position[isNaN(Number(path)) ? path : Number(path)]) {
            position[isNaN(Number(path)) ? path : Number(path)] = true;
          }
        }

        return position[isNaN(Number(path)) ? path : Number(path)];
      }, touched);
    }
  };

  const handleFormSubmit = async (event: Event) => {
    event.preventDefault();

    isSubmitting = true;

    updateFormData();

    const vData = validate();
    if (vData) {
      if (props.onSubmit) {
        try {
          await props.onSubmit(vData);
          if (props.onSuccess) {
            await props.onSuccess();
          }
        } catch (error: any) {
          if (props.onError) {
            await props.onError(error);
          }
        }
      } else {
        const response = await fetch("", {
          method: "POST",
          body: new FormData(form),
        });

        if (response.ok) {
          if (props.onSuccess) {
            await props.onSuccess();
          }
        } else {
          if (props.onError) {
            await props.onError(response);
          }
        }
      }
    } else {
      if (props.onError) {
        await props.onError({});
      }
    }

    isSubmitting = false;
  };

  function map(errors: any, touched: any) {
    if (
      Object.prototype.toString.call(errors) === "[object Array]" &&
      errors.length &&
      typeof errors[0] === "string"
    ) {
      return touched!! ? errors : undefined;
    }

    var diff: any = {};
    for (var key in errors) {
      var valueTouched = undefined;
      if (touched[key] !== undefined) {
        valueTouched = touched[key];
      }

      diff[key] = map(errors[key], valueTouched);
    }

    return diff;
  }

  let all = false;
  const validate = (a?: boolean) => {
    if (a) {
      all = true;
    }

    const result = props.schema.safeParse(data);
    if (result.success) {
      isValid = true;
      errors = {};
      return result.data;
    } else {
      isValid = false;
      errors = all
        ? flattenError(result.error).fieldErrors
        : map(flattenError(result.error).fieldErrors, touched);
      return false;
    }
  };

  const action: Action = (node) => {
    if (!(node instanceof HTMLFormElement)) {
      throw new Error();
    }

    form = node;

    node.addEventListener("input", handleFormInput);
    node.addEventListener("change", handleFormChange);
    node.addEventListener("blur", handleFormBlur, true);
    node.addEventListener("submit", handleFormSubmit);

    return {
      destroy() {
        node.removeEventListener("input", handleFormInput);
        node.removeEventListener("change", handleFormChange);
        node.removeEventListener("blur", handleFormBlur, true);
        node.removeEventListener("submit", handleFormSubmit);
      },
    };
  };

  if (props.initialValues) {
    data = props.initialValues;
  }

  $effect(() => {
    validate();
  });

  return {
    action,
    submit() {
      form.requestSubmit();
    },
    reset() {
      data = props.initialValues;
      errors = {};
      all = false;
      isDirty = false;
    },
    get data() {
      return data as Schema["_output"];
    },
    set data(v) {
      data = v;
    },
    get touched() {
      return touched;
    },
    set touched(v) {
      touched = v;
    },
    get errors() {
      return errors as PropertiesToStringArray<Schema["_output"]>;
    },
    get isValid() {
      return isValid;
    },
    get isDirty() {
      return isDirty;
    },
    set isDirty(v) {
      isDirty = v;
    },
    get isSubmitting() {
      return isSubmitting;
    },
  };
}
