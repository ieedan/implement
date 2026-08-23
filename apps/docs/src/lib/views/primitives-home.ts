import {
	A,
	Div,
	H1,
	H2,
	ImplementHead,
	Label,
	Main,
	navigateTo,
	P,
	signal,
	Span,
	type Mountable,
} from "@implementjs/core";
import {
	BoldIcon,
	CalendarDaysIcon,
	CheckIcon,
	ChevronDownIcon,
	ChevronsUpDownIcon,
	ItalicIcon,
	SearchIcon,
	UnderlineIcon,
} from "@implementjs/lucide";
import { SiteHeader } from "../components/site-header";
import { ogTags } from "../og-tags";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "../components/ui/accordion";
import { AspectRatio } from "../components/ui/aspect-ratio";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Button } from "../components/ui/button";
import { Checkbox } from "../components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../components/ui/collapsible";
import { Meter } from "../components/ui/meter";
import { Progress } from "../components/ui/progress";
import { RadioGroup, RadioGroupItem } from "../components/ui/radio-group";
import { RatingGroup, RatingGroupItem } from "../components/ui/rating-group";
import { Separator } from "../components/ui/separator";
import { Switch } from "../components/ui/switch";
import { Toggle } from "../components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "../components/ui/toggle-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { primitivePages, type PrimitivePage } from "@/lib/content";
import { router } from "$implement/router";

function AccordionPreview(): Mountable {
	return Accordion(
		{ class: "w-full max-w-md" },
		AccordionItem(
			{ value: "what" },
			AccordionTrigger("What is implement?"),
			AccordionContent("A signal-based UI framework with no compiler."),
		),
		AccordionItem(
			{ value: "why" },
			AccordionTrigger("Why no compiler?"),
			AccordionContent("Your app is plain TypeScript that builds real DOM nodes."),
		),
		AccordionItem(
			{ value: "styling" },
			AccordionTrigger("How do I style it?"),
			AccordionContent("Every part exposes data attributes, so plain CSS works."),
		),
	);
}

function AvatarPreview(): Mountable {
	return Div(
		{
			class: "flex -space-x-3 *:data-[slot=avatar]:ring-2 *:data-[slot=avatar]:ring-background",
		},
		Avatar(
			{ class: "size-12" },
			AvatarImage({ src: "https://github.com/ieedan.png", alt: "" }),
			AvatarFallback("AB"),
		),
		Avatar(
			{ class: "size-12" },
			AvatarImage({ src: "https://github.com/github.png", alt: "" }),
			AvatarFallback("GH"),
		),
		Avatar({ class: "size-12" }, AvatarFallback("+3")),
	);
}

function LinkPreviewPreview(): Mountable {
	return Div(
		{ class: "flex w-full max-w-72 flex-col items-center gap-3" },
		P(
			{ class: "text-sm text-muted-foreground" },
			"Maintained by ",
			Span({ class: "font-medium text-foreground underline underline-offset-4" }, "@ieedan"),
			".",
		),
		Div(
			{
				class:
					"flex w-full gap-3 rounded-md border bg-popover p-3 text-popover-foreground shadow-md",
			},
			Avatar(
				{ class: "size-10" },
				AvatarImage({ src: "https://github.com/ieedan.png", alt: "" }),
				AvatarFallback("AB"),
			),
			Div(
				{ class: "space-y-1" },
				Div({ class: "text-sm font-semibold" }, "@ieedan"),
				P(
					{ class: "text-xs text-muted-foreground" },
					"Building implement \u2014 a signal-based UI framework.",
				),
				Div(
					{ class: "flex items-center gap-2 pt-0.5" },
					CalendarDaysIcon({
						"aria-hidden": true,
						class: "size-3.5 opacity-70",
					}),
					Span({ class: "text-xs text-muted-foreground" }, "Joined December 2021"),
				),
			),
		),
	);
}

function PopoverPreview(): Mountable {
	return Div(
		{ class: "flex w-full max-w-64 flex-col items-center gap-3" },
		Button({ variant: "outline", size: "sm" }, "Open popover"),
		Div(
			{
				class: "w-full rounded-md border bg-popover p-3 text-popover-foreground shadow-md",
			},
			Div({ class: "text-sm font-medium" }, "Dimensions"),
			P({ class: "mt-1 text-xs text-muted-foreground" }, "Set the dimensions for the layer."),
			Div(
				{ class: "mt-3 grid gap-2" },
				Div(
					{ class: "grid grid-cols-3 items-center gap-2" },
					Span({ class: "text-xs text-muted-foreground" }, "Width"),
					Span(
						{
							class: "col-span-2 rounded-md border border-input px-2 py-1 text-xs tabular-nums",
						},
						"100%",
					),
				),
				Div(
					{ class: "grid grid-cols-3 items-center gap-2" },
					Span({ class: "text-xs text-muted-foreground" }, "Height"),
					Span(
						{
							class: "col-span-2 rounded-md border border-input px-2 py-1 text-xs tabular-nums",
						},
						"25px",
					),
				),
			),
		),
	);
}

function CollapsiblePreview(): Mountable {
	return Collapsible(
		{ class: "w-full max-w-64", open: true },
		Div(
			{ class: "flex items-center justify-between gap-2" },
			Span({ class: "text-sm font-semibold" }, "Starred packages"),
			CollapsibleTrigger(
				{ size: "icon-sm" },
				ChevronsUpDownIcon({ "aria-hidden": true, class: "size-4" }),
				Span({ class: "sr-only" }, "Toggle"),
			),
		),
		Div({ class: "rounded-md border px-3 py-2 font-mono text-xs" }, "@implementjs/core"),
		CollapsibleContent(
			{ class: "flex flex-col gap-2" },
			Div({ class: "rounded-md border px-3 py-2 font-mono text-xs" }, "@implementjs/primitives"),
			Div({ class: "rounded-md border px-3 py-2 font-mono text-xs" }, "@implementjs/lucide"),
		),
	);
}

function CheckboxPreview(): Mountable {
	return Div(
		{ class: "flex w-full max-w-56 flex-col gap-3" },
		Div(
			{ class: "flex items-center gap-2" },
			Checkbox({ checked: true }),
			Label({ class: "text-sm leading-none font-medium" }, "Send updates"),
		),
		Div(
			{ class: "flex items-center gap-2" },
			Checkbox({ indeterminate: true }),
			Label({ class: "text-sm leading-none font-medium" }, "Select all"),
		),
		Div(
			{ class: "flex items-center gap-2" },
			Checkbox(),
			Label({ class: "text-sm leading-none font-medium" }, "Accept terms"),
		),
	);
}

function SwitchPreview(): Mountable {
	return Div(
		{ class: "flex w-full max-w-56 flex-col gap-3" },
		Div(
			{ class: "flex items-center gap-2" },
			Switch({ checked: true }),
			Label({ class: "text-sm leading-none font-medium" }, "Airplane mode"),
		),
		Div(
			{ class: "flex items-center gap-2" },
			Switch(),
			Label({ class: "text-sm leading-none font-medium" }, "Marketing emails"),
		),
		Div(
			{ class: "flex items-center gap-2" },
			Switch({ checked: true, disabled: true }),
			Label({ class: "text-sm leading-none font-medium opacity-50" }, "Disabled"),
		),
	);
}

function MeterPreview(): Mountable {
	return Div(
		{ class: "flex w-full max-w-56 flex-col gap-4" },
		Div(
			{ class: "flex flex-col gap-2" },
			Div(
				{ class: "flex items-center justify-between text-sm font-medium" },
				Span("Storage"),
				Span({ class: "text-muted-foreground tabular-nums" }, "75%"),
			),
			Meter({ value: 75, "aria-label": "Storage used" }),
		),
		Div(
			{ class: "flex flex-col gap-2" },
			Div(
				{ class: "flex items-center justify-between text-sm font-medium" },
				Span("Battery"),
				Span({ class: "text-muted-foreground tabular-nums" }, "30%"),
			),
			Meter({ value: 30, "aria-label": "Battery level" }),
		),
	);
}

function ProgressPreview(): Mountable {
	return Div(
		{ class: "flex w-full max-w-56 flex-col gap-4" },
		Div(
			{ class: "flex flex-col gap-2" },
			Div(
				{ class: "flex items-center justify-between text-sm font-medium" },
				Span("Uploading photos"),
				Span({ class: "text-muted-foreground tabular-nums" }, "66%"),
			),
			Progress({ value: 66, "aria-label": "Uploading photos" }),
		),
		Div(
			{ class: "flex flex-col gap-2" },
			Div({ class: "text-sm font-medium" }, "Preparing"),
			Progress({ value: null, "aria-label": "Preparing" }),
		),
	);
}

function TogglePreview(): Mountable {
	return Div(
		{ class: "flex items-center gap-1" },
		Toggle({ pressed: true, "aria-label": "Toggle bold" }, BoldIcon({ "aria-hidden": true })),
		Toggle({ pressed: true, "aria-label": "Toggle italic" }, ItalicIcon({ "aria-hidden": true })),
		Toggle({ "aria-label": "Toggle underline" }, UnderlineIcon({ "aria-hidden": true })),
	);
}

function AspectRatioPreview(): Mountable {
	return Div(
		{ class: "w-full max-w-56" },
		AspectRatio(
			{
				ratio: 16 / 9,
				class:
					"flex items-center justify-center overflow-hidden rounded-lg border bg-muted text-sm text-muted-foreground",
			},
			"16 : 9",
		),
	);
}

function radioGroupOption(value: string, label: string) {
	return Div(
		{ class: "flex items-center gap-2" },
		RadioGroupItem({ value }),
		Span({ class: "text-sm leading-none font-medium" }, label),
	);
}

function RadioGroupPreview(): Mountable {
	return RadioGroup(
		{ value: "comfortable", "aria-label": "Density" },
		radioGroupOption("default", "Default"),
		radioGroupOption("comfortable", "Comfortable"),
		radioGroupOption("compact", "Compact"),
	);
}

function RatingGroupPreview(): Mountable {
	return Div(
		{ class: "flex flex-col items-center gap-2" },
		RatingGroup(
			{ value: 3, "aria-label": "Rating" },
			...Array.from({ length: 5 }, (_, index) => RatingGroupItem({ index })),
		),
		Span({ class: "text-sm text-muted-foreground tabular-nums" }, "3 out of 5"),
	);
}

function ToggleGroupPreview(): Mountable {
	return ToggleGroup(
		{
			type: "multiple",
			value: signal(["bold", "italic"]),
			"aria-label": "Text formatting",
		},
		ToggleGroupItem(
			{ value: "bold", variant: "outline", "aria-label": "Toggle bold" },
			BoldIcon({ "aria-hidden": true }),
		),
		ToggleGroupItem(
			{ value: "italic", variant: "outline", "aria-label": "Toggle italic" },
			ItalicIcon({ "aria-hidden": true }),
		),
		ToggleGroupItem(
			{
				value: "underline",
				variant: "outline",
				"aria-label": "Toggle underline",
			},
			UnderlineIcon({ "aria-hidden": true }),
		),
	);
}

function TabsPreview(): Mountable {
	return Tabs(
		{ value: "account", class: "w-full max-w-64" },
		TabsList(
			{ class: "w-full" },
			TabsTrigger({ value: "account" }, "Account"),
			TabsTrigger({ value: "password" }, "Password"),
		),
		TabsContent(
			{ value: "account", class: "rounded-lg border p-3" },
			P({ class: "text-xs text-muted-foreground" }, "Change your name here."),
			Div({ class: "mt-2 rounded-md border border-input px-2 py-1 text-xs" }, "Aidan Bleser"),
		),
		TabsContent({ value: "password" }),
	);
}

function MenuPanelPreview(...rows: Mountable[]): Mountable {
	return Div(
		{
			class: "min-w-44 rounded-md border bg-popover p-1 text-popover-foreground shadow-md",
		},
		...rows,
	);
}

function MenuItemPreview(label: string, highlighted = false): Mountable {
	return Div(
		{
			class: [
				"flex items-center rounded-sm px-2 py-1.5 text-sm",
				highlighted && "bg-accent text-accent-foreground",
			],
		},
		label,
	);
}

function DropdownMenuPreview(): Mountable {
	return Div(
		{ class: "flex w-full max-w-56 flex-col items-start gap-2" },
		Button({ variant: "outline", size: "sm" }, "Open menu"),
		MenuPanelPreview(
			Div({ class: "px-2 py-1.5 text-sm font-medium" }, "My Account"),
			MenuItemPreview("Profile", true),
			MenuItemPreview("Billing"),
			Div({ class: "-mx-1 my-1 h-px bg-border" }),
			MenuItemPreview("Log out"),
		),
	);
}

function ContextMenuPreview(): Mountable {
	return Div(
		{ class: "relative flex w-full max-w-64 flex-col" },
		Div(
			{
				class:
					"flex h-40 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground",
			},
			"Right click here",
		),
		Div(
			{ class: "absolute top-16 left-24" },
			MenuPanelPreview(
				MenuItemPreview("Back"),
				MenuItemPreview("Reload", true),
				Div({ class: "-mx-1 my-1 h-px bg-border" }),
				MenuItemPreview("Inspect"),
			),
		),
	);
}

function MenubarPreview(): Mountable {
	return Div(
		{ class: "flex w-full max-w-64 flex-col items-start gap-2" },
		Div(
			{
				class: "flex items-center gap-1 rounded-md border bg-background p-1 shadow-xs",
			},
			Span({ class: "rounded-sm bg-accent px-2 py-1 text-sm font-medium" }, "File"),
			Span({ class: "px-2 py-1 text-sm font-medium" }, "Edit"),
			Span({ class: "px-2 py-1 text-sm font-medium" }, "View"),
		),
		MenuPanelPreview(
			MenuItemPreview("New file", true),
			MenuItemPreview("Open…"),
			Div({ class: "-mx-1 my-1 h-px bg-border" }),
			MenuItemPreview("Save"),
		),
	);
}

function SelectItemPreview(label: string, selected = false): Mountable {
	return Div(
		{
			class: [
				"relative flex items-center rounded-sm py-1.5 pr-8 pl-2 text-sm",
				selected && "bg-accent/50",
			],
		},
		Span({ class: "flex-1 truncate" }, label),
		selected
			? Span(
					{
						class: "absolute right-2 flex size-3.5 items-center justify-center",
					},
					CheckIcon({ "aria-hidden": true, class: "size-4" }),
				)
			: null,
	);
}

function SelectPreview(): Mountable {
	return Div(
		{ class: "flex w-full max-w-md items-start justify-center gap-3" },
		Div(
			{
				class:
					"flex h-9 w-40 shrink-0 items-center justify-between rounded-md border border-input bg-transparent px-3 text-sm shadow-xs",
			},
			"Apple",
			ChevronDownIcon({
				"aria-hidden": true,
				class: "size-4 shrink-0 opacity-50",
			}),
		),
		Div(
			{
				class: "min-w-40 flex-1 rounded-md border bg-popover p-1 text-popover-foreground shadow-md",
			},
			SelectItemPreview("Apple", true),
			SelectItemPreview("Banana"),
			SelectItemPreview("Blueberry"),
			Span(
				{
					class: "flex items-center rounded-sm py-1.5 pr-8 pl-2 text-sm opacity-50",
				},
				"Grapes",
			),
			SelectItemPreview("Pineapple"),
		),
	);
}

function DialogPreview(): Mountable {
	return Div(
		{
			class:
				"relative flex min-h-52 w-full max-w-80 items-center justify-center overflow-hidden rounded-md",
		},
		Div({ class: "absolute inset-0 bg-black/40" }),
		Div(
			{
				class:
					"relative z-10 w-[min(100%,18rem)] rounded-lg border bg-background p-4 text-foreground shadow-lg",
			},
			Div({ class: "text-sm font-semibold" }, "Edit profile"),
			P(
				{ class: "mt-1 text-xs text-muted-foreground" },
				"Make changes to your profile here. Click save when you're done.",
			),
			Div(
				{ class: "mt-3 grid gap-2" },
				Div(
					{ class: "grid grid-cols-3 items-center gap-2" },
					Span({ class: "text-xs text-muted-foreground" }, "Name"),
					Span(
						{
							class: "col-span-2 rounded-md border border-input px-2 py-1 text-xs",
						},
						"Aidan Bleser",
					),
				),
				Div(
					{ class: "grid grid-cols-3 items-center gap-2" },
					Span({ class: "text-xs text-muted-foreground" }, "Username"),
					Span(
						{
							class: "col-span-2 rounded-md border border-input px-2 py-1 text-xs",
						},
						"@ieedan",
					),
				),
			),
			Div(
				{
					class:
						"mt-3 flex h-8 items-center justify-center rounded-md border bg-background text-xs font-medium",
				},
				"Save changes",
			),
		),
	);
}

function AlertDialogPreview(): Mountable {
	return Div(
		{
			class:
				"relative flex min-h-52 w-full max-w-80 items-center justify-center overflow-hidden rounded-md",
		},
		Div({ class: "absolute inset-0 bg-black/40" }),
		Div(
			{
				class:
					"relative z-10 w-[min(100%,18rem)] rounded-lg border bg-background p-4 text-foreground shadow-lg",
			},
			Div({ class: "text-sm font-semibold" }, "Are you absolutely sure?"),
			P(
				{ class: "mt-1 text-xs text-muted-foreground" },
				"This action cannot be undone. This will permanently delete your account.",
			),
			Div(
				{ class: "mt-3 flex justify-end gap-2" },
				Div(
					{
						class:
							"flex h-8 items-center justify-center rounded-md border bg-background px-3 text-xs font-medium",
					},
					"Cancel",
				),
				Div(
					{
						class:
							"flex h-8 items-center justify-center rounded-md bg-destructive px-3 text-xs font-medium text-white",
					},
					"Delete account",
				),
			),
		),
	);
}

function SeparatorPreview(): Mountable {
	return Div(
		{ class: "w-full max-w-56" },
		Div({ class: "text-sm font-medium" }, "implement"),
		P({ class: "mt-1 text-xs text-muted-foreground" }, "A UI framework with no compiler."),
		Separator({ class: "my-3" }),
		Div(
			{ class: "flex h-4 items-center gap-3 text-sm text-foreground/60" },
			Span("Docs"),
			Separator({ orientation: "vertical" }),
			Span("Tutorial"),
			Separator({ orientation: "vertical" }),
			Span("REPL"),
		),
	);
}

function TooltipPreview(): Mountable {
	return Div(
		{ class: "flex flex-col items-center gap-2" },
		Div(
			{
				class: "w-fit rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground",
			},
			"Add to library",
		),
		Div(
			{
				class:
					"flex h-8 items-center justify-center rounded-md border bg-background px-3 text-xs font-medium",
			},
			"Hover",
		),
	);
}

function commandPreviewItem(label: string, selected = false) {
	return Div(
		{
			class: [
				"rounded-sm px-2 py-1.5",
				selected ? "bg-accent text-accent-foreground" : "text-foreground/70",
			],
		},
		label,
	);
}

function CommandPreview(): Mountable {
	return Div(
		{ class: "w-56 overflow-hidden rounded-md border bg-background text-xs shadow-sm" },
		Div(
			{ class: "flex items-center gap-2 border-b px-3 py-2 text-foreground/40" },
			SearchIcon({ class: "size-3.5" }),
			"Type a command...",
		),
		Div(
			{ class: "p-1" },
			Div(
				{ class: "px-2 py-1 text-[10px] font-medium tracking-wide text-foreground/40 uppercase" },
				"Suggestions",
			),
			commandPreviewItem("Calendar", true),
			commandPreviewItem("Calculator"),
			commandPreviewItem("Settings"),
		),
	);
}

/** Live, non-interactive card previews, keyed by page slug. */
const previews: Record<string, () => Mountable> = {
	accordion: AccordionPreview,
	command: CommandPreview,
	"aspect-ratio": AspectRatioPreview,
	avatar: AvatarPreview,
	checkbox: CheckboxPreview,
	switch: SwitchPreview,
	collapsible: CollapsiblePreview,
	"context-menu": ContextMenuPreview,
	"dropdown-menu": DropdownMenuPreview,
	menubar: MenubarPreview,
	meter: MeterPreview,
	"link-preview": LinkPreviewPreview,
	popover: PopoverPreview,
	progress: ProgressPreview,
	"radio-group": RadioGroupPreview,
	"rating-group": RatingGroupPreview,
	select: SelectPreview,
	separator: SeparatorPreview,
	toggle: TogglePreview,
	"toggle-group": ToggleGroupPreview,
	tabs: TabsPreview,
	dialog: DialogPreview,
	"alert-dialog": AlertDialogPreview,
	tooltip: TooltipPreview,
};

/**
 * Bento placement per page slug. Two-column from `sm`, four-column from `md`.
 * Unlisted pages fall back to a single cell.
 */
const spans: Record<string, string> = {
	accordion: "sm:col-span-2 sm:row-span-2",
	command: "sm:col-span-2 sm:row-span-2",
	"aspect-ratio": "sm:col-span-2",
	collapsible: "sm:col-span-2",
	"context-menu": "sm:col-span-2 sm:row-span-2",
	"dropdown-menu": "sm:col-span-2 sm:row-span-2",
	menubar: "sm:col-span-2 sm:row-span-2",
	meter: "sm:col-span-2",
	"link-preview": "sm:col-span-2",
	popover: "sm:col-span-2 sm:row-span-2",
	progress: "sm:col-span-2",
	select: "sm:col-span-2",
	separator: "sm:col-span-2",
	dialog: "sm:col-span-2",
	tabs: "sm:col-span-2",
	"alert-dialog": "sm:col-span-2",
};

function PrimitiveCard(page: PrimitivePage): Mountable {
	const preview = previews[page.slug];

	return Div(
		{
			class: [
				"group relative flex min-h-80 flex-col overflow-hidden rounded-xl border border-border bg-foreground/2 transition-colors hover:border-foreground/25 sm:h-full sm:min-h-0",
				spans[page.slug],
			],
		},
		Div(
			{
				class:
					"pointer-events-none flex min-h-52 flex-1 items-center justify-center p-6 pb-20 select-none sm:min-h-0",
				"aria-hidden": true,
				inert: true,
			},
			preview ? preview() : Span({ class: "text-sm text-foreground/40" }, page.title),
		),
		Div(
			{
				class:
					"pointer-events-none absolute inset-x-0 bottom-0 bg-linear-to-t from-background from-25% via-background/80 to-transparent p-4 pt-10",
			},
			H2({ class: "text-sm font-medium" }, page.title),
			P({ class: "mt-1 line-clamp-2 text-sm text-foreground/60" }, page.description),
		),
		A({
			href: page.permalink,
			class: "absolute inset-0 rounded-xl focus-visible:ring-[3px] focus-visible:ring-ring/50",
			"aria-label": page.title,
			onClick(event) {
				if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
				if (event.button !== 0) return;
				event.preventDefault();
				navigateTo(page.permalink);
			},
		}),
	);
}

export function PrimitivesHome(): Mountable {
	const components = primitivePages.filter((page) => page.slug !== "");

	return Div(
		{ class: "flex min-h-dvh flex-col" },
		ImplementHead(
			ImplementHead.Title("Primitives ~ implement"),
			ImplementHead.Meta({
				name: "description",
				content: "Unstyled, composable building blocks for common UI patterns.",
			}),
			...ogTags({
				title: "Primitives ~ implement",
				description: "Unstyled, composable building blocks for common UI patterns.",
				url: "/primitives",
			}),
		),
		SiteHeader(),
		Main(
			{ class: "mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6 md:px-8" },
			Div(
				{ class: "flex flex-col gap-2" },
				H1({ class: "text-3xl font-semibold tracking-tight" }, "Primitives"),
				P(
					{ class: "max-w-xl text-foreground/60" },
					"Unstyled, composable building blocks on top of implement. They own the behavior and the accessibility; you own the look. ",
					router.Link(
						{
							to: "/primitives/docs",
							class: "text-foreground underline underline-offset-4",
						},
						"Read the docs",
					),
				),
			),
			Div(
				{
					class:
						"mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:auto-rows-72 sm:grid-flow-dense md:grid-cols-4",
				},
				...components.map((page) => PrimitiveCard(page)),
			),
		),
	);
}
