import type { ZodSchema } from "zod";

function isIndex(key: string) {
  return Number.isSafeInteger(Number(key)) && parseInt(key) >= 0;
}

export function parseFormData(data: FormData) {
  let output: any = {};

  for (const [path, value] of data) {
    path.split(".").reduce((position, key: any, index, array) => {
      key = isIndex(key) ? parseInt(key) : key;

      if (index < array.length - 1) {
        if (
          !(
            (Array.isArray(position) &&
              position.length > key &&
              !!position[key]) ||
            key in position
          )
        ) {
          position[key] = isIndex(array[index + 1]) ? [] : {};
        }
      } else {
        position[key] = value;
      }

      return position[key];
    }, output);
  }

  return output;
}

export async function verifyFormData<S extends ZodSchema>(
  schema: S,
  request: Request,
) {
  return schema.parse(
    await parseFormData(await request.formData()),
  ) as S["_output"];
}
