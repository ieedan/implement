import { Div, Label, Input, P } from "@implementjs/core";
import { Button } from "@/lib/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/lib/components/ui/tabs";

function Field(id: string, label: string, value: string) {
	return Div(
		{ class: "grid gap-1.5" },
		Label({ for: id, class: "text-sm font-medium" }, label),
		Input({
			id,
			value,
			class:
				"h-8 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
		}),
	);
}

export default function TabsDemo() {
	return Tabs(
		{ value: "account", class: "w-full max-w-sm" },
		TabsList(
			{ class: "w-full" },
			TabsTrigger({ value: "account" }, "Account"),
			TabsTrigger({ value: "password" }, "Password"),
		),
		TabsContent(
			{ value: "account", class: "grid gap-3 rounded-lg border p-4" },
			P(
				{ class: "text-sm text-muted-foreground" },
				"Change your name here. You're done when you save.",
			),
			Field("tabs-demo-name", "Name", "Aidan Bleser"),
			Button({ size: "sm", class: "w-fit" }, "Save changes"),
		),
		TabsContent(
			{ value: "password", class: "grid gap-3 rounded-lg border p-4" },
			P(
				{ class: "text-sm text-muted-foreground" },
				"Pick a new password. You'll be signed out elsewhere.",
			),
			Field("tabs-demo-password", "New password", ""),
			Button({ size: "sm", class: "w-fit" }, "Save password"),
		),
	);
}
