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
	type ItemValue,
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

/** The `data-value` of the one item carrying `data-highlighted`, if any. */
function highlightedValue(target: ParentNode): string | null {
	return (
		target.querySelector("[data-select-item][data-highlighted]")?.getAttribute("data-value") ?? null
	);
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

describe("select number values", () => {
	it("keeps a number a number through selection", async () => {
		const value = signal<number | null>(null);
		const { target, unmount } = await mount(
			Select(
				{
					value,
					items: [
						{ value: 1, label: "One" },
						{ value: 2, label: "Two" },
					],
				},
				SelectTrigger({}, SelectValue({ placeholder: "Pick" })),
				SelectContent({}, SelectItem({ value: 1 }, "One"), SelectItem({ value: 2 }, "Two")),
			),
		);

		const items = target.querySelectorAll<HTMLElement>("[data-select-item]");
		// the DOM only speaks strings, so `data-value` is where the number flattens
		expect(items[1]!.getAttribute("data-value")).toBe("2");

		items[1]!.click();
		expect(value.get()).toBe(2);
		expect(items[1]!.getAttribute("data-selected")).toBe("");
		expect(element(target, "[data-select-trigger]").textContent).toBe("Two");

		unmount();
	});

	it("reads the number back off the DOM when a key selects the item", async () => {
		const value = signal<number | null>(null);
		const { target, unmount } = await mount(
			Select(
				{ value },
				SelectTrigger({}, SelectValue({ placeholder: "Pick" })),
				SelectContent({}, SelectItem({ value: 10 }, "Ten"), SelectItem({ value: 20 }, "Twenty")),
			),
		);

		const trigger = element(target, "[data-select-trigger]");
		trigger.click();
		trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
		trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

		expect(value.get()).toBe(20);

		unmount();
	});

	it("holds numbers in a multiple selection", async () => {
		const value = signal<number[]>([]);
		const { target, unmount } = await mount(
			Select(
				{
					type: "multiple",
					value,
					items: [
						{ value: 1, label: "One" },
						{ value: 2, label: "Two" },
					],
				},
				SelectTrigger({}, SelectValue({ placeholder: "Pick" })),
				SelectContent({}, SelectItem({ value: 1 }, "One"), SelectItem({ value: 2 }, "Two")),
			),
		);

		const items = target.querySelectorAll<HTMLElement>("[data-select-item]");
		items[0]!.click();
		items[1]!.click();
		expect(value.get()).toEqual([1, 2]);
		expect(element(target, "[data-select-trigger]").textContent).toBe("One, Two");

		items[0]!.click();
		expect(value.get()).toEqual([2]);

		unmount();
	});

	it("hands onValueChange the number", async () => {
		const seen: (ItemValue | null)[] = [];
		const { target, unmount } = await mount(
			Select(
				{ onValueChange: (value) => seen.push(value) },
				SelectTrigger({}, SelectValue({ placeholder: "Pick" })),
				SelectContent({}, SelectItem({ value: 1 }, "One"), SelectItem({ value: 2 }, "Two")),
			),
		);

		target.querySelectorAll<HTMLElement>("[data-select-item]")[1]!.click();
		expect(seen).toEqual([2]);

		unmount();
	});

	it("falls back to the number itself when nothing names the item", async () => {
		const value = signal<number | null>(7);
		const { target, unmount } = await mount(
			Select(
				{ value },
				SelectTrigger({}, SelectValue({ placeholder: "Pick" })),
				SelectContent({}, SelectItem({ value: 7 })),
			),
		);

		expect(element(target, "[data-select-trigger]").textContent).toBe("7");
		unmount();
	});
});

describe("select highlight on open", () => {
	const fruits = [
		{ value: "apple", label: "Apple" },
		{ value: "banana", label: "Banana" },
		{ value: "blueberry", label: "Blueberry" },
	];

	function items() {
		return fruits.map((fruit) => SelectItem({ value: fruit.value }, fruit.label));
	}

	async function openSingle(value: string | null) {
		const { target, unmount } = await mount(
			Select(
				{ value: signal(value), items: fruits },
				SelectTrigger({}, SelectValue({ placeholder: "Pick" })),
				SelectContent({}, ...items()),
			),
		);
		element(target, "[data-select-trigger]").click();
		return { target, unmount };
	}

	it("lands on the selected value, not the first item", async () => {
		const { target, unmount } = await openSingle("blueberry");
		expect(highlightedValue(target)).toBe("blueberry");
		unmount();
	});

	it("lands on the first item when nothing is selected", async () => {
		const { target, unmount } = await openSingle(null);
		expect(highlightedValue(target)).toBe("apple");
		unmount();
	});

	it("lands on the first selected value of a multiple select", async () => {
		const { target, unmount } = await mount(
			Select(
				{ type: "multiple", value: signal(["blueberry", "banana"]), items: fruits },
				SelectTrigger({}, SelectValue({ placeholder: "Pick" })),
				SelectContent({}, ...items()),
			),
		);

		element(target, "[data-select-trigger]").click();
		expect(highlightedValue(target)).toBe("banana");
		unmount();
	});

	it("falls back to the first item when the selected one is disabled", async () => {
		const { target, unmount } = await mount(
			Select(
				{ value: signal<string | null>("banana"), items: fruits },
				SelectTrigger({}, SelectValue({ placeholder: "Pick" })),
				SelectContent(
					{},
					SelectItem({ value: "apple" }, "Apple"),
					SelectItem({ value: "banana", disabled: true }, "Banana"),
				),
			),
		);

		element(target, "[data-select-trigger]").click();
		expect(highlightedValue(target)).toBe("apple");
		unmount();
	});

	it("moves the arrow keys on from the selected value", async () => {
		const { target, unmount } = await openSingle("banana");
		element(target, "[data-select-trigger]").dispatchEvent(
			new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
		);

		expect(highlightedValue(target)).toBe("blueberry");
		unmount();
	});

	it("re-opens on the value picked last time", async () => {
		const { target, unmount } = await openSingle(null);
		element(target, "[data-select-item]", 2).click();
		element(target, "[data-select-trigger]").click();

		expect(highlightedValue(target)).toBe("blueberry");
		unmount();
	});
});
