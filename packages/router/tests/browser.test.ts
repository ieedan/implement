// @vitest-environment happy-dom
/* oxlint-disable typescript/no-unsafe-type-assertion -- Test mocks and DOM stubs require intentional narrowing. */
import { describe, expect, it, vi } from "vitest";
import { App, navigateTo, Span } from "@implementjs/core";
import { Router } from "../src/index";

describe("router onError", () => {
	it("routes render errors to onError instead of the console, then shows the fallback", () => {
		navigateTo("/boom");
		const target = document.createElement("div");
		document.body.appendChild(target);
		const app = App({ target });

		const thrown: unknown[] = [];
		const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		const router = Router(
			{
				"/boom": () => {
					throw new Error("kaboom");
				},
			},
			{
				fallback: (error) => Span(`${error.code}: ${error.message}`),
				onError: (error) => thrown.push(error),
			},
		);

		const unmount = app.render(router);
		expect(target.textContent).toBe("500: kaboom");
		expect(thrown).toHaveLength(1);
		expect((thrown[0] as Error).message).toBe("kaboom");
		expect(consoleSpy).not.toHaveBeenCalled();

		consoleSpy.mockRestore();
		unmount();
		target.remove();
	});
});
