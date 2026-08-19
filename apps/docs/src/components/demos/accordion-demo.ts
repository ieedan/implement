import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";

export default function AccordionDemo() {
	return Accordion(
		{ type: "multiple", class: "w-full max-w-md" },
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
			AccordionContent(
				{},
				"Every part exposes data attributes like data-state, so plain CSS or Tailwind works.",
			),
		),
	);
}
