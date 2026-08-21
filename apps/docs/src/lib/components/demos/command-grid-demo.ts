import { Div, P, signal, Span } from "@implementjs/core";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandGroupHeading,
	CommandGroupItems,
	CommandInput,
	CommandItem,
	CommandList,
	CommandViewport,
} from "@/lib/components/ui/command";

const COLUMNS = 5;

const sections: { name: string; emojis: [name: string, emoji: string][] }[] = [
	{
		name: "Smileys",
		emojis: [
			["grinning face", "😀"],
			["face with tears of joy", "😂"],
			["smiling face with hearts", "🥰"],
			["thinking face", "🤔"],
			["sleeping face", "😴"],
			["face with sunglasses", "😎"],
			["party face", "🥳"],
		],
	},
	{
		name: "Animals",
		emojis: [
			["dog", "🐶"],
			["cat", "🐱"],
			["fox", "🦊"],
			["panda", "🐼"],
			["penguin", "🐧"],
			["octopus", "🐙"],
		],
	},
	{
		name: "Food",
		emojis: [
			["pizza", "🍕"],
			["taco", "🌮"],
			["sushi", "🍣"],
			["doughnut", "🍩"],
			["avocado", "🥑"],
		],
	},
];

export default function CommandGridDemo() {
	const picked = signal<string | null>(null);

	return Div(
		{ class: "flex w-full max-w-md flex-col items-center gap-3" },
		Command(
			{ label: "Emoji picker", columns: COLUMNS, class: "rounded-lg border shadow-md" },
			CommandInput({ placeholder: "Search emoji..." }),
			CommandList(
				{},
				CommandViewport(
					{},
					CommandEmpty({}, "No emoji found."),
					...sections.map((section) =>
						CommandGroup(
							{ value: section.name },
							CommandGroupHeading({}, section.name),
							CommandGroupItems(
								// keep the CSS columns in step with the `columns` prop on the root
								{ class: "grid grid-cols-5" },
								...section.emojis.map(([name, emoji]) =>
									CommandItem(
										{
											value: name,
											onSelect: () => picked.set(`${emoji} ${name}`),
											// square cells, so the highlight reads as a grid rather than rows
										class: "aspect-square justify-center text-xl",
										},
										Span({ "aria-hidden": true }, emoji),
										Span({ class: "sr-only" }, name),
									),
								),
							),
						),
					),
				),
			),
		),
		P(
			{ class: "text-sm text-muted-foreground" },
			picked.bind((value) => (value == null ? "Pick an emoji" : `Picked: ${value}`)),
		),
	);
}
