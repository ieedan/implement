import {
	A,
	Aside,
	Button,
	derived,
	Div,
	H2,
	Implement,
	navigateTo,
	Span,
	type Mountable,
	type Writable,
} from "@implementjs/core";
import type { Tutorial } from "@/lib/content";
import { tutorialParts, type TutorialSection } from "@/lib/tutorials";

function SectionGroup(section: TutorialSection, current: Tutorial, open: Writable<boolean>) {
	return Div(
		{ class: "mt-4" },
		Span(
			{ class: "px-2 text-[11px] font-medium uppercase tracking-wide text-foreground/40" },
			section.name,
		),
		Div(
			{ class: "mt-1.5 flex flex-col" },
			...section.lessons.map((lesson) =>
				A(
					{
						href: lesson.permalink,
						class: [
							"rounded-md px-2 py-1.5 text-sm",
							lesson.permalink === current.permalink
								? "bg-foreground/10 text-foreground"
								: "text-foreground/60 hover:text-foreground",
						],
						"aria-current": lesson.permalink === current.permalink ? "page" : undefined,
						onClick(event) {
							if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
							if (event.button !== 0) return;
							event.preventDefault();
							open.set(false);
							navigateTo(lesson.permalink);
						},
					},
					lesson.title,
				),
			),
		),
	);
}

export function LessonMenu(open: Writable<boolean>, current: Tutorial): Mountable {
	const parts = tutorialParts();

	return Div(
		{
			class: derived([open], (isOpen) => [
				"absolute inset-0 z-20",
				!isOpen && "pointer-events-none",
			]),
		},
		Implement.Window({
			onKeydown: (event) => {
				if (event.key === "Escape" && open.get()) open.set(false);
			},
		}),
		Button({
			type: "button",
			tabIndex: derived([open], (isOpen) => (isOpen ? 0 : -1)),
			class: derived([open], (isOpen) => [
				"absolute inset-0 bg-black/60 transition-opacity",
				isOpen ? "opacity-100" : "opacity-0",
			]),
			"aria-label": "Close lesson list",
			onClick: () => open.set(false),
		}),
		Aside(
			{
				class: derived([open], (isOpen) => [
					"absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-border bg-background transition-transform",
					isOpen ? "translate-x-0" : "-translate-x-full",
				]),
				inert: derived([open], (isOpen) => !isOpen),
			},
			Div(
				{ class: "flex items-center justify-between border-b border-border px-4 py-3" },
				H2({ class: "text-sm font-semibold" }, "Lessons"),
				Button(
					{
						type: "button",
						class: "rounded-md px-2 py-1 text-xs text-foreground/60 hover:text-foreground",
						onClick: () => open.set(false),
					},
					"Close",
				),
			),
			Div(
				{ class: "flex-1 overflow-y-auto px-3 py-4" },
				...parts.map((part, index) =>
					Div(
						{ class: index > 0 ? "mt-7 border-t border-border pt-5" : undefined },
						Span({ class: "px-2 font-mono text-xs font-semibold text-foreground" }, part.name),
						...part.sections.map((section) => SectionGroup(section, current, open)),
					),
				),
			),
		),
	);
}
