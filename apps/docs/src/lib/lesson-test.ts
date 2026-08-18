import { importLessonModule, runLesson, type ShimModule } from "./run-lesson";
import * as tutorialTest from "./tutorial-test";

/** The specifier lesson tests import — aliased to `tutorial-test.ts` in tsconfig. */
const TEST_MODULE = "@tutorial/test";

export type CheckResult = { passed: true } | { passed: false; message: string };

export async function checkLesson(code: string, testSource: string): Promise<CheckResult> {
	// Mounted off-screen (not display:none) so the checked code still gets layout.
	const host = document.createElement("div");
	host.style.position = "fixed";
	host.style.left = "-10000px";
	host.style.top = "0";
	host.style.width = "800px";
	document.body.appendChild(host);

	// Blocking dialogs would freeze the page mid-check (the events lesson suggests
	// alert()), so stub them while the lesson code and its test run.
	const dialogs = { alert: window.alert, confirm: window.confirm, prompt: window.prompt };
	window.alert = () => {};
	window.confirm = () => true;
	window.prompt = () => null;

	let stop: (() => void) | null = null;
	try {
		stop = await runLesson(code, host);
		const test = await importLessonModule(testSource, {
			[TEST_MODULE]: tutorialTest as unknown as ShimModule,
		});
		try {
			if (typeof test.mod.default !== "function") {
				throw new Error("Lesson test must default-export a function.");
			}
			tutorialTest.__setActiveLesson({ root: host, source: code });
			await (test.mod.default as () => void | Promise<void>)();
		} finally {
			tutorialTest.__setActiveLesson(null);
			test.revoke();
		}
		return { passed: true };
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return { passed: false, message };
	} finally {
		window.alert = dialogs.alert;
		window.confirm = dialogs.confirm;
		window.prompt = dialogs.prompt;
		stop?.();
		host.remove();
	}
}
