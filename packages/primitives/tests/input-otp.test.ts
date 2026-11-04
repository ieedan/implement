// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { App, signal, type Child } from "@implementjs/core";
import {
	InputOTP,
	InputOTPGroup,
	InputOTPSlot,
	InputOTPSeparator,
	REGEXP_ONLY_DIGITS,
} from "../src/index";

function tick() {
	return new Promise<void>((resolve) => {
		queueMicrotask(() => queueMicrotask(resolve));
	});
}

async function mount(tree: Child) {
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

function type(input: HTMLInputElement, value: string) {
	input.value = value;
	input.dispatchEvent(new Event("input", { bubbles: true }));
}

const slots = (target: ParentNode) =>
	Array.from(target.querySelectorAll("[data-input-otp-slot]")).filter(
		(el): el is HTMLElement => el instanceof HTMLElement,
	);

function field(target: ParentNode): HTMLInputElement {
	const el = target.querySelector("input");
	if (!(el instanceof HTMLInputElement)) throw new Error("No input");
	return el;
}

const tree = (props = {}) =>
	InputOTP(
		{ maxLength: 4, ...props },
		InputOTPGroup(...[0, 1].map((index) => InputOTPSlot({ index }))),
		InputOTPSeparator(),
		InputOTPGroup(...[2, 3].map((index) => InputOTPSlot({ index }))),
	);

describe("input-otp", () => {
	it("shows each typed character in its slot", async () => {
		const { target, unmount } = await mount(tree());
		const input = field(target);
		expect(input.getAttribute("autocomplete")).toBe("one-time-code");

		type(input, "12");
		const els = slots(target);
		expect(els[0]?.textContent).toBe("1");
		expect(els[1]?.textContent).toBe("2");
		expect(els[0]?.hasAttribute("data-filled")).toBe(true);
		expect(els[2]?.hasAttribute("data-filled")).toBe(false);
		unmount();
	});

	it("marks the next slot active while focused", async () => {
		const { target, unmount } = await mount(tree());
		const input = field(target);
		type(input, "1");
		expect(slots(target).some((el) => el.hasAttribute("data-active"))).toBe(false);

		input.dispatchEvent(new Event("focus"));
		expect(slots(target)[1]?.hasAttribute("data-active")).toBe(true);
		expect(
			slots(target)[1]?.querySelector("[data-input-otp-caret]")?.getAttribute("data-state"),
		).toBe("visible");

		input.dispatchEvent(new Event("blur"));
		expect(slots(target)[1]?.hasAttribute("data-active")).toBe(false);
		unmount();
	});

	it("refuses a change that breaks the pattern", async () => {
		const value = signal("");
		const { target, unmount } = await mount(tree({ value, pattern: REGEXP_ONLY_DIGITS }));
		const input = field(target);

		type(input, "12");
		type(input, "12a");
		expect(value.get()).toBe("12");
		expect(input.value).toBe("12");
		unmount();
	});

	it("reports changes and completion", async () => {
		const onValueChange = vi.fn();
		const onComplete = vi.fn();
		const { target, unmount } = await mount(tree({ onValueChange, onComplete }));
		const input = field(target);

		type(input, "123");
		expect(onComplete).not.toHaveBeenCalled();
		type(input, "1234");
		expect(onValueChange).toHaveBeenLastCalledWith("1234");
		expect(onComplete).toHaveBeenCalledWith("1234");
		unmount();
	});

	it("follows an outside write to the value", async () => {
		const value = signal("");
		const { target, unmount } = await mount(tree({ value }));
		value.set("99");
		expect(slots(target)[0]?.textContent).toBe("9");
		expect(field(target).value).toBe("99");
		unmount();
	});
});
