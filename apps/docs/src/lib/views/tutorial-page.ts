import {
	A,
	Article,
	derived,
	Div,
	If,
	ImplementHead,
	ImplementLifecycle,
	navigateTo,
	P,
	signal,
	Span,
	type Mountable,
} from "@implementjs/core";
import { Typeset } from "../components/docs/typeset";
import { MenuIcon } from "@implementjs/lucide";
import { LessonMenu } from "../components/tutorials/lesson-menu";
import {
	Playground,
	watchLessonFiles,
	type PlaygroundFile,
} from "../components/tutorials/playground";
import { Button } from "../components/ui/button";
import { Sheet, SheetTrigger } from "../components/ui/sheet";
import type { Tutorial } from "@/lib/tutorials";
import { checkKitLesson, checkLesson } from "@/lib/lesson-test";
import { isKitLesson } from "@/lib/run-kit-lesson";
import { ogTags } from "@/lib/og-tags";
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

function IncompleteLesson(lesson: Tutorial): Mountable {
	return Div(
		{ class: "flex flex-col items-center gap-2 py-24" },
		Span({ class: "text-sm font-medium" }, `${lesson.title} has no starter files yet`),
		P(
			{ class: "text-[13px] text-foreground/50" },
			"Add a code.ts or an app/ directory next to this lesson's index.md.",
		),
	);
}

export function TutorialPage(lesson: Tutorial): Mountable {
	// A lesson whose starter files haven't been written yet (see `contentError`);
	// there is nothing to put in the editor.
	if (lesson.files.length === 0) return IncompleteLesson(lesson);

	const files = signal<PlaygroundFile[]>(
		lesson.files.map((file) => ({ path: file.path, content: signal(file.content) })),
	);
	const menuOpen = signal(false);
	const { prev, next } = tutorialNeighbors(lesson);

	const startersByPath = new Map(lesson.files.map((file) => [file.path, file.content]));
	const solutionByPath = new Map(lesson.solution.map((file) => [file.path, file.content]));

	const matchesSet = (targets: Map<string, string>): boolean => {
		const current = files.get();
		return (
			current.length === targets.size &&
			current.every((file) => file.content.get() === targets.get(file.path))
		);
	};
	/** Whether the current files match the solution, extra untouched starters allowed. */
	const matchesSolution = (): boolean => {
		const current = files.get();
		const byPath = new Map(current.map((file) => [file.path, file.content.get()]));
		if (![...solutionByPath].every(([path, content]) => byPath.get(path) === content)) {
			return false;
		}
		return current.every(
			(file) =>
				solutionByPath.has(file.path) || file.content.get() === startersByPath.get(file.path),
		);
	};

	// Files come and go, so these are plain signals refreshed on any change
	// (watchLessonFiles below) instead of deriveds over a fixed dep list.
	const dirty = signal(false);
	// Work worth a leave prompt: differs from the starter AND the solution —
	// pristine and solved states are both one click away, nothing is lost.
	const tainted = signal(false);
	const check = signal<CheckState>({ status: "idle" });
	const refresh = () => {
		const pristine = matchesSet(startersByPath);
		dirty.set(!pristine);
		tainted.set(!pristine && !matchesSolution());
		check.set({ status: "idle" });
	};

	/** Set the list to exactly `targets`, reusing content signals by path. */
	const setFiles = (targets: readonly { path: string; content: string }[]) => {
		const byPath = new Map(files.get().map((file) => [file.path, file.content]));
		files.set(
			targets.map((target) => {
				const existing = byPath.get(target.path);
				if (existing != null) {
					existing.set(target.content);
					return { path: target.path, content: existing };
				}
				return { path: target.path, content: signal(target.content) };
			}),
		);
	};

	const reset = () => setFiles(lesson.files);

	const solve = () => {
		// the solved file set: every solution file, plus starters it doesn't cover
		const extras = files
			.get()
			.filter((file) => !solutionByPath.has(file.path) && startersByPath.has(file.path))
			.map((file) => ({ path: file.path, content: file.content.get() }));
		setFiles([...lesson.solution, ...extras]);
	};

	// Single-file lessons check their one module; kit lessons boot the whole app.
	const kitLesson = isKitLesson(lesson.files);
	const checkable =
		lesson.test != null && (kitLesson || lesson.files.some((file) => file.path === "index.ts"));

	const runCheck = () => {
		const test = lesson.test;
		if (test == null) return;
		const snapshot = files.get().map((file) => ({ path: file.path, content: file.content.get() }));
		check.set({ status: "running" });
		const result = kitLesson
			? checkKitLesson(snapshot, test)
			: checkLesson(snapshot.find((file) => file.path === "index.ts")?.content ?? "", test);
		void result.then((outcome) => {
			// The user kept editing while the check ran; this result is stale.
			const current = files.get();
			const stale =
				current.length !== snapshot.length ||
				current.some((file, index) => {
					const taken = snapshot[index]!;
					return file.path !== taken.path || file.content.get() !== taken.content;
				});
			if (stale) return;
			check.set(outcome.passed ? { status: "pass" } : { status: "fail", message: outcome.message });
		});
	};

	// The whole page sits inside the lesson-list Sheet so its header button is
	// the sheet's trigger (the root renders no wrapper).
	return Div(
		{ class: "relative flex min-h-0 flex-1 flex-col" },
		Sheet(
			{ open: menuOpen },
			ImplementHead(
				ImplementHead.Title(`${lesson.title} ~ tutorial ~ implement`),
				ImplementHead.Meta({ name: "description", content: lesson.description }),
				...ogTags({
					title: lesson.title,
					description: lesson.description,
					url: lesson.permalink,
					image: `${lesson.permalink}.png`,
				}),
			),
			UnsavedChangesGuard(tainted, "You have unsaved edits in this lesson — leave anyway?"),
			ImplementLifecycle({ onMount: () => watchLessonFiles(files, refresh) }),
			Div(
				{ class: "flex h-10 shrink-0 items-center gap-2 border-b border-border px-2 sm:px-3" },
				SheetTrigger({ "aria-label": "Open lesson list" }, MenuIcon({ class: "size-4" })),
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
				Playground(files, {
					focus: lesson.focus,
					// the files the exercise expects the user to create: in the
					// solution but not in the starter
					creatable: lesson.solution
						.filter((file) => !startersByPath.has(file.path))
						.map((file) => file.path),
				}),
			),
			LessonMenu(menuOpen, lesson),
		),
	);
}
