// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { App, signal } from "@implementjs/core";
import { Dialog, DialogContent, DialogOverlay, DialogTrigger } from "../src/index";

/** Flush the microtask queue so deferred `Lifecycle.onMount` hooks run. */
function tick() {
	return new Promise<void>((resolve) => {
		queueMicrotask(() => queueMicrotask(resolve));
	});
}

async function mount(tree: Parameters<ReturnType<typeof App>["render"]>[0]) {
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

function element(target: ParentNode, selector: string, index = 0): HTMLElement {
	const el = target.querySelectorAll(selector)[index];
	if (!(el instanceof HTMLElement)) throw new Error(`No ${selector} at ${index}`);
	return el;
}

describe("nested dialogs", () => {
	afterEach(() => {
		document.body.removeAttribute("style");
	});

	it("marks nested overlay and content, and the parent when the nested dialog opens", async () => {
		const inner = signal(false);
		const { target, unmount } = await mount(
			Dialog(
				{ open: true },
				DialogTrigger({}, "Outer"),
				DialogOverlay({}),
				DialogContent(
					{},
					"Outer",
					Dialog(
						{ open: inner },
						DialogTrigger({}, "Inner"),
						DialogOverlay({}),
						DialogContent({}, "Inner"),
					),
				),
			),
		);

		const outerContent = element(target, "[data-dialog-content]", 0);
		const innerContent = element(target, "[data-dialog-content]", 1);
		const outerOverlay = element(target, "[data-dialog-overlay]", 0);
		const innerOverlay = element(target, "[data-dialog-overlay]", 1);

		expect(outerContent.hasAttribute("data-nested")).toBe(false);
		expect(innerContent.hasAttribute("data-nested")).toBe(true);
		expect(innerOverlay.hasAttribute("data-nested")).toBe(true);
		expect(outerContent.getAttribute("data-nested-level")).toBe("0");
		expect(innerContent.getAttribute("data-nested-level")).toBe("1");
		expect(innerOverlay.getAttribute("data-nested-level")).toBe("1");
		expect(outerContent.style.getPropertyValue("--ip-nested-level")).toBe("0");
		expect(innerContent.style.getPropertyValue("--ip-nested-level")).toBe("1");
		expect(outerContent.hasAttribute("data-nested-open")).toBe(false);
		expect(outerContent.getAttribute("data-nested-count")).toBe("0");
		expect(outerContent.style.getPropertyValue("--ip-nested-count")).toBe("0");

		inner.set(true);
		expect(outerContent.hasAttribute("data-nested-open")).toBe(true);
		expect(outerContent.getAttribute("data-nested-count")).toBe("1");
		expect(outerOverlay.getAttribute("data-nested-count")).toBe("1");
		expect(outerContent.style.getPropertyValue("--ip-nested-count")).toBe("1");
		expect(innerContent.hasAttribute("data-nested-open")).toBe(false);

		inner.set(false);
		expect(outerContent.hasAttribute("data-nested-open")).toBe(false);
		expect(outerContent.getAttribute("data-nested-count")).toBe("0");
		expect(outerContent.style.getPropertyValue("--ip-nested-count")).toBe("0");

		unmount();
	});

	it("counts open descendants through a grandparent stack", async () => {
		const child = signal(true);
		const grandchild = signal(false);
		const { target, unmount } = await mount(
			Dialog(
				{ open: true },
				DialogTrigger({}, "A"),
				DialogContent(
					{},
					"A",
					Dialog(
						{ open: child },
						DialogTrigger({}, "B"),
						DialogContent(
							{},
							"B",
							Dialog({ open: grandchild }, DialogTrigger({}, "C"), DialogContent({}, "C")),
						),
					),
				),
			),
		);

		const a = element(target, "[data-dialog-content]", 0);
		const b = element(target, "[data-dialog-content]", 1);
		const c = element(target, "[data-dialog-content]", 2);
		expect(a.getAttribute("data-nested-count")).toBe("1");
		expect(b.getAttribute("data-nested-count")).toBe("0");
		expect(c.hasAttribute("data-nested")).toBe(true);
		expect(a.getAttribute("data-nested-level")).toBe("0");
		expect(b.getAttribute("data-nested-level")).toBe("1");
		expect(c.getAttribute("data-nested-level")).toBe("2");

		grandchild.set(true);
		expect(a.getAttribute("data-nested-count")).toBe("2");
		expect(b.getAttribute("data-nested-count")).toBe("1");
		expect(b.hasAttribute("data-nested-open")).toBe(true);
		expect(c.getAttribute("data-nested-count")).toBe("0");

		grandchild.set(false);
		expect(a.getAttribute("data-nested-count")).toBe("1");
		expect(b.hasAttribute("data-nested-open")).toBe(false);

		unmount();
	});

	it("closes nested dialogs when the parent closes", async () => {
		const outer = signal(true);
		const inner = signal(true);
		const { target, unmount } = await mount(
			Dialog(
				{ open: outer },
				DialogTrigger({}, "Outer"),
				DialogContent(
					{},
					"Outer",
					Dialog({ open: inner }, DialogTrigger({}, "Inner"), DialogContent({}, "Inner")),
				),
			),
		);

		const outerContent = element(target, "[data-dialog-content]", 0);
		const innerContent = element(target, "[data-dialog-content]", 1);
		expect(outerContent.getAttribute("data-state")).toBe("open");
		expect(innerContent.getAttribute("data-state")).toBe("open");
		expect(inner.get()).toBe(true);

		outer.set(false);
		expect(outerContent.getAttribute("data-state")).toBe("closed");
		expect(innerContent.getAttribute("data-state")).toBe("closed");
		expect(inner.get()).toBe(false);

		unmount();
	});
});
