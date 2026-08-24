// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { App, signal } from "@implementjs/core";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
	Checkbox,
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
	Command,
	CommandInput,
	CommandItem,
	CommandList,
	CommandViewport,
	DropdownMenu,
	DropdownMenuCheckboxGroup,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuTrigger,
	RadioGroup,
	RadioGroupItem,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	Switch,
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
	RatingGroup,
	RatingGroupItem,
	Toggle,
	ToggleGroup,
	ToggleGroupItem,
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

describe("change callbacks", () => {
	it("reports a toggle's pressed state", async () => {
		const onPressedChange = vi.fn();
		const { target, unmount } = await mount(Toggle({ onPressedChange }, "Bold"));

		expect(onPressedChange).not.toHaveBeenCalled();

		element(target, "[data-toggle-root]").click();
		expect(onPressedChange).toHaveBeenCalledWith(true);

		element(target, "[data-toggle-root]").click();
		expect(onPressedChange).toHaveBeenLastCalledWith(false);
		expect(onPressedChange).toHaveBeenCalledTimes(2);

		unmount();
	});

	it("reports a switch's checked state", async () => {
		const onCheckedChange = vi.fn();
		const { target, unmount } = await mount(Switch({ onCheckedChange }));

		element(target, "[data-switch-root]").click();
		expect(onCheckedChange).toHaveBeenCalledWith(true);

		unmount();
	});

	it("reports a checkbox's checked and indeterminate states", async () => {
		const onCheckedChange = vi.fn();
		const onIndeterminateChange = vi.fn();
		const { target, unmount } = await mount(
			Checkbox({ indeterminate: true, onCheckedChange, onIndeterminateChange }),
		);

		element(target, "[data-checkbox-root]").click();
		expect(onIndeterminateChange).toHaveBeenCalledWith(false);
		expect(onCheckedChange).toHaveBeenCalledWith(true);

		unmount();
	});

	it("reports a collapsible's open state", async () => {
		const onOpenChange = vi.fn();
		const { target, unmount } = await mount(
			Collapsible(
				{ onOpenChange },
				CollapsibleTrigger({}, "Toggle"),
				CollapsibleContent({}, "The content"),
			),
		);

		element(target, "[data-collapsible-trigger]").click();
		expect(onOpenChange).toHaveBeenCalledWith(true);

		unmount();
	});

	it("reports a single accordion's open item, and `null` once it closes", async () => {
		const onValueChange = vi.fn();
		const { target, unmount } = await mount(
			Accordion(
				{ onValueChange },
				AccordionItem({ value: "one" }, AccordionTrigger({}, "One"), AccordionContent({}, "1")),
			),
		);

		element(target, "[data-accordion-trigger]").click();
		expect(onValueChange).toHaveBeenCalledWith("one");

		element(target, "[data-accordion-trigger]").click();
		expect(onValueChange).toHaveBeenLastCalledWith(null);

		unmount();
	});

	it("reports a multiple accordion's open items as an array", async () => {
		const onValueChange = vi.fn();
		const { target, unmount } = await mount(
			Accordion(
				{ type: "multiple", onValueChange },
				AccordionItem({ value: "one" }, AccordionTrigger({}, "One"), AccordionContent({}, "1")),
				AccordionItem({ value: "two" }, AccordionTrigger({}, "Two"), AccordionContent({}, "2")),
			),
		);

		element(target, "[data-accordion-trigger]", 0).click();
		element(target, "[data-accordion-trigger]", 1).click();
		expect(onValueChange).toHaveBeenLastCalledWith(["one", "two"]);

		unmount();
	});

	it("reports a tab selection", async () => {
		const onValueChange = vi.fn();
		const { target, unmount } = await mount(
			Tabs(
				{ value: "one", onValueChange },
				TabsList({}, TabsTrigger({ value: "one" }, "One"), TabsTrigger({ value: "two" }, "Two")),
				TabsContent({ value: "one" }, "1"),
				TabsContent({ value: "two" }, "2"),
			),
		);

		element(target, "[data-tabs-trigger]", 1).click();
		expect(onValueChange).toHaveBeenCalledWith("two");

		unmount();
	});

	it("reports a radio group's selection", async () => {
		const onValueChange = vi.fn();
		const { target, unmount } = await mount(
			RadioGroup(
				{ onValueChange },
				RadioGroupItem({ value: "one" }),
				RadioGroupItem({ value: "two" }),
			),
		);

		element(target, "[data-radio-group-item]", 1).click();
		expect(onValueChange).toHaveBeenCalledWith("two");

		unmount();
	});

	it("reports a toggle group's pressed items", async () => {
		const onValueChange = vi.fn();
		const { target, unmount } = await mount(
			ToggleGroup(
				{ type: "multiple", onValueChange },
				ToggleGroupItem({ value: "bold" }, "B"),
				ToggleGroupItem({ value: "italic" }, "I"),
			),
		);

		element(target, "[data-toggle-group-item]", 0).click();
		expect(onValueChange).toHaveBeenLastCalledWith(["bold"]);

		unmount();
	});

	it("reports a select's value and open state", async () => {
		const onValueChange = vi.fn();
		const onOpenChange = vi.fn();
		const { target, unmount } = await mount(
			Select(
				{ onValueChange, onOpenChange },
				SelectTrigger({}, "Pick"),
				SelectContent(
					{},
					SelectItem({ value: "apple" }, "Apple"),
					SelectItem({ value: "banana" }, "Banana"),
				),
			),
		);

		element(target, "[data-select-trigger]").click();
		expect(onOpenChange).toHaveBeenCalledWith(true);

		element(target, "[data-select-item]", 1).click();
		expect(onValueChange).toHaveBeenCalledWith("banana");
		expect(onOpenChange).toHaveBeenLastCalledWith(false);

		unmount();
	});

	it("reports a rating", async () => {
		const onValueChange = vi.fn();
		const { target, unmount } = await mount(
			RatingGroup(
				{ onValueChange },
				...Array.from({ length: 5 }, (_, index) => RatingGroupItem({ index })),
			),
		);

		element(target, "[data-rating-group-item]", 2).click();
		expect(onValueChange).toHaveBeenCalledWith(3);

		unmount();
	});

	it("reports a command's search and highlight", async () => {
		const onSearchChange = vi.fn();
		const onValueChange = vi.fn();
		const { target, unmount } = await mount(
			Command(
				{ onSearchChange, onValueChange },
				CommandInput({}),
				CommandList({}, CommandViewport({}, CommandItem({ value: "calendar" }, "Calendar"))),
			),
		);

		const input = element(target, "[data-command-input]");
		if (!(input instanceof HTMLInputElement)) throw new Error("no input");
		input.value = "cal";
		input.dispatchEvent(new Event("input", { bubbles: true }));
		expect(onSearchChange).toHaveBeenCalledWith("cal");
		expect(onValueChange).toHaveBeenCalledWith("calendar");

		unmount();
	});

	it("reports a menu's open state and a checkbox item's checked state", async () => {
		const onOpenChange = vi.fn();
		const onCheckedChange = vi.fn();
		const onValueChange = vi.fn();
		const { target, unmount } = await mount(
			DropdownMenu(
				{ onOpenChange },
				DropdownMenuTrigger({}, "Open"),
				DropdownMenuContent(
					DropdownMenuCheckboxGroup(
						{ onValueChange },
						DropdownMenuCheckboxItem({ value: "panel", onCheckedChange }, "Panel"),
					),
				),
			),
		);

		element(target, "[data-dropdown-menu-trigger]").click();
		expect(onOpenChange).toHaveBeenCalledWith(true);

		element(target, "[data-dropdown-menu-checkbox-item]").click();
		expect(onCheckedChange).toHaveBeenCalledWith(true);
		expect(onValueChange).toHaveBeenCalledWith(["panel"]);

		unmount();
	});

	it("reports an outside write to a bound signal", async () => {
		const open = signal(false);
		const onOpenChange = vi.fn();
		const { unmount } = await mount(
			Collapsible(
				{ open, onOpenChange },
				CollapsibleTrigger({}, "Toggle"),
				CollapsibleContent({}, "The content"),
			),
		);

		open.set(true);
		expect(onOpenChange).toHaveBeenCalledWith(true);

		unmount();
	});

	it("stops reporting once the primitive unmounts", async () => {
		const open = signal(false);
		const onOpenChange = vi.fn();
		const { unmount } = await mount(
			Collapsible(
				{ open, onOpenChange },
				CollapsibleTrigger({}, "Toggle"),
				CollapsibleContent({}, "The content"),
			),
		);

		unmount();
		open.set(true);
		expect(onOpenChange).not.toHaveBeenCalled();
	});
});
