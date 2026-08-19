import { A, Div, H1, Implement, P, type Mountable } from "@implementjs/core";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "../components/ui/accordion";
import { Link } from "../router";

export function Home(): Mountable {
	return Div(
		{ class: "mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-4 px-6" },
		Implement.Head(
			Implement.Head.Title("implement ~ A dead simple ui framework"),
			Implement.Head.Meta({
				name: "description",
				content: "A simple ergonomic ui framework without a compiler.",
			}),
		),

		H1({ class: "text-3xl font-semibold tracking-tight" }, "implement"),
		P({ class: "text-foreground/60" }, "A simple ergonomic ui framework without a compiler."),
		Div(
			{ class: "flex items-center gap-4" },
			Link({ to: "/docs", class: "text-foreground underline underline-offset-4" }, "Read the docs"),
			A(
				{
					href: "https://github.com/ieedan/implement",
					target: "_blank",
					class: "text-foreground/60 hover:underline underline-offset-4",
				},
				"View on GitHub →",
			),
		),

		Accordion(
			{ type: "multiple" },
			AccordionItem(
				{ value: "1" },
				AccordionTrigger({}, "Accordion Item 1"),
				AccordionContent({}, "Accordion Content 1"),
			),
			AccordionItem(
				{ value: "2" },
				AccordionTrigger({}, "Accordion Item 2"),
				AccordionContent({}, "Accordion Content 2"),
			),
			AccordionItem(
				{ value: "3" },
				AccordionTrigger({}, "Accordion Item 3"),
				AccordionContent({}, "Accordion Content 3"),
			),
		),
	);
}
