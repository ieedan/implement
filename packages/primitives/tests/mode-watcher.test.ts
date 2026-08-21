// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "@implementjs/core";
import { renderToString } from "@implementjs/core/server";
import { createInitialModeExpression, createModeManager, ModeWatcher } from "../src/index";

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
		unmount: () => {
			unmount();
			target.remove();
		},
	};
}

type FakeMediaQuery = {
	/** The color scheme this query asks about. */
	wants: "dark" | "light";
	matches: boolean;
	listeners: Set<() => void>;
	addEventListener(type: string, listener: () => void): void;
	removeEventListener(type: string, listener: () => void): void;
};

/**
 * Stands in for `matchMedia` so the OS preference is controllable: `system`
 * flips `matches` and notifies whatever registered for changes.
 */
function stubMatchMedia(prefers: "dark" | "light") {
	const queries: FakeMediaQuery[] = [];
	const matchMedia = vi.fn((query: string) => {
		const wants = query.includes("dark") ? "dark" : "light";
		const media: FakeMediaQuery = {
			wants,
			matches: wants === prefers,
			listeners: new Set(),
			addEventListener(_type, listener) {
				media.listeners.add(listener);
			},
			removeEventListener(_type, listener) {
				media.listeners.delete(listener);
			},
		};
		queries.push(media);
		return media;
	});
	vi.stubGlobal("matchMedia", matchMedia);

	return {
		set(next: "dark" | "light") {
			prefers = next;
			for (const media of queries) {
				media.matches = media.wants === next;
				for (const listener of media.listeners) listener();
			}
		},
	};
}

const root = () => document.documentElement;

beforeEach(() => {
	localStorage.clear();
	root().className = "";
	root().removeAttribute("style");
	root().removeAttribute("data-theme");
	document.head.replaceChildren();
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("ModeManager", () => {
	it("follows the system preference by default", () => {
		stubMatchMedia("dark");
		const manager = createModeManager();
		expect(manager.userPrefersMode.get()).toBe("system");
		expect(manager.mode.get()).toBe("dark");
	});

	it("uses defaultMode when nothing is stored", () => {
		stubMatchMedia("dark");
		const manager = createModeManager({ defaultMode: "light" });
		expect(manager.mode.get()).toBe("light");
	});

	it("prefers the stored mode over defaultMode", () => {
		stubMatchMedia("light");
		localStorage.setItem("implement-mode", "dark");
		const manager = createModeManager({ defaultMode: "light" });
		expect(manager.userPrefersMode.get()).toBe("dark");
		expect(manager.mode.get()).toBe("dark");
	});

	it("ignores a stored value that is not a mode", () => {
		stubMatchMedia("light");
		localStorage.setItem("implement-mode", "neon");
		expect(createModeManager().userPrefersMode.get()).toBe("system");
	});

	it("remembers setMode and reads it back through a new manager", () => {
		stubMatchMedia("light");
		createModeManager().setMode("dark");
		expect(localStorage.getItem("implement-mode")).toBe("dark");
		expect(createModeManager().mode.get()).toBe("dark");
	});

	it("toggles from the resolved mode, not the preference", () => {
		stubMatchMedia("dark");
		const manager = createModeManager();
		// preference is "system", resolving to dark
		manager.toggleMode();
		expect(manager.userPrefersMode.get()).toBe("light");
		manager.toggleMode();
		expect(manager.userPrefersMode.get()).toBe("dark");
	});

	it("resets back to the system preference", () => {
		stubMatchMedia("light");
		const manager = createModeManager();
		manager.setMode("dark");
		manager.resetMode();
		expect(manager.userPrefersMode.get()).toBe("system");
		expect(manager.mode.get()).toBe("light");
	});

	it("stores the theme under its own key", () => {
		stubMatchMedia("dark");
		const manager = createModeManager();
		manager.setTheme("mint");
		expect(manager.theme.get()).toBe("mint");
		expect(localStorage.getItem("implement-theme")).toBe("mint");
	});

	it("honors custom storage keys", () => {
		stubMatchMedia("dark");
		localStorage.setItem("app:mode", "light");
		const manager = createModeManager({ modeStorageKey: "app:mode" });
		expect(manager.mode.get()).toBe("light");
		manager.setMode("dark");
		expect(localStorage.getItem("app:mode")).toBe("dark");
	});

	it("moves the stored value when configure changes the key", () => {
		stubMatchMedia("dark");
		const manager = createModeManager();
		manager.setMode("light");
		manager.configure({ modeStorageKey: "app:mode" });
		expect(localStorage.getItem("app:mode")).toBe("light");
		expect(localStorage.getItem("implement-mode")).toBeNull();
	});

	it("leaves options configure was not given alone", () => {
		stubMatchMedia("dark");
		const manager = createModeManager({ defaultMode: "light" });
		manager.configure({ track: false });
		expect(manager.options.defaultMode).toBe("light");
		expect(manager.options.track).toBe(false);
	});

	it("does not touch the document until it is started", () => {
		stubMatchMedia("dark");
		createModeManager().setMode("dark");
		expect(root().classList.contains("dark")).toBe(false);
	});
});

describe("ModeWatcher", () => {
	it("applies the mode to the root element on mount", async () => {
		stubMatchMedia("dark");
		const manager = createModeManager();
		const { unmount } = await mount(ModeWatcher({ manager }));

		expect(root().classList.contains("dark")).toBe(true);
		expect(root().style.colorScheme).toBe("dark");
		unmount();
	});

	it("swaps the classes when the mode changes", async () => {
		stubMatchMedia("dark");
		const manager = createModeManager();
		const { unmount } = await mount(ModeWatcher({ manager }));

		manager.setMode("light");
		expect(root().classList.contains("dark")).toBe(false);
		expect(root().style.colorScheme).toBe("light");

		manager.setMode("dark");
		expect(root().classList.contains("dark")).toBe(true);
		unmount();
	});

	it("uses the configured class names", async () => {
		stubMatchMedia("light");
		const manager = createModeManager({
			darkClassNames: ["theme-dark", "dark"],
			lightClassNames: ["theme-light"],
		});
		const { unmount } = await mount(ModeWatcher({ manager }));

		expect(root().className).toBe("theme-light");
		manager.setMode("dark");
		expect(root().classList.contains("theme-dark")).toBe(true);
		expect(root().classList.contains("dark")).toBe(true);
		expect(root().classList.contains("theme-light")).toBe(false);
		unmount();
	});

	it("writes and clears data-theme", async () => {
		stubMatchMedia("dark");
		const manager = createModeManager();
		const { unmount } = await mount(ModeWatcher({ manager }));

		expect(root().hasAttribute("data-theme")).toBe(false);
		manager.setTheme("mint");
		expect(root().getAttribute("data-theme")).toBe("mint");
		manager.setTheme("");
		expect(root().hasAttribute("data-theme")).toBe(false);
		unmount();
	});

	it("follows the system preference while tracking", async () => {
		const media = stubMatchMedia("dark");
		const manager = createModeManager();
		const { unmount } = await mount(ModeWatcher({ manager }));
		expect(manager.mode.get()).toBe("dark");

		media.set("light");
		expect(manager.mode.get()).toBe("light");
		expect(root().classList.contains("dark")).toBe(false);
		unmount();
	});

	it("stops following the system preference with track: false", async () => {
		const media = stubMatchMedia("dark");
		const manager = createModeManager({ track: false });
		const { unmount } = await mount(ModeWatcher({ manager }));

		media.set("light");
		expect(manager.mode.get()).toBe("dark");
		unmount();
	});

	it("stops applying the mode once unmounted", async () => {
		stubMatchMedia("dark");
		const manager = createModeManager();
		const { unmount } = await mount(ModeWatcher({ manager }));
		unmount();

		manager.setMode("light");
		expect(root().classList.contains("dark")).toBe(true);
	});

	it("picks up a mode written by another tab", async () => {
		stubMatchMedia("dark");
		const manager = createModeManager();
		const { unmount } = await mount(ModeWatcher({ manager }));

		localStorage.setItem("implement-mode", "light");
		dispatchEvent(new StorageEvent("storage", { key: "implement-mode", newValue: "light" }));
		expect(manager.userPrefersMode.get()).toBe("light");
		expect(root().classList.contains("dark")).toBe(false);
		unmount();
	});

	it("injects the blocking script into the head", async () => {
		stubMatchMedia("dark");
		const { unmount } = await mount(ModeWatcher({ manager: createModeManager(), nonce: "abc" }));

		const script = document.head.querySelector("script");
		expect(script?.getAttribute("nonce")).toBe("abc");
		expect(script?.textContent).toContain("prefers-color-scheme: light");
		unmount();
		expect(document.head.querySelector("script")).toBeNull();
	});

	it("leaves the head alone with injectScript: false", async () => {
		stubMatchMedia("dark");
		const { unmount } = await mount(
			ModeWatcher({ manager: createModeManager(), injectScript: false }),
		);
		expect(document.head.querySelector("script")).toBeNull();
		unmount();
	});

	it("keeps the theme-color meta in step with the mode", async () => {
		stubMatchMedia("dark");
		const manager = createModeManager({ themeColors: { dark: "#000", light: "#fff" } });
		const { unmount } = await mount(ModeWatcher({ manager }));

		const meta = document.head.querySelector('meta[name="theme-color"]');
		expect(meta?.getAttribute("content")).toBe("#000");
		manager.setMode("light");
		expect(meta?.getAttribute("content")).toBe("#fff");
		unmount();
	});

	it("configures a manager it is given", async () => {
		stubMatchMedia("light");
		const manager = createModeManager();
		const { unmount } = await mount(ModeWatcher({ manager, darkClassNames: ["night"] }));

		manager.setMode("dark");
		expect(root().classList.contains("night")).toBe(true);
		unmount();
	});

	it("makes its own manager when it is not given one", async () => {
		stubMatchMedia("dark");
		const { unmount } = await mount(ModeWatcher({ defaultMode: "light" }));
		expect(root().style.colorScheme).toBe("light");
		unmount();
	});
});

/** Runs the generated source the way the injected `<script>` would. */
function run(expression: string) {
	// oxlint-disable-next-line no-implied-eval -- running generated source is the point
	new Function(expression)();
}

describe("createInitialModeExpression", () => {
	it("applies the stored mode before anything mounts", () => {
		stubMatchMedia("light");
		localStorage.setItem("implement-mode", "dark");
		run(createInitialModeExpression());

		expect(root().classList.contains("dark")).toBe(true);
		expect(root().style.colorScheme).toBe("dark");
	});

	it("falls back to the system preference", () => {
		stubMatchMedia("light");
		run(createInitialModeExpression());
		expect(root().classList.contains("dark")).toBe(false);
		expect(root().style.colorScheme).toBe("light");
	});

	it("reads the configured keys, classes, and defaults", () => {
		stubMatchMedia("dark");
		localStorage.setItem("app:theme", "mint");
		run(
			createInitialModeExpression({
				defaultMode: "light",
				darkClassNames: ["night"],
				lightClassNames: ["day"],
				modeStorageKey: "app:mode",
				themeStorageKey: "app:theme",
			}),
		);

		expect(root().className).toBe("day");
		expect(root().getAttribute("data-theme")).toBe("mint");
	});

	it("reaches the same result the manager does", async () => {
		stubMatchMedia("dark");
		localStorage.setItem("implement-mode", "light");
		run(createInitialModeExpression());
		const beforeMount = root().className;

		const { unmount } = await mount(ModeWatcher({ manager: createModeManager() }));
		expect(root().className).toBe(beforeMount);
		unmount();
	});
});

describe("server rendering", () => {
	it("puts the blocking script and the theme-color meta in the head", () => {
		stubMatchMedia("dark");
		const manager = createModeManager({ themeColors: { dark: "#000", light: "#fff" } });
		const { head, html } = renderToString(ModeWatcher({ manager }));

		// the component renders nothing of its own into the page
		expect(html).toBe("");
		expect(head).toContain('<meta name="theme-color" content="#000"');
		expect(head).toContain("prefers-color-scheme: light");
		expect(head).toContain('"modeStorageKey":"implement-mode"');
	});

	it("leaves the document alone", () => {
		stubMatchMedia("dark");
		renderToString(ModeWatcher({ manager: createModeManager() }));
		expect(root().classList.contains("dark")).toBe(false);
	});
});
