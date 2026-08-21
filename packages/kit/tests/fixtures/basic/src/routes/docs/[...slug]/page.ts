import { P, type Child, type Readable } from "@implementjs/core";

export default function Page({ params }: { params: { slug: Readable<string> } }): Child {
	return P(params.slug);
}
