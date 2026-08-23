import { pathName, type Path } from "./path";
import { fieldElements, readInput, type InternalFormStore } from "./store";
import type { FieldElement } from "./types";

/**
 * Whether a field holds a list. The schema answers for every field it names,
 * then the value the field already holds, then the element itself — a
 * `multiple` select or file input is a list even before anything is picked.
 * Pass `array` on the field config for the rest: a group the schema cannot see
 * into, such as one branch of a union.
 */
export function isArrayField(
	store: InternalFormStore,
	path: Path,
	explicit: boolean | undefined,
	element?: FieldElement,
): boolean {
	if (explicit !== undefined) return explicit;
	if (store.arrayFields.has(pathName(path))) return true;
	if (Array.isArray(readInput(store, path))) return true;
	if (element instanceof HTMLSelectElement) return element.multiple;
	if (element instanceof HTMLInputElement && element.type === "file") return element.multiple;
	return false;
}

/**
 * What an element currently holds, as the field should store it. Text inputs
 * read back as strings, so a field typed as a number or a date needs a
 * handler of its own that converts before calling `setInput`.
 */
export function getElementInput(
	store: InternalFormStore,
	element: FieldElement,
	path: Path,
	isArray: boolean,
): unknown {
	if (element instanceof HTMLSelectElement) {
		if (!isArray) return element.value;
		return [...element.options]
			.filter((option) => option.selected && !option.disabled)
			.map((option) => option.value);
	}

	if (element instanceof HTMLInputElement) {
		if (element.type === "checkbox") {
			if (!isArray) return element.checked;
			return fieldElements(store, element.name)
				.filter(
					(option): option is HTMLInputElement =>
						option instanceof HTMLInputElement && option.checked && !option.disabled,
				)
				.map((option) => option.value);
		}

		// an unchecked radio says nothing about the field: the checked one in the
		// group already reported the value
		if (element.type === "radio") {
			return element.checked ? element.value : readInput(store, path);
		}

		if (element.type === "file") {
			const files = [...(element.files ?? [])];
			return isArray ? files : files[0];
		}
	}

	return element.value;
}
