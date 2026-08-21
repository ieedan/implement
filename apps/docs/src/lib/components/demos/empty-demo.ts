import { PlusIcon, InboxIcon } from "@implementjs/lucide";
import { Button } from "@/lib/components/ui/button";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/lib/components/ui/empty";

export default function EmptyDemo() {
	return Empty(
		{ class: "w-full max-w-md border" },
		EmptyHeader(
			EmptyMedia({ variant: "icon" }, InboxIcon({ "aria-hidden": true })),
			EmptyTitle("No projects yet"),
			EmptyDescription("Projects group your deployments, domains, and environment variables."),
		),
		EmptyContent(Button({ size: "sm" }, PlusIcon({ "aria-hidden": true }), "New project")),
	);
}
