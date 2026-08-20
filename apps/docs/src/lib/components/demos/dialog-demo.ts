import { Div, Input, Label, Span, Switch, signal } from "@implementjs/core";
import { CrownIcon, ShieldCheckIcon, UserIcon, type IconComponent } from "@implementjs/lucide";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogOverlay,
	DialogPortal,
	DialogTitle,
	DialogTrigger,
} from "@/lib/components/ui/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/lib/components/ui/select";

function Field(id: string, label: string, value: string) {
	return Div(
		{ class: "grid grid-cols-4 items-center gap-4" },
		Label({ for: id, class: "text-sm" }, label),
		Input({
			id,
			value,
			class:
				"col-span-3 h-8 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
		}),
	);
}

const roles: { value: string; label: string; icon: IconComponent }[] = [
	{ value: "user", label: "User", icon: UserIcon },
	{ value: "moderator", label: "Moderator", icon: ShieldCheckIcon },
	{ value: "admin", label: "Admin", icon: CrownIcon },
];

function RoleIcon(icon: IconComponent) {
	return icon({ class: "size-4 shrink-0", "aria-hidden": true });
}

export default function DialogDemo() {
	const role = signal("user");

	return Dialog(
		{},
		DialogTrigger({ variant: "outline" }, "Edit profile"),
		DialogPortal(
			DialogOverlay({}),
			DialogContent(
				{},
				Div(
					{ class: "grid gap-1.5" },
					DialogTitle({}, "Edit profile"),
					DialogDescription({}, "Make changes to your profile here. Click save when you're done."),
				),
				Div(
					{ class: "grid gap-3" },
					Field("name", "Name", "Aidan Bleser"),
					Field("username", "Username", "@ieedan"),
					Div(
						{ class: "grid grid-cols-4 items-center gap-4" },
						Label({ for: "role", class: "text-sm" }, "Role"),
						Div(
							{ class: "col-span-3" },
							Select(
								{ value: role },
								SelectTrigger(
									{ id: "role" },
									Span(
										{ class: "flex min-w-0 flex-1 items-center gap-2" },
										Switch(role)
											.Case("user", RoleIcon(UserIcon))
											.Case("moderator", RoleIcon(ShieldCheckIcon))
											.Case("admin", RoleIcon(CrownIcon)),
										SelectValue({
											placeholder: "Select a role",
											label: (id) => roles.find((item) => item.value === id)?.label ?? id,
										}),
									),
								),
								SelectContent(
									{},
									...roles.map((item) =>
										SelectItem(
											{ value: item.value },
											Span({ class: "flex items-center gap-2" }, RoleIcon(item.icon), item.label),
										),
									),
								),
							),
						),
					),
				),
				DialogClose({ variant: "outline", class: "w-full" }, "Save changes"),
			),
		),
	);
}
