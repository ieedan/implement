// @vitest-environment happy-dom
/* oxlint-disable typescript/no-unsafe-type-assertion -- Test mocks and DOM stubs require intentional narrowing. */
import { describe, expect, it } from "vitest";
import { App, signal } from "@implementjs/core";
import {
	DropdownMenu,
	DropdownMenuCheckboxGroup,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuGroupHeading,
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
