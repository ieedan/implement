import { secret } from "./secrets.server";

/** The value a client page wants, in a module that also reaches for a server file. */
export const schema = { name: "issue" };

export function readToken(): string {
	return secret.token;
}
