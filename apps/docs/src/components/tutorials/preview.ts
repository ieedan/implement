import {
	watch,
	type IMountable,
	type Mountable,
	type Readable,
	type Signal,
} from "@implementjs/core";
import {
	CONSOLE_LEVELS,
	formatConsoleArgs,
	formatFileLocation,
	formatStackLines,
	frameLocation,
	getErrorStack,
	parseStack,
	type ConsoleEntry,
} from "../../lib/console-format";
import { runLesson } from "../../lib/run-lesson";
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
		destroy: () => iframe.remove(),
	};
}

export function LessonPreview(
	code: Readable<string>,
	tick: Readable<number>,
	logs: Signal<ConsoleEntry[]>,
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

		const remount = (source: string) => {
			const current = ++generation;
			unmountRun?.();
			unmountRun = null;
			frame?.destroy();
			frame = null;
			logs.set([]);
			start(source, current);
		};

		const start = (source: string, current: number) => {
			if (current !== generation || frameHost == null) return;
			// The playground mounts bottom-up, so the host may not be in the
			// document yet — an iframe only gets a document once connected.
			if (!frameHost.isConnected) {
				requestAnimationFrame(() => start(source, current));
				return;
			}

			const nextFrame = createPreviewFrame(frameHost, (event) => {
				// Ignore output from a torn-down frame's stragglers.
				if (current !== generation) return;
				pushEntry(event);
			});
			frame = nextFrame;

			void runLesson(source, nextFrame.body, nextFrame.window)
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
				stopWatch = watch([code, tick], (source) => {
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
