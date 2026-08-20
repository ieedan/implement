import {
	A,
	Article,
	derived,
	Div,
	If,
	Implement,
	navigateTo,
	signal,
	Span,
	watch,
	type Mountable,
} from "@implementjs/core";
import { Typeset } from "../components/docs/typeset";
import { MenuIcon } from "@implementjs/lucide";
import { LessonMenu } from "../components/tutorials/lesson-menu";
import { Playground, type PlaygroundFile } from "../components/tutorials/playground";
import { Button } from "../components/ui/button";
import type { Tutorial } from "@/lib/content";
import { checkKitLesson, checkLesson } from "@/lib/lesson-test";
import { isKitLesson } from "@/lib/run-kit-lesson";
import { tutorialNeighbors } from "@/lib/tutorials";
import { UnsavedChangesGuard, withoutUnsavedChangesPrompt } from "@/lib/unsaved-changes";

type CheckState = { status: "idle" | "running" | "pass" } | { status: "fail"; message: string };

function LessonLink(lesson: Tutorial, direction: "prev" | "next"): Mountable {
	const isNext = direction === "next";
	return A(
		{
			href: lesson.permalink,
			class: [
				"group flex min-w-0 max-w-[50%] flex-col gap-0.5 rounded-md px-2 py-1",
				isNext ? "ms-auto items-end text-right" : "items-start text-left",
			],
			onClick(event) {
				if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
				if (event.button !== 0) return;
				event.preventDefault();
				// moving between lessons is deliberate — skip the unsaved prompt
				withoutUnsavedChangesPrompt(() => navigateTo(lesson.permalink));
			},
		},
		Span(
			{ class: "text-xs text-foreground/40 group-hover:text-foreground/60" },
			isNext ? "Next" : "Previous",
		),
		Span(
			{ class: "truncate text-sm text-foreground/80 group-hover:text-foreground" },
			lesson.title,
		),
	);
}

export function TutorialPage(lesson: Tutorial): Mountable {
	const files: PlaygroundFile[] = lesson.files.map((file) => ({
		path: file.path,
		content: signal(file.content),
	}));
	const contents = files.map((file) => file.content);
	const menuOpen = signal(false);
	const { prev, next } = tutorialNeighbors(lesson);

	const dirty = derived(contents, (...values) =>
		values.some((value, index) => value !== lesson.files[index]!.content),
	);
	const solutionByPath = new Map(lesson.solution.map((file) => [file.path, file.content]));
	// Work worth a leave prompt: differs from the starter AND the solution —
	// pristine and solved states are both one click away, nothing is lost.
	const tainted = derived(contents, (...values) =>
		values.some((value, index) => {
			const file = lesson.files[index]!;
			return value !== file.content && value !== solutionByPath.get(file.path);
		}),
	);
	const check = signal<CheckState>({ status: "idle" });
	watch(contents, () => check.set({ status: "idle" }));

	const reset = () => {
		for (const [index, file] of files.entries()) {
			file.content.set(lesson.files[index]!.content);
		}
	};

	const solve = () => {
		for (const file of files) {
			const solved = solutionByPath.get(file.path);
			if (solved != null) file.content.set(solved);
		}
	};

	// Single-file lessons check their one module; kit lessons boot the whole app.
	const checked = files.find((file) => file.path === "index.ts");
	const kitLesson = isKitLesson(files);
	const checkable = lesson.test != null && (kitLesson || checked != null);

	const runCheck = () => {
		const test = lesson.test;
		if (test == null) return;
		const snapshot = files.map((file) => ({ path: file.path, content: file.content.get() }));
		check.set({ status: "running" });
		const result = kitLesson
			? checkKitLesson(snapshot, test)
			: checkLesson(snapshot.find((file) => file.path === "index.ts")!.content, test);
		void result.then((outcome) => {
			// The user kept editing while the check ran; this result is stale.
			const stale = files.some((file, index) => file.content.get() !== snapshot[index]!.content);
			if (stale) return;
			check.set(outcome.passed ? { status: "pass" } : { status: "fail", message: outcome.message });
		});
	};

	return Div(
		{ class: "relative flex min-h-0 flex-1 flex-col" },
		Implement.Head(
			Implement.Head.Title(`${lesson.title} ~ tutorial ~ implement`),
			Implement.Head.Meta({ name: "description", content: lesson.description }),
		),
		UnsavedChangesGuard(tainted, "You have unsaved edits in this lesson — leave anyway?"),
		Div(
			{ class: "flex h-10 shrink-0 items-center gap-2 border-b border-border px-2 sm:px-3" },
			Button(
				{
					variant: "ghost",
					size: "icon-sm",
					"aria-label": "Open lesson list",
					"aria-expanded": derived([menuOpen], (open) => (open ? "true" : "false")),
					onClick: () => menuOpen.toggle(),
				},
				MenuIcon({ class: "size-4" }),
			),
			Span(
				{ class: "min-w-0 flex-1 truncate text-sm text-foreground/60" },
				Span(
					{ class: "text-foreground/40" },
					lesson.part.charAt(0).toUpperCase() + lesson.part.slice(1),
				),
				Span({ class: "px-1.5 text-foreground/25" }, "/"),
				Span({ class: "text-foreground/40" }, lesson.section),
				Span({ class: "px-1.5 text-foreground/25" }, "/"),
				Span({ class: "text-foreground" }, lesson.title),
			),
			checkable &&
				If(dirty).Then(
					Button(
						{
							size: "sm",
							disabled: derived(
								[check],
								(state) => state.status === "running" || state.status === "pass",
							),
							onClick: runCheck,
						},
						derived([check], (state) =>
							state.status === "pass"
								? "Correct!"
								: state.status === "fail"
									? "Failed"
									: state.status === "running"
										? "Checking…"
										: "Check",
						),
					),
				),
			Button(
				{
					variant: "ghost",
					size: "sm",
					onClick: reset,
				},
				"Reset",
			),
			Button(
				{
					variant: "outline",
					size: "sm",
					onClick: solve,
				},
				"Solve",
			),
		),
		Div(
			{ class: "flex min-h-0 flex-1 flex-col lg:flex-row" },
			Div(
				{
					class:
						"flex min-h-0 w-full min-w-0 flex-col border-b border-border lg:w-sm lg:shrink-0 lg:border-r lg:border-b-0 xl:w-md 2xl:w-lg",
				},
				Article(
					{ class: "min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-6" },
					Typeset(lesson.content),
				),
				Div(
					{ class: "flex shrink-0 items-center border-t border-border px-3 py-2" },
					prev && LessonLink(prev, "prev"),
					next && LessonLink(next, "next"),
				),
			),
			Playground(files, { focus: lesson.focus }),
		),
		LessonMenu(menuOpen, lesson),
	);
}
