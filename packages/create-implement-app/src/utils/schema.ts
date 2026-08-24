import { err, ok, type Result } from "nevereverthrow";
import * as v from "valibot";

/** Validate `value` against `schema` without throwing. */
export function safeValidate<TSchema extends v.GenericSchema>(
	schema: TSchema,
	value: unknown,
): Result<v.InferOutput<TSchema>, { issues: readonly v.BaseIssue<unknown>[] }> {
	const parsed = v.safeParse(schema, value);
	if (!parsed.success) return err({ issues: parsed.issues });
	return ok(parsed.output);
}
