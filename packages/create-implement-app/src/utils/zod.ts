import { err, ok, type Result } from "nevereverthrow";
import type { z } from "zod";

/** Validate `value` against `schema` without throwing. */
export function safeValidate<T>(
	schema: z.ZodSchema<T>,
	value: unknown,
): Result<T, { zodError: z.ZodError }> {
	const parsed = schema.safeParse(value);
	if (!parsed.success) return err({ zodError: parsed.error });
	return ok(parsed.data);
}
