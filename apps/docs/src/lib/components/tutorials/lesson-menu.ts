import { A, Div, Fragment, navigateTo, Span, type Child, type Writable } from "@implementjs/core";
import type { Tutorial } from "@/lib/content";
import { tutorialParts, type TutorialSection } from "@/lib/tutorials";
import { SheetContent, SheetOverlay, SheetTitle } from "../ui/sheet";

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

/**
 * The lesson list as sheet parts (overlay + sliding panel) — mount inside
 * the tutorial page's `Sheet` root, whose header button is the trigger.
 */
export function LessonMenu(open: Writable<boolean>, current: Tutorial): Child {
	const parts = tutorialParts();

	return Fragment(
		SheetOverlay({}),
		SheetContent(
			{ side: "left" },
			Div({ class: "border-b border-border px-4 py-3" }, SheetTitle({}, "Lessons")),
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
