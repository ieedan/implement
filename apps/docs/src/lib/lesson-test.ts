import type { LessonFile } from "./tutorials";
import { runKitApp, type KitApp } from "./run-kit-lesson";
import { importLessonModule, runLesson, type ShimModule } from "./run-lesson";
import * as tutorialTest from "./tutorial-test";

/** The specifier lesson tests import — aliased to `tutorial-test.ts` in tsconfig. */
const TEST_MODULE = "@tutorial/test";

export type CheckResult = { passed: true } | { passed: false; message: string };

/** An off-screen mount target (not display:none, so the checked code still gets layout). */
function makeHost(): HTMLElement {
	const host = document.createElement("div");
	host.style.position = "fixed";
	host.style.left = "-10000px";
	host.style.top = "0";
	host.style.width = "800px";
	document.body.appendChild(host);
	return host;
}

/**
 * Blocking dialogs would freeze the page mid-check (the events lesson suggests
 * alert()), so stub them while the lesson code and its test run.
 */
function stubDialogs(): () => void {
	const dialogs = { alert: window.alert, confirm: window.confirm, prompt: window.prompt };
	window.alert = () => {};
	window.confirm = () => true;
	window.prompt = () => null;
	return () => {
		window.alert = dialogs.alert;
		window.confirm = dialogs.confirm;
		window.prompt = dialogs.prompt;
	};
}

async function runTest(
	testSource: string,
	lesson: Parameters<typeof tutorialTest.__setActiveLesson>[0],
): Promise<void> {
	const test = await importLessonModule(testSource, {
		// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Tutorial test helpers are injected as a shim module.
		[TEST_MODULE]: tutorialTest as unknown as ShimModule,
	});
	try {
		if (typeof test.mod.default !== "function") {
			throw new Error("Lesson test must default-export a function.");
		}
		tutorialTest.__setActiveLesson(lesson);
		// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Default export validated as a function before invocation.
		await (test.mod.default as () => void | Promise<void>)();
	} finally {
		tutorialTest.__setActiveLesson(null);
		test.revoke();
	}
}

export async function checkLesson(code: string, testSource: string): Promise<CheckResult> {
	const host = makeHost();
	const restoreDialogs = stubDialogs();
	let stop: (() => void) | null = null;
	try {
		stop = await runLesson(code, host);
		await runTest(testSource, { root: host, source: code });
		return { passed: true };
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return { passed: false, message };
	} finally {
		restoreDialogs();
		stop?.();
		host.remove();
	}
}

/**
 * The kit-lesson variant: boots the whole routes tree off-screen (loads and
 * endpoints included) and hands the test `navigate()` plus per-file
 * `source(path)` on top of the usual queries.
 */
export async function checkKitLesson(
	files: LessonFile[],
	testSource: string,
): Promise<CheckResult> {
	const host = makeHost();
	const restoreDialogs = stubDialogs();
	let app: KitApp | null = null;
	try {
		app = await runKitApp(files, host, window);
		const running = app;
		await runTest(testSource, {
			root: host,
			source: files.map((file) => file.content).join("\n"),
			files,
			navigate: (href) => running.navigate(href),
		});
		return { passed: true };
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return { passed: false, message };
	} finally {
		restoreDialogs();
		app?.stop();
		host.remove();
	}
}
