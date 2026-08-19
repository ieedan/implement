// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { App, Button, Div, If, signal, Span } from "../src/index";

describe("browser mounting", () => {
	it("mounts, reacts to signals, and unmounts", () => {
		const target = document.createElement("div");
		document.body.appendChild(target);
		const app = App({ target });
		const count = signal(0);

		const unmount = app.render(
			Div(
				{ id: "root" },
				Span(count),
				If(
					count.bind((value) => value > 0),
					Span("pos"),
				),
			),
		);

		const root = target.querySelector("#root");
		expect(root).not.toBeNull();
		expect(root!.textContent).toBe("0");

		count.set(2);
		expect(root!.textContent).toBe("2pos");

		unmount();
		expect(target.innerHTML).toBe("");
		target.remove();
	});

	it("attaches event handlers", () => {
		const target = document.createElement("div");
		document.body.appendChild(target);
		const app = App({ target });
		const count = signal(0);

		const unmount = app.render(Button({ onClick: () => count.increment() }, "add"));
		target.querySelector("button")!.click();
		expect(count.get()).toBe(1);

		unmount();
		target.remove();
	});
});
