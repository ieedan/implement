import { describe, expect, it, vi } from "vitest";
import * as router from "@implementjs/router";
import { hotReplaceRoute, lazyModule, preloadRoute, registerRouteModules } from "../src/lazy.ts";

describe("lazyModule", () => {
	it("names the route file when a component renders before its chunk loaded", () => {
		const handle = lazyModule("src/routes/docs/page.ts", () => Promise.resolve({ default: 1 }));
		expect(() => handle.get()).toThrow(/src\/routes\/docs\/page\.ts/);
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
		const list = track("routes/users/page.ts");
		const detail = track("routes/users/[id]/page.ts");
		const create = track("routes/users/new/page.ts");
		registerRouteModules([
			{ pattern: "/users", modules: ["routes/layout.ts", "routes/users/page.ts"] },
			{ pattern: "/users/:id", modules: ["routes/layout.ts", "routes/users/[id]/page.ts"] },
			{ pattern: "/users/new", modules: ["routes/layout.ts", "routes/users/new/page.ts"] },
		]);

		await preloadRoute("/users/new");
		expect(loaded).toEqual(["routes/layout.ts", "routes/users/new/page.ts"]);
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

describe("lazyModule declared twice", () => {
	it("keeps the first handle, so what closed over it sees the hot replacement", () => {
		const first = lazyModule("stable.ts", () => Promise.resolve({ default: "one" }));
		const second = lazyModule("stable.ts", () => Promise.resolve({ default: "two" }));
		// the generated router module re-evaluates whenever anything it imports
		// does; a second handle would strand the route table built on the first
		expect(second).toBe(first);
	});

	it("takes the newest importer for a route not loaded yet", async () => {
		const stale = vi.fn(() => Promise.resolve({ default: "stale" }));
		const fresh = vi.fn(() => Promise.resolve({ default: "fresh" }));
		const handle = lazyModule("rebound.ts", stale);
		lazyModule("rebound.ts", fresh);

		await handle.load();
		expect(handle.get()).toBe("fresh");
		expect(stale).not.toHaveBeenCalled();
	});

	it("keeps what is already loaded rather than re-importing it", async () => {
		const handle = lazyModule("settled.ts", () => Promise.resolve({ default: "loaded" }));
		await handle.load();
		const later = vi.fn(() => Promise.resolve({ default: "later" }));
		lazyModule("settled.ts", later);

		await handle.load();
		expect(handle.get()).toBe("loaded");
		expect(later).not.toHaveBeenCalled();
	});
});

describe("hotReplaceRoute", () => {
	it("swaps the component and re-renders the route showing it, at its own depth", async () => {
		const handle = lazyModule("routes/docs/page.ts", () => Promise.resolve({ default: "old" }));
		lazyModule("routes/layout.ts", () => Promise.resolve({ default: "layout" }));
		await handle.load();
		registerRouteModules([
			{ pattern: "/docs", modules: ["routes/layout.ts", "routes/docs/page.ts"] },
		]);

		const depths: number[] = [];
		const spy = vi.spyOn(router, "refreshRouters").mockImplementation((depthFor) => {
			depths.push(depthFor("/docs"));
			return true;
		});

		expect(hotReplaceRoute("routes/docs/page.ts", "new")).toBe(true);
		expect(handle.get()).toBe("new");
		// the page is last in the chain the manifest records, which is the
		// position the router rebuilds from
		expect(depths).toEqual([1]);

		expect(hotReplaceRoute("routes/layout.ts", "layout2")).toBe(true);
		expect(depths).toEqual([1, 0]);

		spy.mockRestore();
	});

	it("renders nothing for a module the route on screen does not use", () => {
		lazyModule("routes/other/page.ts", () => Promise.resolve({ default: "other" }));
		registerRouteModules([{ pattern: "/docs", modules: ["routes/docs/page.ts"] }]);

		const depths: number[] = [];
		const spy = vi.spyOn(router, "refreshRouters").mockImplementation((depthFor) => {
			depths.push(depthFor("/docs"));
			return false;
		});

		// still true: the handle took the new component, so navigating there
		// later renders it — there is just nothing on screen to rebuild now
		expect(hotReplaceRoute("routes/other/page.ts", "fresh")).toBe(true);
		expect(depths).toEqual([-1]);

		spy.mockRestore();
	});

	it("reports a module no handle was declared for, so the caller can reload", () => {
		expect(hotReplaceRoute("routes/never-declared/page.ts", "x")).toBe(false);
	});
});
