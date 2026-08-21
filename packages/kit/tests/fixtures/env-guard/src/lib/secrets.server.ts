export type Secret = { token: string };

export const secret: Secret = { token: "guard-fixture-token" };

export default function read(): Secret {
	return secret;
}
