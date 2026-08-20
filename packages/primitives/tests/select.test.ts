// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { App, Span, signal } from "@implementjs/core";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectGroupHeading,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "../src/index";

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

describe("select value labels", () => {
	it("uses items on the root for SelectValue", async () => {
		const value = signal<string | null>("apple");
		const { target, unmount } = await mount(
			Select(
				{
					value,
					items: [
						{ value: "apple", label: "Apple" },
						{ value: "banana", label: "Banana" },
					],
				},
				SelectTrigger({}, SelectValue({ placeholder: "Pick" })),
				SelectContent(
					{},
					SelectItem({ value: "apple" }, "Apple"),
					SelectItem({ value: "banana" }, "Banana"),
				),
			),
		);

		expect(element(target, "[data-select-trigger]").textContent).toBe("Apple");

		element(target, "[data-select-item]", 1).click();
		expect(element(target, "[data-select-trigger]").textContent).toBe("Banana");

		unmount();
	});

	it("falls back to a sole string child's text when items are omitted", async () => {
		const value = signal<string | null>("apple");
		const { target, unmount } = await mount(
			Select(
				{ value },
				SelectTrigger({}, SelectValue({ placeholder: "Pick" })),
				SelectContent({}, SelectItem({ value: "apple" }, "Apple")),
			),
		);

		expect(element(target, "[data-select-trigger]").textContent).toBe("Apple");
		unmount();
	});

	it("falls back to option text content for richer children", async () => {
		const value = signal<string | null>("apple");
		const { target, unmount } = await mount(
			Select(
				{ value },
				SelectTrigger({}, SelectValue({ placeholder: "Pick" })),
				SelectContent({}, SelectItem({ value: "apple" }, Span({}, "Apple"))),
			),
		);

		expect(element(target, "[data-select-trigger]").textContent).toBe("Apple");
		unmount();
	});

	it("prefers items over option text", async () => {
		const value = signal<string | null>("apple");
		const { target, unmount } = await mount(
			Select(
				{ value, items: [{ value: "apple", label: "Green Apple" }] },
				SelectTrigger({}, SelectValue({})),
				SelectContent({}, SelectItem({ value: "apple" }, "Apple")),
			),
		);

		expect(element(target, "[data-select-trigger]").textContent).toBe("Green Apple");
		unmount();
	});

	it("uses the item label prop when items are omitted", async () => {
		const value = signal<string | null>("us");
		const { target, unmount } = await mount(
			Select(
				{ value },
				SelectTrigger({}, SelectValue({})),
				SelectContent({}, SelectItem({ value: "us", label: "United States" }, "US")),
			),
		);

		expect(element(target, "[data-select-trigger]").textContent).toBe("United States");
		unmount();
	});

	it("shows the placeholder when nothing is selected", async () => {
		const { target, unmount } = await mount(
			Select(
				{},
				SelectTrigger({}, SelectValue({ placeholder: "Select a fruit" })),
				SelectContent({}, SelectItem({ value: "apple" }, "Apple")),
			),
		);

		expect(element(target, "[data-select-trigger]").textContent).toBe("Select a fruit");
		unmount();
	});

	it("joins labels for multiple selections", async () => {
		const value = signal(["apple", "banana"]);
		const { target, unmount } = await mount(
			Select(
				{
					type: "multiple",
					value,
					items: [
						{ value: "apple", label: "Apple" },
						{ value: "banana", label: "Banana" },
					],
				},
				SelectTrigger({}, SelectValue({ placeholder: "Pick" })),
				SelectContent(
					{},
					SelectItem({ value: "apple" }, "Apple"),
					SelectItem({ value: "banana" }, "Banana"),
				),
			),
		);

		expect(element(target, "[data-select-trigger]").textContent).toBe("Apple, Banana");
		unmount();
	});

	it("exposes selected labels through render", async () => {
		const value = signal<string | null>("apple");
		let seen: string | undefined;
		const { unmount } = await mount(
			Select(
				{ value, items: [{ value: "apple", label: "Apple" }] },
				SelectTrigger(
					{},
					SelectValue({
						render: (props) => {
							if (props.type === "single") {
								return props.selected.bind((item) => {
									seen = item?.label;
									return item?.label ?? "";
								});
							}
							return "";
						},
					}),
				),
				SelectContent({}, SelectItem({ value: "apple" }, "Apple")),
			),
		);

		expect(seen).toBe("Apple");
		unmount();
	});
});

describe("select groups", () => {
	it("labels the group with the heading", async () => {
		const { target, unmount } = await mount(
			Select(
				{},
				SelectTrigger({}, SelectValue({})),
				SelectContent(
					{},
					SelectGroup(
						{},
						SelectGroupHeading({}, "Citrus"),
						SelectItem({ value: "orange" }, "Orange"),
					),
				),
			),
		);

		const group = element(target, "[data-select-group]");
		const heading = element(target, "[data-select-group-heading]");
		expect(group.getAttribute("role")).toBe("group");
		expect(group.getAttribute("aria-labelledby")).toBe(heading.id);
		expect(heading.textContent).toBe("Citrus");

		unmount();
	});
});
