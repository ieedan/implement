// @vitest-environment happy-dom
/* oxlint-disable typescript/no-unsafe-type-assertion -- Test mocks and DOM stubs require intentional narrowing. */
import { describe, expect, it } from "vitest";
import { App, derived, signal } from "@implementjs/core";
import {
	DropdownMenu,
	DropdownMenuCheckboxGroup,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuGroupHeading,
	DropdownMenuItem,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
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

function items(target: ParentNode): HTMLElement[] {
	return Array.from(target.querySelectorAll<HTMLElement>("[data-dropdown-menu-checkbox-item]"));
}

/** The items' `data-state` in tree order, as one string to assert against. */
function states(target: ParentNode): string {
	return items(target)
		.map((item) => item.getAttribute("data-state"))
		.join(",");
}

describe("menu checkbox group", () => {
	it("checks the items named by the group's value", async () => {
		const visible = signal(["status-bar", "panel"]);
		const { target, unmount } = await mount(
			DropdownMenu(
				DropdownMenuTrigger({}, "Open"),
				DropdownMenuContent(
					DropdownMenuCheckboxGroup(
						{ value: visible },
						DropdownMenuGroupHeading({}, "Panels"),
						DropdownMenuCheckboxItem({ value: "status-bar" }, "Status bar"),
						DropdownMenuCheckboxItem({ value: "activity-bar" }, "Activity bar"),
						DropdownMenuCheckboxItem({ value: "panel" }, "Panel"),
					),
				),
			),
		);

		expect(states(target)).toBe("checked,unchecked,checked");
		expect(items(target).map((item) => item.getAttribute("aria-checked"))).toEqual([
			"true",
			"false",
			"true",
		]);

		// the group's array is what selecting an item edits, in either direction
		items(target)[1]!.click();
		expect(visible.get()).toEqual(["status-bar", "panel", "activity-bar"]);
		expect(states(target)).toBe("checked,checked,checked");

		items(target)[0]!.click();
		expect(visible.get()).toEqual(["panel", "activity-bar"]);
		expect(states(target)).toBe("unchecked,checked,checked");

		// and writing the signal from outside checks the items it names
		visible.set(["activity-bar"]);
		expect(states(target)).toBe("unchecked,checked,unchecked");

		unmount();
	});

	it("labels the group with the heading inside it", async () => {
		const { target, unmount } = await mount(
			DropdownMenu(
				DropdownMenuTrigger({}, "Open"),
				DropdownMenuContent(
					DropdownMenuCheckboxGroup(
						{},
						DropdownMenuGroupHeading({}, "Panels"),
						DropdownMenuCheckboxItem({ value: "panel" }, "Panel"),
					),
				),
			),
		);

		const group = target.querySelector("[data-dropdown-menu-checkbox-group]")!;
		const heading = target.querySelector("[data-dropdown-menu-group-heading]")!;
		expect(group.getAttribute("role")).toBe("group");
		expect(group.getAttribute("aria-labelledby")).toBe(heading.id);

		unmount();
	});

	it("leaves an item outside a group owning its own checked state", async () => {
		const checked = signal(false);
		const { target, unmount } = await mount(
			DropdownMenu(
				DropdownMenuTrigger({}, "Open"),
				DropdownMenuContent(DropdownMenuCheckboxItem({ checked }, "Status bar")),
			),
		);

		expect(states(target)).toBe("unchecked");

		items(target)[0]!.click();
		expect(checked.get()).toBe(true);
		expect(states(target)).toBe("checked");

		unmount();
	});
});

describe("menu number values", () => {
	it("holds numbers in a checkbox group", async () => {
		const columns = signal([1, 3]);
		const { target, unmount } = await mount(
			DropdownMenu(
				DropdownMenuTrigger({}, "Open"),
				DropdownMenuContent(
					DropdownMenuCheckboxGroup(
						{ value: columns },
						DropdownMenuCheckboxItem({ value: 1 }, "One"),
						DropdownMenuCheckboxItem({ value: 2 }, "Two"),
						DropdownMenuCheckboxItem({ value: 3 }, "Three"),
					),
				),
			),
		);

		expect(states(target)).toBe("checked,unchecked,checked");
		// the DOM only speaks strings, so `data-value` is where the number flattens
		expect(items(target).map((item) => item.getAttribute("data-value"))).toEqual(["1", "2", "3"]);

		items(target)[1]!.click();
		expect(columns.get()).toEqual([1, 3, 2]);

		items(target)[0]!.click();
		expect(columns.get()).toEqual([3, 2]);

		unmount();
	});

	it("holds a number in a radio group", async () => {
		const size = signal<number | null>(12);
		const { target, unmount } = await mount(
			DropdownMenu(
				DropdownMenuTrigger({}, "Open"),
				DropdownMenuContent(
					DropdownMenuRadioGroup(
						{ value: size },
						DropdownMenuRadioItem({ value: 12 }, "12px"),
						DropdownMenuRadioItem({ value: 14 }, "14px"),
					),
				),
			),
		);

		const radios = Array.from(
			target.querySelectorAll<HTMLElement>("[data-dropdown-menu-radio-item]"),
		);
		expect(radios.map((item) => item.getAttribute("data-state"))).toEqual(["checked", "unchecked"]);
		expect(radios.map((item) => item.getAttribute("data-value"))).toEqual(["12", "14"]);

		radios[1]!.click();
		expect(size.get()).toBe(14);
		expect(radios.map((item) => item.getAttribute("data-state"))).toEqual(["unchecked", "checked"]);

		unmount();
	});
});

describe("menu trigger disabled", () => {
	it("follows a derived value, not just a signal of its own", async () => {
		const board = signal<"private" | "public">("private");
		const isPublic = derived([board], (value) => value === "public");
		const { target, unmount } = await mount(
			DropdownMenu(
				DropdownMenuTrigger({ disabled: isPublic.bind((value) => !value) }, "Visibility"),
				DropdownMenuContent(DropdownMenuItem({}, "Anyone with the link")),
			),
		);

		const trigger = target.querySelector<HTMLButtonElement>("[data-dropdown-menu-trigger]")!;
		expect(trigger.disabled).toBe(true);
		expect(trigger.getAttribute("data-disabled")).toBe("");

		trigger.click();
		expect(trigger.getAttribute("data-state")).toBe("closed");

		// the value the trigger reads is two derivations away from what changed
		board.set("public");
		expect(trigger.disabled).toBe(false);
		expect(trigger.getAttribute("data-disabled")).toBe(null);

		trigger.click();
		expect(trigger.getAttribute("data-state")).toBe("open");

		unmount();
	});
});
