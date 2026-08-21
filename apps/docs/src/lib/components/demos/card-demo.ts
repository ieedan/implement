import { Div } from "@implementjs/core";
import { Button } from "@/lib/components/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/lib/components/ui/card";
import { Input } from "@/lib/components/ui/input";
import { Label } from "@/lib/components/ui/label";

export default function CardDemo() {
	return Card(
		{ class: "w-full max-w-sm" },
		CardHeader(
			CardTitle("Sign in"),
			CardDescription("Use the email you signed up with."),
			CardAction(Button({ variant: "link", size: "sm" }, "Sign up")),
		),
		CardContent(
			Div(
				{ class: "flex flex-col gap-4" },
				Div(
					{ class: "flex flex-col gap-2" },
					Label({ for: "card-email" }, "Email"),
					Input({ id: "card-email", type: "email", placeholder: "you@example.com" }),
				),
				Div(
					{ class: "flex flex-col gap-2" },
					Label({ for: "card-password" }, "Password"),
					Input({ id: "card-password", type: "password" }),
				),
			),
		),
		CardFooter({ class: "gap-2" }, Button({ class: "flex-1" }, "Sign in")),
	);
}
