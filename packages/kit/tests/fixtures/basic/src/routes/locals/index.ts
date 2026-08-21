import { derived, P, type Child, type Readable } from "@implementjs/core";

export default function Page({ data }: { data: Readable<{ user?: string | null }> }): Child {
	return P(derived([data], (value) => `hello ${value.user ?? "nobody"}`));
}
