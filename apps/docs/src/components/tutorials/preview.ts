import { watch, type IMountable, type Mountable, type Readable } from "@packages/implement";
import { runLesson } from "../../lib/run-lesson";

function toErrorMessage(error: unknown): string {
	if (error instanceof Error) return error.message;
	return String(error);
}

export function LessonPreview(code: Readable<string>, tick: Readable<number>): Mountable {
	return (): IMountable => {
		let root: HTMLElement | null = null;
		let frame: HTMLElement | null = null;
		let errorNode: HTMLElement | null = null;
		let stopWatch: (() => void) | null = null;
		let unmountRun: (() => void) | null = null;
		let timer: ReturnType<typeof setTimeout> | null = null;
		let generation = 0;

		const showError = (message: string) => {
			if (errorNode == null || frame == null) return;
			errorNode.hidden = false;
			errorNode.textContent = message;
			frame.hidden = true;
		};

		const showFrame = () => {
			if (errorNode == null || frame == null) return;
			errorNode.hidden = true;
			errorNode.textContent = "";
			frame.hidden = false;
		};

		const remount = (source: string) => {
			const current = ++generation;
			unmountRun?.();
			unmountRun = null;
			if (frame == null) return;
			frame.replaceChildren();

			void runLesson(source, frame)
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
					showError(toErrorMessage(error));
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

				frame = document.createElement("div");
				frame.className = "tutorial-preview h-full overflow-auto";

				root.append(errorNode, frame);
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
				root?.remove();
				root = null;
				frame = null;
				errorNode = null;
			},
			getFirstDomNode() {
				return root;
			},
		};
	};
}
