import type { Attachment } from "svelte/attachments";
import equal from "fast-deep-equal";

const getAtPath = (obj: any, path: (string | number)[]) =>
	path.reduce((acc, key) => acc?.[key], obj);

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

const isLeaf = (v: any) =>
	v instanceof Date || v instanceof File || v instanceof Blob;

export function createFields<S>(
	getRoot: () => S,
	getErrors: () => any,
	getMetadata: () => any,
	getDefault: () => S,
	getIsSubmitted: () => boolean,
	path: (string | number)[] = [],
	cache = new Map<string, Attachment>(),
): Fields<S> {
	const value = getAtPath(getRoot(), path);
	const shape = getAtPath(getDefault(), path);

	if (Array.isArray(shape)) {
		const arr = Array.isArray(value) ? value : [];
		return arr.map((_, i) =>
			createFields(
				getRoot,
				getErrors,
				getMetadata,
				getDefault,
				getIsSubmitted,
				[...path, i],
				cache,
			),
		) as unknown as Fields<S>;
	}

	if (shape && typeof shape === "object" && !isLeaf(shape)) {
		const out: any = {};
		for (const k of Object.keys(shape)) {
			out[k] = createFields(
				getRoot,
				getErrors,
				getMetadata,
				getDefault,
				getIsSubmitted,
				[...path, k],
				cache,
			);
		}
		return out;
	}

	const key = path.map(String).join(".");

	if (!cache.has(key)) {
		cache.set(key, (node: Element) => {
			const blur = () => {
				const m = getAtPath(getMetadata(), path);
				if (m) m.blurred = true;
			};
			const focus = () => {
				const m = getAtPath(getMetadata(), path);
				if (m) m.attached = true;
			};
			node.addEventListener("blur", blur, true);
			node.addEventListener("focus", focus, true);
			return () => {
				node.removeEventListener("blur", blur, true);
				node.removeEventListener("focus", focus, true);
			};
		});
	}

	const getMeta = () => getAtPath(getMetadata(), path);

	const getErrorsAtPath = (): string[] | undefined => {
		const e = getAtPath(getErrors(), path);
		if (!e) return undefined;
		return Array.isArray(e) ? e : [e];
	};

	return {
		get errors() {
			const e = getErrorsAtPath();
			if (!e?.length) return e;

			const m = getMeta();

			if (getIsSubmitted()) return e;

			if (m?.attached) return m.blurred ? e : undefined;

			return m?.dirty ? e : undefined;
		},
		get dirty() {
			const m = getMeta();
			if (m?.dirty) return true;

			const current = getAtPath(getRoot(), path);
			const initial = getAtPath(getDefault(), path);

			return !equal(current, initial);
		},
		get blurred() {
			return !!getMeta()?.blurred;
		},
		get attached() {
			return !!getMeta()?.attached;
		},
		get touched() {
			const m = getMeta();
			return !!(m?.dirty || m?.blurred || m?.attached);
		},
		attachment: cache.get(key)!,
	} as unknown as Fields<S>;
}
