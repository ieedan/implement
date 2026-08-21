import { derived, P, type Child, type Readable } from "@implementjs/core";

type Data = { user?: string };

export default function Page({ data }: { data: Readable<Data> }): Child {
	return P(derived([data], (value) => `hello ${value.user ?? "?"}`));
}
