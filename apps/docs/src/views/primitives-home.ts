import {
	A,
	Div,
	H1,
	H2,
	Implement,
	Label,
	Main,
	navigateTo,
	P,
	Span,
	type Mountable,
} from "@implementjs/core";
import { SiteHeader } from "../components/site-header";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "../components/ui/accordion";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Checkbox } from "../components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { Separator } from "../components/ui/separator";
import { primitivePages, type PrimitivePage } from "../lib/content";
import { router } from "../router";

function AccordionPreview(): Mountable {
	return Accordion(
		{ class: "w-full" },
		AccordionItem(
			{ value: "what" },
			AccordionTrigger({}, "What is implement?"),
			AccordionContent({}, "A signal-based UI framework with no compiler."),
		),
		AccordionItem(
			{ value: "why" },
			AccordionTrigger({}, "Why no compiler?"),
			AccordionContent({}, "Your app is plain TypeScript that builds real DOM nodes."),
		),
		AccordionItem(
			{ value: "styling" },
			AccordionTrigger({}, "How do I style it?"),
			AccordionContent({}, "Every part exposes data attributes, so plain CSS works."),
		),
	);
}

function AvatarPreview(): Mountable {
	return Div(
		{ class: "flex -space-x-2 *:data-[slot=avatar]:ring-2 *:data-[slot=avatar]:ring-background" },
		Avatar(
			{ class: "size-10" },
			AvatarImage({ src: "https://github.com/ieedan.png", alt: "" }),
			AvatarFallback({}, "AB"),
		),
		Avatar(
			{ class: "size-10" },
			AvatarImage({ src: "https://github.com/github.png", alt: "" }),
			AvatarFallback({}, "GH"),
		),
		Avatar({ class: "size-10" }, AvatarFallback({}, "+3")),
	);
}

function PopoverPreview(): Mountable {
	return Div(
		{ class: "flex flex-col items-center gap-3" },
		Popover(
			{ open: true },
			PopoverTrigger({ variant: "outline" }, "Open popover"),
			PopoverContent(
				{ class: "w-64" },
				Div(
					{ class: "grid gap-1.5" },
					Div({ class: "text-sm font-medium" }, "Dimensions"),
					P({ class: "text-sm text-muted-foreground" }, "Set the dimensions for the layer."),
				),
			),
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
			Checkbox({}),
			Label({ class: "text-sm leading-none font-medium" }, "Accept terms"),
		),
	);
}

function SeparatorPreview(): Mountable {
	return Div(
		{ class: "w-full max-w-56" },
		Div({ class: "text-sm font-medium" }, "implement"),
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

/** Live, non-interactive card previews, keyed by page slug. */
const previews: Record<string, () => Mountable> = {
	accordion: AccordionPreview,
	avatar: AvatarPreview,
	checkbox: CheckboxPreview,
	popover: PopoverPreview,
	separator: SeparatorPreview,
};

/** Bento placement per page slug; everything else falls back to one cell. */
const spans: Record<string, string> = {
	accordion: "md:col-span-2 md:row-span-2",
};

function PrimitiveCard(page: PrimitivePage): Mountable {
	const preview = previews[page.slug];

	return Div(
		{
			class: [
				"group relative flex flex-col overflow-hidden rounded-xl border border-border bg-background transition-colors hover:border-foreground/25",
				spans[page.slug],
			],
		},
		Div(
			{
				class:
					"pointer-events-none flex min-h-40 flex-1 items-center justify-center border-b border-border bg-foreground/[0.02] p-6 select-none",
				"aria-hidden": true,
				inert: true,
			},
			preview ? preview() : Span({ class: "text-sm text-foreground/40" }, page.title),
		),
		Div(
			{ class: "flex flex-col gap-1 p-4" },
			H2({ class: "text-sm font-medium" }, page.title),
			P({ class: "text-sm text-foreground/60" }, page.description),
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
		Implement.Head(
			Implement.Head.Title("Primitives ~ implement"),
			Implement.Head.Meta({
				name: "description",
				content: "Unstyled, composable building blocks for common UI patterns.",
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
						{ to: "/primitives/docs", class: "text-foreground underline underline-offset-4" },
						"Read the docs",
					),
				),
			),
			Div(
				{ class: "mt-8 grid grid-cols-1 gap-4 md:grid-cols-3" },
				...components.map((page) => PrimitiveCard(page)),
			),
		),
	);
}
