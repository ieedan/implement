import { P, type Child } from "@implementjs/core";

export default function ErrorPage({ error }: { error: { message: string } }): Child {
	return P(`error: ${error.message}`);
}
