import type * as v from "valibot";
import {
	bump,
	focusFieldElement,
	getFieldBool,
	getFieldInput,
	pathKey,
	walkFieldStore,
} from "./store";
import type {
	FieldErrors,
	FormSchema,
	InternalFieldStore,
	InternalFormStore,
	ValidationMode,
} from "./types";

export interface ValidateConfig {
	/** Focus the first field with an error. Off unless the form is submitting. */
	readonly shouldFocus?: boolean | undefined;
}

/** The parts of a valibot issue path the walk reads. */
interface IssuePathItem {
	readonly type: string;
	readonly key?: unknown;
}

/** The name of the field an issue belongs to, or `null` when it is the form's own. */
function issueName(issue: v.BaseIssue<unknown>): string | null {
	if (!issue.path) return null;
	const path: (string | number)[] = [];
	for (const item of issue.path as readonly IssuePathItem[]) {
		// a Map or Set key cannot be addressed as a field, so the issue belongs to
		// the closest field above it
		if (item.type === "map" || item.type === "set") break;
		const { key } = item;
		if (typeof key !== "string" && typeof key !== "number") break;
		path.push(key);
	}
	return pathKey(path);
}

/**
 * Validates the whole form input and spreads the issues over the fields they
 * belong to. Only the newest validation may write, so a slow async schema
 * settling late cannot overwrite fresher errors.
 */
export async function validateFormInput<TSchema extends FormSchema>(
	form: InternalFormStore<TSchema>,
	config?: ValidateConfig,
): Promise<v.SafeParseResult<TSchema>> {
	const validationId = ++form.validationId;
	form.isValidating.set(true);
	bump(form);

	let result: v.SafeParseResult<TSchema>;
	try {
		// the input already holds every field the schema names, seeded when the
		// form was created — a field nobody rendered validates the same as one
		// nobody typed into
		result = await form.parse(getFieldInput(form));
	} catch (error) {
		if (form.validationId === validationId) {
			form.isValidating.set(false);
			bump(form);
		}
		throw error;
	}

	// an older validation that settles late may not write over a newer one's
	// errors, nor clear the validating state it owns
	if (form.validationId !== validationId) return result;

	let rootErrors: FieldErrors | undefined;
	const nestedErrors = new Map<string, FieldErrors>();

	for (const issue of result.issues ?? []) {
		const name = issueName(issue);
		if (name === null) {
			if (rootErrors) rootErrors.push(issue.message);
			else rootErrors = [issue.message];
			continue;
		}
		const current = nestedErrors.get(name);
		if (current) current.push(issue.message);
		else nestedErrors.set(name, [issue.message]);
	}

	let shouldFocus = config?.shouldFocus ?? false;

	walkFieldStore(form, (field) => {
		if (field.path.length === 0) {
			field.errors.set(rootErrors ?? null);
			return;
		}
		const errors = nestedErrors.get(pathKey(field.path)) ?? null;
		field.errors.set(errors);
		// the first erroring field whose element can actually take the focus gets
		// it, so a field nothing is rendering for does not swallow it
		if (shouldFocus && errors && focusFieldElement(field)) shouldFocus = false;
	});

	// rechecked: focusing a field can blur another one, and that blur may have
	// started a newer validation whose validating state must survive
	if (form.validationId === validationId) form.isValidating.set(false);
	bump(form);

	return result;
}

/**
 * Validates when the event that just happened is the one the form validates
 * on. A field that already has errors — or a form that has been submitted —
 * switches to the revalidation mode, which is usually the more eager of the
 * two.
 */
export function validateIfRequired(
	form: InternalFormStore,
	field: InternalFieldStore,
	mode: ValidationMode,
): void {
	const eager =
		form.validate === "initial" ||
		(form.validate === "submit" ? form.isSubmitted.get() : getFieldBool(field, "errors"));

	if (mode === (eager ? form.revalidate : form.validate)) {
		void validateFormInput(form);
	}
}
