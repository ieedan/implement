import { derived, P, type Child, type Readable } from "@implementjs/core";

type Data = { token?: string; ttl?: number };

export default function Page({ data }: { data: Readable<Data> }): Child {
	return P(derived([data], (value) => `${value.token ?? "?"} for ${value.ttl ?? "?"}s`));
}
