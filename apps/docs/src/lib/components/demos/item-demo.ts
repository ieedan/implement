import { BellIcon, ChevronRightIcon } from "@implementjs/lucide";
import { Badge } from "@/lib/components/ui/badge";
import { Button } from "@/lib/components/ui/button";
import {
	Item,
	ItemActions,
	ItemContent,
	ItemDescription,
	ItemGroup,
	ItemMedia,
	ItemSeparator,
	ItemTitle,
} from "@/lib/components/ui/item";
import { Switch } from "@/lib/components/ui/switch";

export default function ItemDemo() {
	return ItemGroup(
		{ class: "w-full max-w-md rounded-lg border" },
		Item(
			ItemMedia({ variant: "icon" }, BellIcon({ "aria-hidden": true })),
			ItemContent(
				ItemTitle("Notifications", Badge({ variant: "secondary" }, "New")),
				ItemDescription("Get told when a deployment finishes or a build breaks."),
			),
			ItemActions(Switch({ checked: true, "aria-label": "Notifications" })),
		),
		ItemSeparator(),
		Item(
			{ size: "sm" },
			ItemContent(ItemTitle("Billing")),
			ItemActions(
				Button(
					{ variant: "ghost", size: "icon-sm", "aria-label": "Open billing" },
					ChevronRightIcon(),
				),
			),
		),
	);
}
