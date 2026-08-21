import {
	watch,
	type IMountable,
	type Mountable,
	type Readable,
	type Signal,
} from "@implementjs/core";
import type { LessonFile } from "@/lib/content";
import { isKitLesson, runKitApp } from "@/lib/run-kit-lesson";
import {
	CONSOLE_LEVELS,
	formatConsoleArgs,
	formatFileLocation,
	formatStackLines,
	frameLocation,
	getErrorStack,
	parseStack,
	type ConsoleEntry,
} from "@/lib/console-format";
import { mode } from "@/lib/mode";
import { runLesson } from "@/lib/run-lesson";
import frameCss from "./preview-frame.css?inline";

let nextEntryId = 0;

function toErrorMessage(error: unknown): string {
	if (error instanceof Error) return error.message;
	return String(error);
}

type ConsoleEvent = Omit<ConsoleEntry, "id" | "count">;

type PreviewFrame = {
	window: Window;
	body: HTMLElement;
	element: HTMLIFrameElement;
	destroy: () => void;
};

// A same-origin iframe gives the lesson its own realm: console calls and
// uncaught errors are attributable to the lesson, and tearing the frame down
// kills stray timers and listeners the lesson leaked.
function createPreviewFrame(
	parent: HTMLElement,
	onEvent: (event: ConsoleEvent) => void,
	onReset: () => void,
): PreviewFrame {
	const iframe = document.createElement("iframe");
	iframe.className = "block h-full w-full border-0";
	iframe.title = "Lesson preview";
	parent.appendChild(iframe);

	// Same-origin about:blank frame — write the shell synchronously so the
	// document (and our console patch) exists before any lesson code runs.
	const doc = iframe.contentDocument;
	const frameWindow = iframe.contentWindow;
	if (doc == null || frameWindow == null) {
		iframe.remove();
		throw new Error("Could not create the preview frame document.");
	}
	doc.open();
	doc.write(
		`<!doctype html><html><head><meta charset="utf-8"><style>${frameCss}</style></head><body class="tutorial-preview"></body></html>`,
	);
	doc.close();

	// The frame is its own document, so the host's `dark` class doesn't reach
	// it — mirror the mode in, and keep mirroring it as it changes.
	const unwatchMode = watch([mode.mode], (current) => {
		doc.documentElement.classList.toggle("dark", current !== "light");
	});

	// Reparenting an iframe (hydration reordering, layout swaps) reloads it,
	// silently replacing the written document and orphaning everything mounted
	// into it. Detect the replacement and let the caller boot a fresh frame.
	iframe.addEventListener("load", () => {
		if (iframe.contentDocument !== doc) onReset();
	});

	const frameConsole = (frameWindow as Window & typeof globalThis).console;
	for (const level of CONSOLE_LEVELS) {
		const original = frameConsole[level].bind(frameConsole);
		frameConsole[level] = (...args: unknown[]) => {
			original(...args);
			// Drop the first frame — it's this wrapper; the next one is the caller.
			const callFrames = parseStack(new Error().stack).slice(1);
			const errorStack = args.map(getErrorStack).find((stack) => stack != null);
			onEvent({
				level,
				text: formatConsoleArgs(args),
				location: frameLocation(callFrames[0]),
				stack: errorStack != null ? formatStackLines(parseStack(errorStack)) : [],
			});
		};
	}
	frameWindow.addEventListener("error", (event) => {
		const frames = parseStack(getErrorStack(event.error));
		const fallback =
			event.filename !== "" ? formatFileLocation(event.filename, event.lineno) : null;
		onEvent({
			level: "error",
			text: `Uncaught ${formatConsoleArgs([event.error ?? event.message])}`,
			location: frameLocation(frames[0]) ?? fallback,
			stack: formatStackLines(frames),
		});
	});
	frameWindow.addEventListener("unhandledrejection", (event) => {
		const frames = parseStack(getErrorStack(event.reason));
		onEvent({
			level: "error",
			text: `Uncaught (in promise) ${formatConsoleArgs([event.reason])}`,
			location: frameLocation(frames[0]),
			stack: formatStackLines(frames),
		});
	});

	return {
		window: frameWindow,
		body: doc.body,
		element: iframe,
		destroy: () => {
			unwatchMode();
			iframe.remove();
		},
	};
}

export function LessonPreview(
	files: Readable<LessonFile[]>,
	tick: Readable<number>,
	logs: Signal<ConsoleEntry[]>,
	/** Virtual preview URL — drives and reflects the playground's URL bar. */
	urlPath: Signal<string>,
): Mountable {
	return (): IMountable => {
		let root: HTMLElement | null = null;
		let frameHost: HTMLElement | null = null;
		let frame: PreviewFrame | null = null;
		let errorNode: HTMLElement | null = null;
		let stopWatch: (() => void) | null = null;
		let unmountRun: (() => void) | null = null;
		let timer: ReturnType<typeof setTimeout> | null = null;
		let generation = 0;

		// Consecutive identical messages collapse into one entry with a count,
		// like the browser console does.
		const pushEntry = (event: ConsoleEvent) => {
			const list = logs.get();
			const last = list[list.length - 1];
			if (
				last != null &&
				last.level === event.level &&
				last.text === event.text &&
				last.location === event.location
			) {
				logs.set([...list.slice(0, -1), { ...last, count: last.count + 1 }]);
				return;
			}
			logs.push({ id: nextEntryId++, count: 1, ...event });
		};

		const showError = (message: string) => {
			if (errorNode == null || frameHost == null) return;
			errorNode.hidden = false;
			errorNode.textContent = message;
			frameHost.hidden = true;
		};

		const showFrame = () => {
			if (errorNode == null || frameHost == null) return;
			errorNode.hidden = true;
			errorNode.textContent = "";
			frameHost.hidden = false;
		};

		const remount = (source: LessonFile[]) => {
			const current = ++generation;
			unmountRun?.();
			unmountRun = null;
			frame?.destroy();
			frame = null;
			logs.set([]);
			start(source, current);
		};

		// Boots the lesson in the frame: kit lessons route against the virtual
		// location (kept in sync with the URL bar), single-file lessons mount
		// their `index.ts` export directly.
		const bootLesson = async (
			source: LessonFile[],
			nextFrame: PreviewFrame,
		): Promise<() => void> => {
			if (isKitLesson(source)) {
				const initial = urlPath.get() === "" ? "/" : urlPath.get();
				const app = await runKitApp(source, nextFrame.body, nextFrame.window, initial);
				const stopLocation = watch([app.location], (location) => {
					const value = `${location.path}${location.search}${location.hash}`;
					if (urlPath.get() !== value) urlPath.set(value);
				});
				const stopPath = watch([urlPath], (value) => {
					if (value !== "") void app.navigate(value);
				});
				return () => {
					stopPath();
					stopLocation();
					app.stop();
				};
			}
			const single = source.find((file) => file.path === "index.ts") ?? source[0];
			if (single == null) throw new Error("Nothing to run — the lesson has no files.");
			return runLesson(single.content, nextFrame.body, nextFrame.window);
		};

		const start = (source: LessonFile[], current: number) => {
			if (current !== generation || frameHost == null) return;
			// The playground mounts bottom-up, so the host may not be in the
			// document yet — an iframe only gets a document once connected.
			if (!frameHost.isConnected) {
				// no frame to boot during SSR, and nothing to wait on
				if (typeof requestAnimationFrame === "undefined") return;
				// rAF is paused entirely in hidden tabs, so race it against a
				// timer — whichever fires first retries (once).
				let retried = false;
				const retry = () => {
					if (retried) return;
					retried = true;
					start(source, current);
				};
				requestAnimationFrame(retry);
				setTimeout(retry, 100);
				return;
			}

			const nextFrame = createPreviewFrame(
				frameHost,
				(event) => {
					// Ignore output from a torn-down frame's stragglers.
					if (current !== generation) return;
					pushEntry(event);
				},
				() => {
					// The frame was moved and its document wiped — boot again.
					if (current !== generation) return;
					remount(files.get());
				},
			);
			frame = nextFrame;

			void bootLesson(source, nextFrame)
				.then((stop) => {
					if (current !== generation) {
						stop();
						return;
					}
					unmountRun = stop;
					showFrame();
				})
				.catch((error: unknown) => {
					if (current !== generation) return;
					const message = toErrorMessage(error);
					pushEntry({ level: "error", text: message, location: null, stack: [] });
					showError(message);
				});
		};

		return {
			mount(parent: HTMLElement) {
				// browser-only pane: the preview iframe needs a real DOM, so SSR renders nothing
				if (typeof document === "undefined") return;
				root = document.createElement("div");
				root.className = "relative h-full min-h-0";

				errorNode = document.createElement("pre");
				errorNode.className =
					"tutorial-preview-error m-0 h-full overflow-auto whitespace-pre-wrap p-4 text-xs text-red-300";
				errorNode.hidden = true;

				frameHost = document.createElement("div");
				frameHost.className = "h-full";

				root.append(errorNode, frameHost);
				parent.appendChild(root);

				let first = true;
				stopWatch = watch([files, tick], (source) => {
					if (timer != null) clearTimeout(timer);
					if (first) {
						first = false;
						remount(source);
						return;
					}
					timer = setTimeout(() => remount(source), 250);
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
				frame?.destroy();
				frame = null;
				root?.remove();
				root = null;
				frameHost = null;
				errorNode = null;
			},
			getFirstDomNode() {
				return root;
			},
		};
	};
}
