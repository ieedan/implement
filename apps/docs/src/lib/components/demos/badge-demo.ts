import { Div } from "@implementjs/core";
import { CircleCheckIcon } from "@implementjs/lucide";
import { Badge } from "@/lib/components/ui/badge";

export default function BadgeDemo() {
	return Div(
		{ class: "flex flex-wrap items-center justify-center gap-2" },
		Badge("Default"),
		Badge({ variant: "secondary" }, "Secondary"),
		Badge({ variant: "outline" }, "Outline"),
		Badge({ variant: "destructive" }, "Destructive"),
		Badge(CircleCheckIcon({ "aria-hidden": true }), "Verified"),
		Badge({ variant: "secondary", class: "rounded-full px-1.5 tabular-nums" }, "8"),
	);
}
