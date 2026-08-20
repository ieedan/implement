import type { Result } from "nevereverthrow";

/** `Result` helpers that fail the test instead of the type checker. */
export function unwrap<T, E extends Error>(result: Result<T, E>): T {
	if (result.isErr()) throw result.error;
	return result.value;
}

export function unwrapErr<T, E extends Error>(result: Result<T, E>): E {
	if (result.isOk()) throw new Error("Expected an error");
	return result.error;
}
