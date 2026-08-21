import { P, type Child } from "@implementjs/core";
// type-only imports never reach the module graph, so the guard never sees them
import type load from "../secrets/index.server";

type Data = ReturnType<typeof load>;

export default function Page(): Child {
	const label: keyof Data = "site";
	return P(label);
}
