// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { App, context, Div, Span, type Child } from "../src/index";
import { toError } from "../src/utils";

const Theme = context<string>("ThemeContext");
const Unnamed = context<string>();

function mount(child: Child) {
	const target = document.createElement("div");
	target.id = "app";
	document.body.appendChild(target);
	const app = App({ target });
	return {
		target,
		render: () => app.render(child),
		cleanup: () => target.remove(),
	};
}

/** The error a mount threw, so its message and stack can both be inspected. */
function mountError(child: Child): Error {
	const { render, cleanup } = mount(child);
	try {
		render();
	} catch (error) {
		return toError(error);
	} finally {
		cleanup();
	}
	throw new Error("expected the mount to throw");
}

describe("context", () => {
	it("hands the provided value to a descendant", () => {
		const { target, render, cleanup } = mount(
			Theme.Provide("dark").To(
				Div(
					{ id: "root" },
					Theme.Use((theme) => Span(theme)),
				),
			),
		);
		render();
		expect(target.querySelector("#root")!.textContent).toBe("dark");
		cleanup();
	});

	it("uses the fallback when UseOr finds no provider", () => {
		const { target, render, cleanup } = mount(
			Div(
				{ id: "root" },
				Theme.UseOr((theme) => Span(theme), "light"),
			),
		);
		render();
		expect(target.querySelector("#root")!.textContent).toBe("light");
		cleanup();
	});

	it("names the context, its creation site, and where it was mounting", () => {
		const error = mountError(
			Div(
				{ id: "root" },
				Theme.Use((theme) => Span(theme)),
			),
		);

		expect(error.message).toContain("ThemeContext.Use() found no matching Provide() above it");
		expect(error.message).toMatch(
			/context: {2}ThemeContext, created at .*context\.test\.ts:\d+:\d+/,
		);
		expect(error.message).toContain("inside:   div#root");
		expect(error.message).toContain("ThemeContext.Provide(value).To(...)");
	});

	it("leads the stack with the Use() call site, not core's mount frames", () => {
		const UseTheme = () => Theme.Use((theme) => Span(theme));
		const error = mountError(Div(UseTheme()));

		const frames = error.stack!.split("\n").filter((line) => line.trimStart().startsWith("at "));
		expect(frames[0]).toContain("at UseTheme");
		expect(frames[0]).toMatch(/context\.test\.ts:\d+:\d+/);
		// the mount frames are still there, below the frames worth reading
		expect(error.stack).toContain("--- mounted from ---");
	});

	it("identifies an unnamed context by where it was created", () => {
		const error = mountError(Div(Unnamed.Use((value) => Span(value))));

		expect(error.message).toContain("context.Use() found no matching Provide()");
		expect(error.message).toMatch(/context: {2}unnamed, created at .*context\.test\.ts:\d+:\d+/);
	});
});
