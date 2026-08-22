import { derived, P, type Child, type Readable } from "@implementjs/core";

type Data = { shared?: string; message?: string };

export default function Page({ data }: { data: Readable<Data> }): Child {
	return P(derived([data], (value) => `${value.shared ?? "?"} / ${value.message ?? "?"}`));
}
