import { P, type Child, type Readable } from "@implementjs/core";

export default function Page({ params }: { params: { id: Readable<number> } }): Child {
	return P("order #", params.id);
}
