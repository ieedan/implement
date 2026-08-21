import { App, type Child } from "@implementjs/core";

/** Flush the microtask queue so deferred hooks and validations run. */
export function tick(): Promise<void> {
	return new Promise((resolve) => {
		queueMicrotask(() => queueMicrotask(resolve));
	});
}

export async function mount(tree: Child) {
	const target = document.createElement("div");
	document.body.appendChild(target);
	const app = App({ target });
	const unmount = app.render(tree);
	await tick();
	return {
		target,
		unmount: () => {
			unmount();
			target.remove();
		},
	};
}

export function element<T extends HTMLElement>(target: ParentNode, selector: string, index = 0): T {
	const found = target.querySelectorAll(selector)[index];
	if (!(found instanceof HTMLElement)) throw new Error(`No ${selector} at ${index}`);
	return found as T;
}

/** Types into an input the way a user would: value first, then the event. */
export async function type(input: HTMLInputElement | HTMLTextAreaElement, value: string) {
	input.value = value;
	input.dispatchEvent(new Event("input", { bubbles: true }));
	await tick();
}
