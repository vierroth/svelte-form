import type { Attachment } from "svelte/attachments";
import equal from "fast-deep-equal";
import type { output } from "zod";
import type { $ZodType } from "zod/v4/core";

function getAtPath(obj: any, path: (string | number)[]) {
	let current = obj;
	for (const key of path) {
		if (current == null) return undefined;
		current = current[key];
	}
	return current;
}

function ensurePath(obj: any, path: (string | number)[]) {
	let current = obj;

	for (let i = 0; i < path.length; i++) {
		const key = path[i];
		const nextKey = path[i + 1];

		if (typeof key === "number") {
			if (!Array.isArray(current)) return undefined;
			if (current[key] == null) {
				current[key] = typeof nextKey === "number" ? [] : {};
			}
		} else {
			if (current[key] == null) {
				current[key] = typeof nextKey === "number" ? [] : {};
			}
		}

		current = current[key];
	}

	return current;
}

type Field = {
	readonly errors: string[] | undefined;
	readonly dirty: boolean;
	readonly blurred: boolean;
	readonly attached: boolean;
	readonly touched: boolean;
	attachment: Attachment;
};

type Fields<T> = T extends Date | File | Blob
	? Field
	: T extends Array<infer U>
	  ? Fields<U>[]
	  : T extends object
	    ? { [K in keyof T]-?: Fields<T[K]> }
	    : Field;

type FormState<S extends $ZodType> = {
	data: output<S>;
	errors: any;
	metadata: any;
	defaultData: output<S>;
	wasSubmitted: boolean;
};

const unwrap = (schema: any) => {
	let current = schema;
	while (true) {
		const def = current?._zod?.def;
		if (
			def &&
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
};

function getSchemaAtPath(schema: any, path: (string | number)[]) {
	let current = schema;
	for (const key of path) {
		current = unwrap(current);
		const def = current?._zod?.def;
		if (def?.type === "object") {
			current = (def as any).shape[key];
		} else if (def?.type === "array") {
			current = def.element;
		} else {
			return current;
		}
	}
	return unwrap(current);
}

export function createFields<S extends $ZodType>(
	schema: S,
	state: FormState<S>,
	path: (string | number)[] = [],
	cache = new Map<string, Attachment>(),
): Fields<output<S>> {
	const currentSchema = getSchemaAtPath(schema, path);
	const def = currentSchema?._zod?.def;

	if (def?.type === "array") {
		return new Proxy([] as any, {
			get(_, key) {
				const arr = getAtPath(state.data, path);
				if (key === "length") {
					return Array.isArray(arr) ? arr.length : 0;
				}
				if (typeof key === "string" && !isNaN(Number(key))) {
					return createFields(schema, state, [...path, Number(key)], cache);
				}
				return undefined;
			},
		}) as unknown as Fields<output<S>>;
	}

	if (def?.type === "object") {
		const out: any = {};
		const shape = (def as any).shape;
		for (const k of Object.keys(shape)) {
			out[k] = createFields(schema, state, [...path, k], cache);
		}
		return out;
	}

	const key = path.join(".");

	if (!cache.has(key)) {
		cache.set(key, (node: Element) => {
			const blur = () => (ensurePath(state.metadata, path).blurred = true);
			const focus = () => (ensurePath(state.metadata, path).attached = true);
			const input = () => (ensurePath(state.metadata, path).dirty = true);

			node.addEventListener("blur", blur, true);
			node.addEventListener("focus", focus, true);
			node.addEventListener("input", input, true);

			return () => {
				node.removeEventListener("blur", blur, true);
				node.removeEventListener("focus", focus, true);
				node.removeEventListener("input", input, true);
			};
		});
	}

	const attachment = cache.get(key)!;

	return {
		get errors() {
			state.errors;
			state.metadata;
			state.wasSubmitted;
			getAtPath(state.data, path);

			const eRaw = getAtPath(state.errors, path);
			const m = getAtPath(state.metadata, path);
			const errors = !eRaw ? undefined : Array.isArray(eRaw) ? eRaw : [eRaw];

			if (!errors?.length) return errors;
			if (state.wasSubmitted) return errors;
			if (m?.attached) return m.blurred ? errors : undefined;
			return m?.dirty ? errors : undefined;
		},

		get dirty() {
			const m = getAtPath(state.metadata, path);
			const current = getAtPath(state.data, path);
			const initial = getAtPath(state.defaultData, path);
			return !!(m?.dirty || !equal(current, initial));
		},

		get blurred() {
			return !!getAtPath(state.metadata, path)?.blurred;
		},

		get attached() {
			return !!getAtPath(state.metadata, path)?.attached;
		},

		get touched() {
			const m = getAtPath(state.metadata, path);
			return !!(m?.dirty || m?.blurred || m?.attached);
		},

		attachment,
	} as unknown as Fields<output<S>>;
}
