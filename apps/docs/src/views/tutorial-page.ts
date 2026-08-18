import {
	A,
	Article,
	Button,
	derived,
	Div,
	H1,
	Html,
	Implement,
	navigateTo,
	P,
	signal,
	Span,
	Svg,
	type Mountable,
} from "@implementjs/core";
import { icons } from "../components/tutorials/icons";
import { LessonMenu } from "../components/tutorials/lesson-menu";
import { Playground } from "../components/tutorials/playground";
import type { Tutorial } from "../lib/content";
import { tutorialNeighbors } from "../lib/tutorials";

function LessonLink(lesson: Tutorial, direction: "prev" | "next"): Mountable {
	return A(
		{
			href: lesson.permalink,
			class:
				"inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-foreground/60 hover:text-foreground",
			onClick(event) {
				if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
				if (event.button !== 0) return;
				event.preventDefault();
				navigateTo(lesson.permalink);
			},
		},
		direction === "prev" && Svg(icons.chevronLeft, { class: "size-3.5" }),
		lesson.title,
		direction === "next" && Svg(icons.chevronRight, { class: "size-3.5" }),
	);
}

export function TutorialPage(lesson: Tutorial): Mountable {
	const code = signal(lesson.code);
	const menuOpen = signal(false);
	const { prev, next } = tutorialNeighbors(lesson);

	return Div(
		{ class: "relative flex min-h-0 flex-1 flex-col" },
		Implement.Head(
			Implement.Head.Title(`${lesson.title} ~ tutorial ~ implement`),
			Implement.Head.Meta({ name: "description", content: lesson.description }),
		),
		Div(
			{ class: "flex h-10 shrink-0 items-center gap-2 border-b border-border px-2 sm:px-3" },
			Button(
				{
					type: "button",
					class: "rounded-md p-1.5 text-foreground/60 hover:bg-foreground/5 hover:text-foreground",
					"aria-label": "Open lesson list",
					"aria-expanded": derived([menuOpen], (open) => (open ? "true" : "false")),
					onClick: () => menuOpen.toggle(),
				},
				Svg(icons.menu, { class: "size-4" }),
			),
			Span(
				{ class: "min-w-0 flex-1 truncate text-sm text-foreground/60" },
				Span({ class: "text-foreground/40" }, lesson.section),
				Span({ class: "px-1.5 text-foreground/25" }, "/"),
				Span({ class: "text-foreground" }, lesson.title),
			),
			Button(
				{
					type: "button",
					class: "rounded-md px-2 py-1 text-xs text-foreground/50 hover:text-foreground",
					onClick: () => code.set(lesson.code),
				},
				"Reset",
			),
			Button(
				{
					type: "button",
					class:
						"rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-foreground/5",
					onClick: () => code.set(lesson.solution),
				},
				"Solve",
			),
		),
		Div(
			{ class: "flex min-h-0 flex-1 flex-col lg:flex-row" },
			Div(
				{
					class:
						"flex min-h-0 w-full flex-col border-b border-border lg:w-md lg:border-r lg:border-b-0 xl:w-lg",
				},
				Article(
					{ class: "min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-6" },
					H1({ class: "text-2xl font-semibold tracking-tight" }, lesson.title),
					P({ class: "mt-2 text-foreground/55" }, lesson.description),
					Div({ class: "typeset mt-6" }, Html(lesson.content)),
				),
				Div(
					{ class: "flex shrink-0 items-center justify-between border-t border-border px-3 py-2" },
					prev
						? LessonLink(prev, "prev")
						: Span({ class: "px-2 py-1 text-sm text-foreground/25" }, "Start"),
					next
						? LessonLink(next, "next")
						: Span({ class: "px-2 py-1 text-sm text-foreground/25" }, "Done"),
				),
			),
			Playground(code),
		),
		LessonMenu(menuOpen, lesson),
	);
}
