// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { App, signal, type Child } from "@implementjs/core";
import {
	PhoneInput,
	type CountryCode,
	PhoneInputContext,
	PhoneInputField,
	PhoneInputState,
	getPhoneCountries,
} from "../src/index";

function tick() {
	return new Promise<void>((resolve) => {
		queueMicrotask(() => queueMicrotask(resolve));
	});
}

async function mount(tree: Child) {
	const target = document.createElement("div");
	document.body.appendChild(target);
	const unmount = App({ target }).render(tree);
	await tick();
	return {
		target,
		unmount: () => {
			unmount();
			target.remove();
		},
	};
}

function type(input: HTMLInputElement, text: string) {
	input.value = text;
	input.setSelectionRange(text.length, text.length);
	input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("PhoneInput", () => {
	it("lists countries by name", () => {
		const countries = getPhoneCountries();
		expect(countries.find((c) => c.code === "US")).toMatchObject({
			name: "United States",
			dialCode: "1",
		});
		expect(countries[0]!.name.localeCompare(countries[1]!.name)).toBeLessThan(0);
	});

	it("formats national digits and reports E.164", async () => {
		const value = signal("");
		const valid = signal(true);
		const { target, unmount } = await mount(
			PhoneInput({ country: "US", value, valid }, PhoneInputField()),
		);
		const input = target.querySelector("input")!;
		type(input, "2133734253");
		expect(input.value).toBe("(213) 373-4253");
		expect(value.get()).toBe("+12133734253");
		expect(valid.get()).toBe(true);
		type(input, "213373");
		expect(valid.get()).toBe(false);
		unmount();
	});

	it("detects the country from a typed plus", async () => {
		const country = signal<CountryCode | null>(null);
		const value = signal("");
		const { target, unmount } = await mount(PhoneInput({ country, value }, PhoneInputField()));
		type(target.querySelector("input")!, "+44 7400 123456");
		expect(country.get()).toBe("GB");
		expect(value.get()).toBe("+447400123456");
		unmount();
	});

	it("shows an outside value in national form", async () => {
		const value = signal("+12133734253");
		const country = signal<CountryCode | null>("US");
		const { target, unmount } = await mount(PhoneInput({ country, value }, PhoneInputField()));
		const input = target.querySelector("input")!;
		expect(input.value).toBe("(213) 373-4253");
		value.set("+12025550123");
		await tick();
		expect(input.value).toBe("(202) 555-0123");
		unmount();
	});

	it("keeps the digits when the country changes", async () => {
		const value = signal("+12133734253");
		let state: PhoneInputState | undefined;
		const { target, unmount } = await mount(
			PhoneInput(
				{ country: "US", value },
				PhoneInputContext.Use((s) => {
					state = s;
					return PhoneInputField();
				}),
			),
		);
		state!.setCountry("CA");
		await tick();
		expect(value.get()).toBe("+12133734253");
		state!.setCountry(null);
		expect(target.querySelector("input")!.value).toBe("");
		unmount();
	});

	it("submits the E.164 number under name", async () => {
		const { target, unmount } = await mount(
			PhoneInput({ country: "US", name: "phone" }, PhoneInputField()),
		);
		type(target.querySelector<HTMLInputElement>("input[type=tel]")!, "2133734253");
		await tick();
		expect(target.querySelector<HTMLInputElement>("input[name=phone]")!.value).toBe("+12133734253");
		unmount();
	});
});
