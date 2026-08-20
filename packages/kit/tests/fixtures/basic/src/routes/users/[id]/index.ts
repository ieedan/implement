import { P, type Child, type Readable } from "@implementjs/core";

export default function Page({ params }: { params: { id: Readable<string> } }): Child {
	return P("user ", params.id);
}
