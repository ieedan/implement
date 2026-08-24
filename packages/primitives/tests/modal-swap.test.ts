// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { App, Div, If, P, signal } from "@implementjs/core";
import { Dialog, DialogTrigger, Drawer, DrawerTrigger } from "../src/index";

function tags(t: Element) {
	return [...(t.firstElementChild?.children ?? [])].map((c) => c.tagName);
}
function tick() {
	return new Promise<void>((r) => queueMicrotask(() => queueMicrotask(r)));
}

describe("swapping a modal root inside If", () => {
	it("dialog", async () => {
		const flag = signal(false);
		const target = document.createElement("div");
		document.body.appendChild(target);
		App({ target }).render(
			Div(
				If(flag)
					.Then(Dialog({}, DialogTrigger({}, "a")))
					.Else(Dialog({}, DialogTrigger({}, "b"))),
				P("after"),
			),
		);
		await tick();
		expect(tags(target)).toEqual(["BUTTON", "P"]);
		flag.set(true);
		await tick();
		expect(tags(target)).toEqual(["BUTTON", "P"]);
	});
	it("drawer", async () => {
		const flag = signal(false);
		const target = document.createElement("div");
		document.body.appendChild(target);
		App({ target }).render(
			Div(
				If(flag)
					.Then(Drawer({}, DrawerTrigger({}, "a")))
					.Else(Drawer({}, DrawerTrigger({}, "b"))),
				P("after"),
			),
		);
		await tick();
		expect(tags(target)).toEqual(["BUTTON", "P"]);
		flag.set(true);
		await tick();
		expect(tags(target)).toEqual(["BUTTON", "P"]);
	});
});
