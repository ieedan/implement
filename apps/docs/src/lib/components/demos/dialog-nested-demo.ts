import { Div, Label, P, Span } from "@implementjs/core";
import { Input } from "@/lib/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/lib/components/ui/avatar";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogTitle,
	DialogTrigger,
} from "@/lib/components/ui/dialog";

function Person(src: string, alt: string, initials: string, name: string, access: string) {
	return Div(
		{ class: "flex items-center gap-3" },
		Avatar({ class: "size-8" }, AvatarImage({ src, alt }), AvatarFallback(initials)),
		Span({ class: "min-w-0 flex-1 text-sm font-medium" }, name),
		Span({ class: "text-xs text-muted-foreground" }, access),
	);
}

export default function DialogNestedDemo() {
	return Dialog(
		DialogTrigger({ variant: "outline" }, "Share"),
		DialogContent(
			Div(
				{ class: "grid gap-1.5" },
				DialogTitle("Share"),
				DialogDescription("Anyone with the link can view this project."),
			),
			Div(
				{ class: "rounded-md border bg-muted/40 px-3 py-2" },
				P({ class: "truncate font-mono text-xs" }, "implementjs.dev/p/aurora"),
			),
			Div(
				{ class: "grid gap-3" },
				Person("https://github.com/ieedan.png", "@ieedan", "AB", "Aidan Bleser", "Owner"),
				Person("https://github.com/github.png", "@github", "GH", "GitHub", "Can edit"),
			),
			Dialog(
				DialogTrigger({ variant: "outline", class: "w-full" }, "Invite"),
				DialogContent(
					Div(
						{ class: "grid gap-1.5" },
						DialogTitle("Invite"),
						DialogDescription("They'll get an email to join this project."),
					),
					Div(
						{ class: "grid gap-2" },
						Label({ for: "invite-email", class: "text-sm" }, "Email"),
						Input({
							id: "invite-email",
							type: "email",
							placeholder: "ada@example.com",
							class: "h-8",
						}),
					),
					DialogClose({ variant: "outline", class: "justify-self-end" }, "Send invite"),
				),
			),
		),
	);
}
