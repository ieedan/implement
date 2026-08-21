import {
	getAtPath,
	isFieldName,
	namePath,
	pathName,
	ROOT_NAME,
	setAtPath,
	type Path,
	type PathKey,
} from "./path";
import { getElementInput, isArrayField, isTextLike } from "./element";
import { focusField, formElements, hasErrorsUnder, type InternalFormStore } from "./store";
import type { StandardIssue, StandardResult } from "./standard-schema";
import type { FieldErrors, ValidationMode } from "./types";

export interface ValidateConfig {
	/** Focus the first field with an error. Off unless the form is submitting. */
	readonly shouldFocus?: boolean | undefined;
}

/** The path an issue points at, or `null` when it is about the form as a whole. */
function issuePath(issue: StandardIssue): Path | null {
	if (!issue.path || issue.path.length === 0) return null;
	const path: PathKey[] = [];
	for (const segment of issue.path) {
		const key = typeof segment === "object" ? segment.key : segment;
		// a Map or Set key cannot be addressed as a field, so the issue belongs to
		// the closest field above it
		if (typeof key !== "string" && typeof key !== "number") break;
		path.push(key);
	}
	return path.length === 0 ? null : path;
}

/**
 * The input the schema is validated against: what the fields hold, plus a
 * starting value for the ones that hold nothing yet but are on screen. A text
 * input the user never typed in shows as empty, so it validates as `""` and
 * the schema answers with its own message ("Please enter your email") instead
 * of a type error about `undefined`.
 */
export function getValidationInput(store: InternalFormStore): Record<string, unknown> {
	let input = store.input.get();
	const seeded = new Set<string>();

	// an array field with nothing in it yet is an empty list, not a missing one
	for (const name of store.arrayFields) {
		const path = namePath(name);
		if (getAtPath(input, path) !== undefined) continue;
		seeded.add(name);
		input = setAtPath(input, path, []) as Record<string, unknown>;
	}

	for (const element of formElements(store)) {
		// someone else's named input inside the form is not ours to fill in
		if (seeded.has(element.name) || !isFieldName(element.name)) continue;
		const path = namePath(element.name);
		if (getAtPath(input, path) !== undefined) continue;
		seeded.add(element.name);

		if (isArrayField(store, path, undefined, element)) {
			input = setAtPath(input, path, getElementInput(store, element, path, true)) as Record<
				string,
				unknown
			>;
			continue;
		}
		if (element instanceof HTMLInputElement && element.type === "checkbox") {
			input = setAtPath(input, path, element.checked) as Record<string, unknown>;
			continue;
		}
		if (isTextLike(element)) {
			input = setAtPath(input, path, "") as Record<string, unknown>;
		}
	}

	return input;
}

/**
 * Validates the whole form input and spreads the issues over the fields they
 * belong to. Only the newest validation may write, so a slow async schema
 * settling late cannot overwrite fresher errors.
 */
export async function validateInput(
	store: InternalFormStore,
	config?: ValidateConfig,
): Promise<StandardResult<unknown>> {
	const validationId = ++store.validationId;
	store.isValidating.set(true);

	let result: StandardResult<unknown>;
	try {
		result = await store.schema["~standard"].validate(getValidationInput(store));
	} catch (error) {
		if (store.validationId === validationId) store.isValidating.set(false);
		throw error;
	}

	if (store.validationId !== validationId) return result;

	const errors = new Map<string, FieldErrors>();
	if (result.issues) {
		for (const issue of result.issues) {
			const path = issuePath(issue);
			const name = path === null ? ROOT_NAME : pathName(path);
			const current = errors.get(name);
			if (current) current.push(issue.message);
			else errors.set(name, [issue.message]);
		}
	}
	store.errors.set(errors);

	// document order, so the field the user reaches first is the one that gets
	// the focus — not whichever issue the schema happened to report first
	if (config?.shouldFocus && errors.size > 0) {
		for (const element of formElements(store)) {
			if (!errors.has(element.name)) continue;
			if (focusField(store, element.name)) break;
		}
	}

	// rechecked: focusing a field can blur another one, and that blur may have
	// started a newer validation whose validating state must survive
	if (store.validationId === validationId) store.isValidating.set(false);

	return result;
}

/**
 * Validates when the event that just happened is the one the form validates
 * on. A field that already has errors (or a form that has been submitted)
 * switches to the revalidation mode, which is usually the more eager of the
 * two.
 */
export function validateIfRequired(
	store: InternalFormStore,
	path: Path,
	mode: ValidationMode,
): void {
	const eager =
		store.validate === "initial" ||
		(store.validate === "submit"
			? store.isSubmitted.get()
			: hasErrorsUnder(store.errors.get(), path));

	if (mode === (eager ? store.revalidate : store.validate)) {
		void validateInput(store);
	}
}
