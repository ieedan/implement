import { describe, expect, it, vi } from "vitest";
import { lazyModule, preloadRoute, registerRouteModules } from "../src/lazy.ts";

describe("lazyModule", () => {
	it("names the route file when a component renders before its chunk loaded", () => {
		const handle = lazyModule("src/routes/docs/index.ts", () => Promise.resolve({ default: 1 }));
		expect(() => handle.get()).toThrow(/src\/routes\/docs\/index\.ts/);
		expect(() => handle.get()).toThrow(/preloadRoute/);
	});

	it("hands back the default export once loaded", async () => {
		const handle = lazyModule("loaded.ts", () => Promise.resolve({ default: "page" }));
		await handle.load();
		expect(handle.get()).toBe("page");
	});

	it("imports once however many loads race", async () => {
		const importer = vi.fn(() => Promise.resolve({ default: "page" }));
		const handle = lazyModule("once.ts", importer);
		await Promise.all([handle.load(), handle.load()]);
		await handle.load();
		expect(importer).toHaveBeenCalledTimes(1);
	});

	it("lets a failed import be retried rather than poisoning the handle", async () => {
		let attempts = 0;
		const handle = lazyModule("flaky.ts", () => {
			attempts++;
			return attempts === 1
				? Promise.reject(new Error("chunk gone"))
				: Promise.resolve({
						default: "page",
					});
		});
		await expect(handle.load()).rejects.toThrow("chunk gone");
		await handle.load();
		expect(handle.get()).toBe("page");
	});
});

describe("preloadRoute", () => {
	it("loads the route's page and layout chain, most specific pattern first", async () => {
		const loaded: string[] = [];
		const track = (id: string) =>
			lazyModule(id, () => {
				loaded.push(id);
				return Promise.resolve({ default: id });
			});
		const layout = track("routes/layout.ts");
		const list = track("routes/users/index.ts");
		const detail = track("routes/users/[id]/index.ts");
		const create = track("routes/users/new/index.ts");
		registerRouteModules([
			{ pattern: "/users", modules: ["routes/layout.ts", "routes/users/index.ts"] },
			{ pattern: "/users/:id", modules: ["routes/layout.ts", "routes/users/[id]/index.ts"] },
			{ pattern: "/users/new", modules: ["routes/layout.ts", "routes/users/new/index.ts"] },
		]);

		await preloadRoute("/users/new");
		expect(loaded).toEqual(["routes/layout.ts", "routes/users/new/index.ts"]);
		expect(() => create.get()).not.toThrow();
		// the static segment outranks `:id`, so the param route stayed unloaded
		expect(() => detail.get()).toThrow();

		await preloadRoute("/users/7?tab=posts");
		expect(() => detail.get()).not.toThrow();
		expect(layout.get()).toBe("routes/layout.ts");
		expect(() => list.get()).toThrow();
	});

	it("leaves a path matching no route alone, for embedded routers to handle", async () => {
		registerRouteModules([{ pattern: "/docs", modules: ["missing/module.ts"] }]);
		await expect(preloadRoute("/tutorial-preview/step-2")).resolves.toBeUndefined();
	});
});
