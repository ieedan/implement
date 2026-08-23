import * as v from "valibot";
import { pathName, ROOT_NAME, type Path, type PathKey } from "./path";
import { focusField, formElements, hasErrorsUnder, type InternalFormStore } from "./store";
import type { FieldErrors, FormSchema, ValidationMode } from "./types";

export interface ValidateConfig {
	/** Focus the first field with an error. Off unless the form is submitting. */
	readonly shouldFocus?: boolean | undefined;
}

/** The parts of a valibot issue path the walk reads. */
interface IssuePathItem {
	readonly type: string;
	readonly key?: unknown;
}

/** The path an issue points at, or `null` when it is about the form as a whole. */
function issuePath(issue: v.BaseIssue<unknown>): Path | null {
	if (!issue.path || issue.path.length === 0) return null;
	const path: PathKey[] = [];
	for (const item of issue.path as readonly IssuePathItem[]) {
		// a Map or Set key cannot be addressed as a field, so the issue belongs to
		// the closest field above it
		if (item.type === "map" || item.type === "set") break;
		const { key } = item;
		if (typeof key !== "string" && typeof key !== "number") break;
		path.push(key);
	}
	return path.length === 0 ? null : path;
}

/**
 * Validates the whole form input and spreads the issues over the fields they
 * belong to. Only the newest validation may write, so a slow async schema
 * settling late cannot overwrite fresher errors.
 */
export async function validateInput(
	store: InternalFormStore,
	config?: ValidateConfig,
): Promise<v.SafeParseResult<FormSchema>> {
	const validationId = ++store.validationId;
	store.isValidating.set(true);

	let result: v.SafeParseResult<FormSchema>;
	try {
		// the input already holds every field the schema names, seeded when the
		// form was created — there is no DOM to read the empty ones back from,
		// and a field nobody rendered validates the same as one nobody typed in
		result = await v.safeParseAsync(store.schema, store.input.get());
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
