import equal from "fast-deep-equal";
import type { Attachment } from "svelte/attachments";

function getAtPath(obj: any, path: (string | number)[]) {
	let current = obj;
	for (const key of path) current = current?.[key];
	return current;
}

function setAtPath(obj: any, path: (string | number)[], value: any) {
	let current = obj;
	for (let i = 0; i < path.length - 1; i++) {
		current = current[path[i]];
	}
	current[path[path.length - 1]] = value;
}

export function createFields<T>(
	getRoot: () => T,
	getErrors: () => any,
	getMetadata: () => any,
	getDefault: () => T,
	getIsSubmitted: () => boolean,
	path: (string | number)[] = [],
	attachmentCache = new Map<string, Attachment>(),
): any {
	const value = getAtPath(getRoot(), path);

	const isLeafObject =
		value instanceof Date || value instanceof File || value instanceof Blob;

	if (Array.isArray(value)) {
		return value.map((_, i) =>
			createFields(
				getRoot,
				getErrors,
				getMetadata,
				getDefault,
				getIsSubmitted,
				[...path, i],
				attachmentCache,
			),
		) as any;
	}

	if (typeof value === "object" && value !== null && !isLeafObject) {
		const result: any = {};

		for (const key in value) {
			result[key] = createFields(
				getRoot,
				getErrors,
				getMetadata,
				getDefault,
				getIsSubmitted,
				[...path, key],
				attachmentCache,
			);
		}

		return result;
	}

	const keyPath = path.join(".");

	if (!attachmentCache.has(keyPath)) {
		attachmentCache.set(keyPath, (node: Element) => {
			const handleBlur = () => {
				const meta = getAtPath(getMetadata(), path);
				if (meta) meta.blurred = true;
			};

			const handleFocus = () => {
				const meta = getAtPath(getMetadata(), path);
				if (meta) meta.attached = true;
			};

			node.addEventListener("blur", handleBlur, true);
			node.addEventListener("focus", handleFocus, true);

			return () => {
				node.removeEventListener("blur", handleBlur, true);
				node.removeEventListener("focus", handleFocus, true);
			};
		});
	}

	return {
		get value() {
			return getAtPath(getRoot(), path);
		},

		set value(v: any) {
			const current = getAtPath(getRoot(), path);

			if (!equal(current, v)) {
				setAtPath(getRoot(), path, v);

				const meta = getAtPath(getMetadata(), path);
				const initial = getAtPath(getDefault(), path);

				if (meta && !meta.dirty && !equal(v, initial)) {
					meta.dirty = true;
				}
			}
		},

		get error() {
			const error = getAtPath(getErrors(), path);
			if (!error) return error;

			const meta = getAtPath(getMetadata(), path);

			if (getIsSubmitted()) return error;

			if (meta?.attached) {
				return meta.blurred ? error : undefined;
			}

			return meta?.dirty ? error : undefined;
		},

		get dirty() {
			return getAtPath(getMetadata(), path)?.dirty;
		},

		get blurred() {
			return getAtPath(getMetadata(), path)?.blurred;
		},

		get attached() {
			return getAtPath(getMetadata(), path)?.attached;
		},

		get touched() {
			const m = getAtPath(getMetadata(), path);
			return m?.dirty || m?.blurred || m?.attached;
		},

		attachment: attachmentCache.get(keyPath)!,
	} as any;
}
