import { Div, P, Span } from "@implementjs/core";
import { CalendarDaysIcon } from "@implementjs/lucide";
import { Avatar, AvatarFallback, AvatarImage } from "@/lib/components/ui/avatar";
import {
	LinkPreview,
	LinkPreviewContent,
	LinkPreviewPortal,
	LinkPreviewTrigger,
} from "@/lib/components/ui/link-preview";

export default function LinkPreviewDemo() {
	return P(
		{ class: "max-w-sm text-sm text-muted-foreground" },
		"The primitives are unstyled building blocks maintained by ",
		LinkPreview(
			LinkPreviewTrigger(
				{ href: "https://github.com/ieedan", target: "_blank", rel: "noreferrer" },
				"@ieedan",
			),
			LinkPreviewPortal(
				LinkPreviewContent(
					Div(
						{ class: "flex gap-4" },
						Avatar(
							{ class: "size-12" },
							AvatarImage({ src: "https://github.com/ieedan.png", alt: "@ieedan" }),
							AvatarFallback("AB"),
						),
						Div(
							{ class: "space-y-1" },
							Div({ class: "text-sm font-semibold" }, "@ieedan"),
							P({ class: "text-sm" }, "Building implement — a signal-based UI framework."),
							Div(
								{ class: "flex items-center gap-2 pt-1" },
								CalendarDaysIcon({ "aria-hidden": true, class: "size-4 opacity-70" }),
								Span({ class: "text-xs text-muted-foreground" }, "Joined December 2021"),
							),
						),
					),
				),
			),
		),
		".",
	);
}
