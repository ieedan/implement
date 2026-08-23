import { P, type Child } from "@implementjs/core";
// legal on its face — the violation is a hop further in, inside issue-schema
import { schema } from "@/lib/issue-schema";

export default function Page(): Child {
	return P(schema.name);
}
