import { P, type Child } from "@implementjs/core";
import { greeting } from "@/lib/greeting.ts";

export default function Page(): Child {
	return P(greeting);
}
