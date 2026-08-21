import { Div, signal, Span } from "@implementjs/core";
import { CalendarIcon, InboxIcon, SearchIcon, SettingsIcon, UsersIcon } from "@implementjs/lucide";
import { Separator } from "@/lib/components/ui/separator";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarInset,
	SidebarMenu,
	SidebarMenuBadge,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarProvider,
	SidebarRail,
	SidebarTrigger,
} from "@/lib/components/ui/sidebar";

const items = [
	{ title: "Inbox", icon: InboxIcon, badge: "12" },
	{ title: "Search", icon: SearchIcon, badge: null },
	{ title: "Calendar", icon: CalendarIcon, badge: null },
	{ title: "Team", icon: UsersIcon, badge: "3" },
];

export default function SidebarDemo() {
	const active = signal("Inbox");

	return Div(
		// A real app mounts the shell at the page root, where the sidebar's
		// `fixed` positioning is what you want. To hold it inside a demo box
		// instead, `transform-gpu` makes this element the containing block for
		// fixed descendants — the shell then treats the box as its viewport.
		{ class: "relative h-96 w-full transform-gpu overflow-hidden rounded-lg border" },
		SidebarProvider(
			{ class: "min-h-full! [--sidebar-width:13rem]", keyboardShortcut: false },
			Sidebar(
				{ collapsible: "icon", class: "h-full!" },
				SidebarHeader(
					Div(
						{ class: "px-2 py-1 text-sm font-semibold group-data-[collapsible=icon]:hidden" },
						"Acme Inc.",
					),
				),
				SidebarContent(
					SidebarGroup(
						SidebarGroupLabel("Workspace"),
						SidebarGroupContent(
							SidebarMenu(
								...items.map((item) =>
									SidebarMenuItem(
										SidebarMenuButton(
											{
												tooltip: item.title,
												isActive: active.get() === item.title,
												onClick: () => active.set(item.title),
											},
											item.icon({ "aria-hidden": true }),
											Span(item.title),
										),
										item.badge ? SidebarMenuBadge(item.badge) : null,
									),
								),
							),
						),
					),
				),
				SidebarFooter(
					SidebarMenu(
						SidebarMenuItem(
							SidebarMenuButton(
								{ tooltip: "Settings" },
								SettingsIcon({ "aria-hidden": true }),
								Span("Settings"),
							),
						),
					),
				),
				SidebarRail(),
			),
			SidebarInset(
				Div(
					{ class: "flex h-12 shrink-0 items-center gap-2 border-b px-3" },
					SidebarTrigger(),
					Separator({ orientation: "vertical", class: "h-4" }),
					Span({ class: "text-sm font-medium" }, active),
				),
				Div(
					{ class: "flex flex-1 items-center justify-center p-6 text-sm text-muted-foreground" },
					"Collapse the sidebar with the button, or the rail on its edge.",
				),
			),
		),
	);
}
