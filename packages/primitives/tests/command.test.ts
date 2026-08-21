// @vitest-environment happy-dom
/* oxlint-disable typescript/no-unsafe-type-assertion -- Test mocks and DOM stubs require intentional narrowing. */
import { describe, expect, it } from "vitest";
import { App, If, signal } from "@implementjs/core";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandGroupHeading,
	CommandGroupItems,
	CommandInput,
	CommandItem,
	CommandList,
	CommandViewport,
	computeCommandScore,
} from "../src/index";

/** Flush the microtask queue so deferred `Lifecycle.onMount` hooks and command syncs run. */
function tick() {
	return new Promise<void>((resolve) => {
		queueMicrotask(() => queueMicrotask(() => queueMicrotask(resolve)));
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

function visibleValues(target: ParentNode): string[] {
	return Array.from(target.querySelectorAll("[data-command-item]:not([hidden])")).map(
		(el) => el.getAttribute("data-value") ?? "",
	);
}

function keydown(target: HTMLElement, key: string, init: KeyboardEventInit = {}) {
	target.dispatchEvent(
		new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init }),
	);
}

function fruitsCommand(opts: { search?: ReturnType<typeof signal<string>> } = {}) {
	return Command(
		{ search: opts.search },
		CommandInput({}),
		CommandList(
			{},
			CommandViewport(
				{},
				CommandEmpty({}, "No results"),
				CommandItem({ value: "apple" }, "Apple"),
				CommandItem({ value: "banana" }, "Banana"),
				CommandItem({ value: "cherry" }, "Cherry"),
			),
		),
	);
}

describe("command filtering", () => {
	it("shows every item and highlights the first when there is no search", async () => {
		const { target, unmount } = await mount(fruitsCommand());

		expect(visibleValues(target)).toEqual(["apple", "banana", "cherry"]);
		expect(element(target, "[data-command-item]").getAttribute("data-selected")).toBe("");
		expect(element(target, "[data-command-empty]").hasAttribute("hidden")).toBe(true);

		unmount();
	});

	it("hides items that do not match the search", async () => {
		const search = signal("");
		const { target, unmount } = await mount(fruitsCommand({ search }));

		search.set("ban");
		await tick();

		expect(visibleValues(target)).toEqual(["banana"]);
		const banana = element(target, '[data-command-item][data-value="banana"]');
		expect(banana.getAttribute("data-selected")).toBe("");

		search.set("");
		await tick();
		expect(visibleValues(target)).toEqual(["apple", "banana", "cherry"]);

		unmount();
	});

	it("shows the empty state when nothing matches", async () => {
		const search = signal("");
		const { target, unmount } = await mount(fruitsCommand({ search }));

		search.set("zzz");
		await tick();

		expect(visibleValues(target)).toEqual([]);
		expect(element(target, "[data-command-empty]").hasAttribute("hidden")).toBe(false);

		unmount();
	});

	it("sorts better matches to the top", async () => {
		const search = signal("");
		const { target, unmount } = await mount(
			Command(
				{ search },
				CommandInput({}),
				CommandList(
					{},
					CommandViewport(
						{},
						CommandItem({ value: "grape soda" }, "Grape Soda"),
						CommandItem({ value: "soda" }, "Soda"),
					),
				),
			),
		);

		search.set("soda");
		await tick();

		// "soda" is a full continuous match and outranks "grape soda"
		expect(visibleValues(target)).toEqual(["soda", "grape soda"]);

		unmount();
	});

	it("matches keywords", async () => {
		const search = signal("");
		const { target, unmount } = await mount(
			Command(
				{ search },
				CommandInput({}),
				CommandList(
					{},
					CommandViewport({}, CommandItem({ value: "trash", keywords: ["delete"] }, "Trash")),
				),
			),
		);

		search.set("delete");
		await tick();
		expect(visibleValues(target)).toEqual(["trash"]);

		unmount();
	});

	it("falls back to the item's text content as its value", async () => {
		const { target, unmount } = await mount(
			Command({}, CommandList({}, CommandViewport({}, CommandItem({}, "Calculator")))),
		);

		expect(element(target, "[data-command-item]").getAttribute("data-value")).toBe("Calculator");

		unmount();
	});
});

describe("command groups", () => {
	it("hides a group when every item in it is filtered out", async () => {
		const search = signal("");
		const { target, unmount } = await mount(
			Command(
				{ search },
				CommandInput({}),
				CommandList(
					{},
					CommandViewport(
						{},
						CommandGroup(
							{ value: "fruits" },
							CommandGroupHeading({}, "Fruits"),
							CommandGroupItems({}, CommandItem({ value: "apple" }, "Apple")),
						),
						CommandGroup(
							{ value: "vegetables" },
							CommandGroupHeading({}, "Vegetables"),
							CommandGroupItems({}, CommandItem({ value: "carrot" }, "Carrot")),
						),
					),
				),
			),
		);

		search.set("car");
		await tick();

		const fruits = element(target, '[data-command-group][data-value="fruits"]');
		const vegetables = element(target, '[data-command-group][data-value="vegetables"]');
		expect(fruits.hasAttribute("hidden")).toBe(true);
		expect(vegetables.hasAttribute("hidden")).toBe(false);

		unmount();
	});

	it("labels the group's items with its heading", async () => {
		const { target, unmount } = await mount(
			Command(
				{},
				CommandList(
					{},
					CommandViewport(
						{},
						CommandGroup(
							{ value: "fruits" },
							CommandGroupHeading({ id: "fruits-heading" }, "Fruits"),
							CommandGroupItems({}, CommandItem({ value: "apple" }, "Apple")),
						),
					),
				),
			),
		);

		expect(element(target, "[data-command-group-items]").getAttribute("aria-labelledby")).toBe(
			"fruits-heading",
		);
		expect(element(target, '[data-value="apple"]').getAttribute("data-group")).toBe("fruits");

		unmount();
	});
});

describe("command keyboard", () => {
	it("moves the highlight with the arrow keys and selects with Enter", async () => {
		const chosen = signal<string | null>(null);
		const { target, unmount } = await mount(
			Command(
				{},
				CommandInput({}),
				CommandList(
					{},
					CommandViewport(
						{},
						CommandItem({ value: "apple", onSelect: () => chosen.set("apple") }, "Apple"),
						CommandItem({ value: "banana", onSelect: () => chosen.set("banana") }, "Banana"),
					),
				),
			),
		);

		const root = element(target, "[data-command-root]");
		keydown(root, "ArrowDown");
		expect(element(target, '[data-value="banana"]').getAttribute("data-selected")).toBe("");

		keydown(root, "Enter");
		expect(chosen.get()).toBe("banana");

		unmount();
	});

	it("skips disabled items", async () => {
		const { target, unmount } = await mount(
			Command(
				{},
				CommandList(
					{},
					CommandViewport(
						{},
						CommandItem({ value: "apple" }, "Apple"),
						CommandItem({ value: "banana", disabled: true }, "Banana"),
						CommandItem({ value: "cherry" }, "Cherry"),
					),
				),
			),
		);

		const root = element(target, "[data-command-root]");
		keydown(root, "ArrowDown");
		expect(element(target, '[data-value="cherry"]').getAttribute("data-selected")).toBe("");

		unmount();
	});

	it("stops at the ends without loop and wraps with it", async () => {
		const withLoop = async (loop: boolean) => {
			const { target, unmount } = await mount(
				Command(
					{ loop },
					CommandList(
						{},
						CommandViewport({}, CommandItem({ value: "a" }, "A"), CommandItem({ value: "b" }, "B")),
					),
				),
			);
			const root = element(target, "[data-command-root]");
			keydown(root, "ArrowUp");
			const selected = target.querySelector("[data-selected]")?.getAttribute("data-value");
			unmount();
			return selected;
		};

		expect(await withLoop(false)).toBe("a");
		expect(await withLoop(true)).toBe("b");
	});

	it("jumps to the first and last item with Home and End", async () => {
		const { target, unmount } = await mount(fruitsCommand());

		const root = element(target, "[data-command-root]");
		keydown(root, "End");
		expect(element(target, '[data-value="cherry"]').getAttribute("data-selected")).toBe("");
		keydown(root, "Home");
		expect(element(target, '[data-value="apple"]').getAttribute("data-selected")).toBe("");

		unmount();
	});

	it("supports vim bindings", async () => {
		const { target, unmount } = await mount(fruitsCommand());

		const root = element(target, "[data-command-root]");
		keydown(root, "j", { ctrlKey: true });
		expect(element(target, '[data-value="banana"]').getAttribute("data-selected")).toBe("");
		keydown(root, "k", { ctrlKey: true });
		expect(element(target, '[data-value="apple"]').getAttribute("data-selected")).toBe("");

		unmount();
	});
});

function gridCommand(columns = 2) {
	// 2 columns: [a b] [c d] [e]
	return Command(
		{ columns },
		CommandList(
			{},
			CommandViewport(
				{},
				CommandItem({ value: "a" }, "A"),
				CommandItem({ value: "b" }, "B"),
				CommandItem({ value: "c" }, "C"),
				CommandItem({ value: "d" }, "D"),
				CommandItem({ value: "e" }, "E"),
			),
		),
	);
}

function selectedValue(target: ParentNode): string | undefined {
	return target.querySelector("[data-selected]")?.getAttribute("data-value") ?? undefined;
}

describe("command grid", () => {
	it("moves within a row with left and right", async () => {
		const { target, unmount } = await mount(gridCommand());

		const root = element(target, "[data-command-root]");
		keydown(root, "ArrowRight");
		expect(selectedValue(target)).toBe("b");
		keydown(root, "ArrowLeft");
		expect(selectedValue(target)).toBe("a");

		unmount();
	});

	it("moves between rows with up and down, keeping the column", async () => {
		const { target, unmount } = await mount(gridCommand());

		const root = element(target, "[data-command-root]");
		keydown(root, "ArrowRight"); // b (row 0, col 1)
		keydown(root, "ArrowDown"); // d (row 1, col 1)
		expect(selectedValue(target)).toBe("d");
		keydown(root, "ArrowDown"); // e (row 2 has one item; falls back to it)
		expect(selectedValue(target)).toBe("e");
		keydown(root, "ArrowUp"); // e sits in column 0, so up lands on c
		expect(selectedValue(target)).toBe("c");

		unmount();
	});

	it("starts a new row for each group", async () => {
		const { target, unmount } = await mount(
			Command(
				{ columns: 2 },
				CommandList(
					{},
					CommandViewport(
						{},
						CommandGroup(
							{ value: "first" },
							CommandGroupItems(
								{},
								CommandItem({ value: "a" }, "A"),
								CommandItem({ value: "b" }, "B"),
							),
						),
						CommandGroup(
							{ value: "second" },
							CommandGroupItems({}, CommandItem({ value: "c" }, "C")),
						),
					),
				),
			),
		);

		const root = element(target, "[data-command-root]");
		keydown(root, "ArrowDown");
		expect(selectedValue(target)).toBe("c");

		unmount();
	});
});

describe("command input", () => {
	it("filters from typing in the input", async () => {
		const { target, unmount } = await mount(fruitsCommand());

		const input = element(target, "[data-command-input]") as HTMLInputElement;
		input.value = "che";
		input.dispatchEvent(new Event("input", { bubbles: true }));
		await tick();

		expect(visibleValues(target)).toEqual(["cherry"]);

		unmount();
	});

	it("points aria-activedescendant at the highlighted item", async () => {
		const { target, unmount } = await mount(
			Command(
				{},
				CommandInput({}),
				CommandList(
					{},
					CommandViewport({}, CommandItem({ id: "item-apple", value: "apple" }, "Apple")),
				),
			),
		);

		const input = element(target, "[data-command-input]");
		expect(input.getAttribute("aria-activedescendant")).toBe("item-apple");

		unmount();
	});
});

describe("command state", () => {
	it("keeps a provided initial value", async () => {
		const value = signal("banana");
		const { target, unmount } = await mount(
			Command(
				{ value },
				CommandList(
					{},
					CommandViewport(
						{},
						CommandItem({ value: "apple" }, "Apple"),
						CommandItem({ value: "banana" }, "Banana"),
					),
				),
			),
		);

		expect(element(target, '[data-value="banana"]').getAttribute("data-selected")).toBe("");
		expect(value.get()).toBe("banana");

		unmount();
	});

	it("moves the highlight when the highlighted item unmounts", async () => {
		const show = signal(true);
		const value = signal("");
		const { target, unmount } = await mount(
			Command(
				{ value },
				CommandList(
					{},
					CommandViewport(
						{},
						CommandItem({ value: "apple" }, "Apple"),
						If(show).Then(CommandItem({ value: "banana" }, "Banana")),
					),
				),
			),
		);

		const root = element(target, "[data-command-root]");
		keydown(root, "ArrowDown");
		expect(value.get()).toBe("banana");

		show.set(false);
		await tick();
		expect(value.get()).toBe("apple");

		unmount();
	});
});

describe("computeCommandScore", () => {
	it("scores continuous matches highest", () => {
		expect(computeCommandScore("apple", "apple")).toBe(1);
		expect(computeCommandScore("apple", "app")).toBeGreaterThan(
			computeCommandScore("apple", "ale"),
		);
		expect(computeCommandScore("apple", "zzz")).toBe(0);
	});

	it("scores keywords", () => {
		expect(computeCommandScore("trash", "delete", ["delete"])).toBeGreaterThan(0);
	});
});
