import {
	App,
	derived,
	Div,
	If,
	Pre,
	signal,
	Svg,
	watch,
	type Child,
	type IMountable,
	type Mountable,
	type Readable,
	type Signal,
} from "@implementjs/core";
import { copyText } from "../../lib/copy-text";
import { importLessonModule } from "../../lib/run-lesson";
import { CodeEditor } from "../tutorials/editor";
import { icons } from "../tutorials/icons";
import { Button } from "../ui/button";
import { demoModules } from "./demo-modules";

function toErrorMessage(error: unknown): string {
	if (error instanceof Error) return error.message;
	return String(error);
}

// Compiles the code with the lesson pipeline and renders the default export in
// place. Unlike the tutorial preview there is no iframe: demos use the page's
// Tailwind styles, so they have to render in the page's own realm — and they
// mount through App so core's tree bookkeeping (context lookup) works.
function DemoRunner(code: Readable<string>, error: Signal<string | null>): Mountable {
	return (): IMountable => {
		let host: HTMLElement | null = null;
		let stopWatch: (() => void) | null = null;
		let unmountRun: (() => void) | null = null;
		let timer: ReturnType<typeof setTimeout> | null = null;
		let generation = 0;

		const run = (source: string) => {
			const current = ++generation;
			unmountRun?.();
			unmountRun = null;
			if (host == null) return;
			void importLessonModule(source, demoModules)
				.then(({ mod, revoke }) => {
					if (current !== generation || host == null) {
						revoke();
						return;
					}
					try {
						const exported = mod.default;
						if (typeof exported !== "function") {
							throw new Error("Export a default function that returns your UI.");
						}
						const unmountApp = App({ target: host }).render(exported() as Child);
						unmountRun = () => {
							unmountApp();
							revoke();
						};
						error.set(null);
					} catch (thrown) {
						revoke();
						throw thrown;
					}
				})
				.catch((thrown: unknown) => {
					if (current !== generation) return;
					error.set(toErrorMessage(thrown));
				});
		};

		return {
			mount(parent: HTMLElement) {
				host = document.createElement("div");
				// contents: the demo root itself participates in the preview
				// box's centering flex layout
				host.className = "contents";
				parent.appendChild(host);

				let first = true;
				stopWatch = watch([code], (source) => {
					if (timer != null) clearTimeout(timer);
					if (first) {
						first = false;
						run(source);
						return;
					}
					timer = setTimeout(() => run(source), 300);
				});
			},
			unmount() {
				generation += 1;
				if (timer != null) clearTimeout(timer);
				timer = null;
				stopWatch?.();
				stopWatch = null;
				unmountRun?.();
				unmountRun = null;
				host?.remove();
				host = null;
			},
			getFirstDomNode() {
				return host;
			},
		};
	};
}

/**
 * A live component demo with its source in an editor below the preview.
 * Edits re-run the demo (debounced); Reset restores the original source and
 * the copy button copies whatever is currently in the editor.
 */
export function EditableDemo(source: string): Mountable {
	const initial = source.replace(/\n+$/, "");
	const code = signal(initial);
	const error = signal<string | null>(null);
	const copied = signal(false);
	const dirty = derived([code], (value) => value !== initial);
	const hasError = derived([error], (value) => value != null);

	let copiedTimer: ReturnType<typeof setTimeout> | undefined;
	const copy = async () => {
		if (!(await copyText(code.get()))) return;
		copied.set(true);
		clearTimeout(copiedTimer);
		copiedTimer = setTimeout(() => copied.set(false), 1500);
	};

	return Div(
		{},
		Div(
			{
				class:
					"flex min-h-48 w-full items-center justify-center rounded-t-lg border border-border bg-background p-10",
			},
			DemoRunner(code, error),
			If(hasError).Then(
				Pre(
					{ class: "w-full overflow-auto font-mono text-xs whitespace-pre-wrap text-red-300" },
					derived([error], (value) => value ?? ""),
				),
			),
		),
		Div(
			{ class: "relative overflow-hidden rounded-b-lg border border-t-0 border-border" },
			Div(
				{ class: "absolute top-1.5 right-1.5 z-10 flex items-center gap-1" },
				If(dirty).Then(
					Button(
						{
							variant: "ghost",
							size: "xs",
							class: "text-foreground/60",
							onClick: () => code.set(initial),
						},
						"Reset",
					),
				),
				Button(
					{
						variant: "ghost",
						size: "icon-xs",
						class: "text-foreground/60",
						"aria-label": derived([copied], (value) => (value ? "Copied" : "Copy code")),
						onClick: () => void copy(),
					},
					If(copied).Then(Svg(icons.check)).Else(Svg(icons.copy)),
				),
			),
			Div({ class: "demo-editor" }, CodeEditor(code)),
		),
	);
}
