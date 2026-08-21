import {
	derived,
	Implement,
	signal,
	watch,
	type HeadChild,
	type Mountable,
	type Readable,
	type Signal,
} from "@implementjs/core";
import { noop } from "../../utils";

/** What the user asked for. `"system"` follows the operating system. */
export type Mode = "dark" | "light" | "system";

/** What the page actually renders as, once `"system"` has been resolved. */
export type ResolvedMode = "dark" | "light";

/** `content` for the `<meta name="theme-color">` tag in each mode. */
export type ThemeColors = { dark: string; light: string };

export function isMode(value: unknown): value is Mode {
	return value === "dark" || value === "light" || value === "system";
}

export type ModeManagerOptions = {
	/** Mode to use until the visitor picks one. Defaults to `"system"`. */
	defaultMode?: Mode;
	/** `data-theme` value to use until one is set. Defaults to `""` (no attribute). */
	defaultTheme?: string;
	/** Classes put on `<html>` in dark mode. Defaults to `["dark"]`. */
	darkClassNames?: string[];
	/** Classes put on `<html>` in light mode. Defaults to `[]`. */
	lightClassNames?: string[];
	/** Keeps `<meta name="theme-color">` in step with the mode. */
	themeColors?: ThemeColors;
	/** localStorage key holding the mode. Defaults to `"implement-mode"`. */
	modeStorageKey?: string;
	/** localStorage key holding the theme. Defaults to `"implement-theme"`. */
	themeStorageKey?: string;
	/** Suppresses CSS transitions while the mode swaps. Defaults to `true`. */
	disableTransitions?: boolean;
	/** Whether to follow the OS preference as it changes. Defaults to `true`. */
	track?: boolean;
};

/** {@link ModeManagerOptions} with every default filled in. */
export type ResolvedModeManagerOptions = Required<Omit<ModeManagerOptions, "themeColors">> & {
	themeColors?: ThemeColors;
};

const MANAGER_DEFAULTS: ResolvedModeManagerOptions = {
	defaultMode: "system",
	defaultTheme: "",
	darkClassNames: ["dark"],
	lightClassNames: [],
	modeStorageKey: "implement-mode",
	themeStorageKey: "implement-theme",
	disableTransitions: true,
	track: true,
};

function isBrowser(): boolean {
	return typeof document !== "undefined";
}

/** Merges the options that were actually passed, leaving the rest alone. */
function assignOptions(target: ResolvedModeManagerOptions, options: ModeManagerOptions) {
	for (const [key, value] of Object.entries(options)) {
		if (value !== undefined) (target as Record<string, unknown>)[key] = value;
	}
}

function classList(names: string[]): string[] {
	return names.filter((name) => name.length > 0);
}

let transitionStyle: HTMLStyleElement | null = null;
/** Bumped per call so a stale restore never re-enables transitions early. */
let restoreToken = 0;

/**
 * Runs `update` with every transition on the page turned off, so recoloring
 * the whole document doesn't animate. The suppressing `<style>` lands before
 * the change is recalculated and lifts on the next frame, once the new colors
 * have painted.
 *
 * Original technique: https://reemus.dev/article/disable-css-transition-color-scheme-change
 */
function withoutTransitions(update: () => void) {
	if (!isBrowser()) return update();

	if (!transitionStyle) {
		transitionStyle = document.createElement("style");
		transitionStyle.append(
			document.createTextNode("*,*::before,*::after{transition:none !important}"),
		);
	}
	const style = transitionStyle;

	document.head.appendChild(style);
	update();

	const token = ++restoreToken;
	const restore = () => {
		if (token !== restoreToken) return;
		style.remove();
	};
	// a frame is enough for the new colors to paint; the timeout is the fallback
	// for environments without rAF, so the style never sticks around
	if (typeof requestAnimationFrame === "function") requestAnimationFrame(restore);
	setTimeout(restore, 100);
}

/**
 * Owns the mode: what the visitor picked, what the OS reports, and which of
 * the two the page is rendering. Create one with `createModeManager()` —
 * usually at module scope so anything can import it and flip the mode — and
 * hand it to `ModeWatcher`.
 *
 * Nothing touches the DOM until a mounted `ModeWatcher` starts the manager.
 */
export class ModeManager {
	options: ResolvedModeManagerOptions;

	private modePreference: Signal<Mode>;
	private systemPreference: Signal<ResolvedMode | undefined>;
	private themeValue: Signal<string>;
	private resolved: Readable<ResolvedMode | undefined>;

	constructor(options: ModeManagerOptions = {}) {
		this.options = { ...MANAGER_DEFAULTS };
		assignOptions(this.options, options);

		this.modePreference = signal(this.storedMode());
		this.systemPreference = signal(querySystemMode());
		this.themeValue = signal(this.storedTheme());
		this.resolved = derived([this.modePreference, this.systemPreference], (preference, system) =>
			preference === "system" ? system : preference,
		);
	}

	/**
	 * The mode the page is in: the visitor's choice, or the OS preference when
	 * that choice is `"system"`. `undefined` during a server render, where
	 * there is no OS to ask.
	 */
	get mode(): Readable<ResolvedMode | undefined> {
		return this.resolved;
	}

	/** What the visitor picked — `"dark"`, `"light"`, or `"system"`. */
	get userPrefersMode(): Readable<Mode> {
		return this.modePreference;
	}

	/** What the OS reports, tracked while a `ModeWatcher` is mounted. */
	get systemPrefersMode(): Readable<ResolvedMode | undefined> {
		return this.systemPreference;
	}

	/** The current `data-theme` value, `""` when there is none. */
	get theme(): Readable<string> {
		return this.themeValue;
	}

	/** Picks a mode and remembers it. `"system"` hands control back to the OS. */
	setMode(mode: Mode) {
		this.modePreference.set(mode);
		this.write(this.options.modeStorageKey, mode);
	}

	/** Flips between light and dark, starting from whatever is rendering now. */
	toggleMode() {
		this.setMode(this.resolved.get() === "dark" ? "light" : "dark");
	}

	/** Drops the visitor's choice and follows the OS again. */
	resetMode() {
		this.setMode("system");
	}

	/** Sets `data-theme` on `<html>`. `""` removes the attribute. */
	setTheme(theme: string) {
		this.themeValue.set(theme);
		this.write(this.options.themeStorageKey, theme);
	}

	/** Applies the options that were passed, keeping the rest. */
	configure(options: ModeManagerOptions) {
		const previousModeKey = this.options.modeStorageKey;
		const previousThemeKey = this.options.themeStorageKey;
		assignOptions(this.options, options);
		this.moveStorage(previousModeKey, this.options.modeStorageKey, this.modePreference.get());
		this.moveStorage(previousThemeKey, this.options.themeStorageKey, this.themeValue.get());
	}

	/**
	 * Starts applying the mode to `<html>` and following the OS preference and
	 * other tabs. Returns the function that stops it again — `ModeWatcher`
	 * calls this on mount and the returned function on unmount.
	 */
	start(): () => void {
		if (!isBrowser()) return noop;

		const cleanups: (() => void)[] = [];

		// a manager built during a server render (or before another tab wrote)
		// holds stale values; storage is the source of truth on the client
		this.syncFromStorage();

		const query =
			typeof matchMedia === "function" ? matchMedia("(prefers-color-scheme: dark)") : null;
		if (query) {
			const syncSystem = () => this.systemPreference.set(query.matches ? "dark" : "light");
			syncSystem();
			if (this.options.track) {
				query.addEventListener("change", syncSystem);
				cleanups.push(() => query.removeEventListener("change", syncSystem));
			}
		}

		const onStorage = (event: StorageEvent) => {
			// `key` is null when another tab cleared storage outright
			if (event.key === null) this.syncFromStorage();
			else if (event.key === this.options.modeStorageKey) {
				this.modePreference.set(this.storedMode());
			} else if (event.key === this.options.themeStorageKey) {
				this.themeValue.set(this.storedTheme());
			}
		};
		addEventListener("storage", onStorage);
		cleanups.push(() => removeEventListener("storage", onStorage));

		cleanups.push(
			watch([this.resolved, this.themeValue], (mode, theme) => {
				this.apply(mode, theme);
			}),
		);

		return () => {
			for (const cleanup of cleanups) cleanup();
		};
	}

	/** Writes the mode onto `<html>`: classes, `color-scheme`, `data-theme`. */
	private apply(mode: ResolvedMode | undefined, theme: string) {
		const root = document.documentElement;
		const light = mode === "light";
		const added = classList(light ? this.options.lightClassNames : this.options.darkClassNames);
		const removed = classList(light ? this.options.darkClassNames : this.options.lightClassNames);

		const update = () => {
			if (removed.length > 0) root.classList.remove(...removed);
			if (added.length > 0) root.classList.add(...added);
			root.style.colorScheme = light ? "light" : "dark";
			if (theme === "") root.removeAttribute("data-theme");
			else root.setAttribute("data-theme", theme);

			const colors = this.options.themeColors;
			const meta = colors ? document.querySelector('meta[name="theme-color"]') : null;
			if (colors && meta) meta.setAttribute("content", light ? colors.light : colors.dark);
		};

		if (this.options.disableTransitions) withoutTransitions(update);
		else update();
	}

	private syncFromStorage() {
		this.modePreference.set(this.storedMode());
		this.themeValue.set(this.storedTheme());
	}

	private storedMode(): Mode {
		const stored = this.read(this.options.modeStorageKey);
		return isMode(stored) ? stored : this.options.defaultMode;
	}

	private storedTheme(): string {
		return this.read(this.options.themeStorageKey) ?? this.options.defaultTheme;
	}

	private moveStorage(from: string, to: string, value: string) {
		if (from === to || !isBrowser()) return;
		this.write(to, value);
		try {
			localStorage.removeItem(from);
		} catch {
			// same as `write`: storage can be unavailable
		}
	}

	private read(key: string): string | null {
		if (!isBrowser()) return null;
		try {
			return localStorage.getItem(key);
		} catch {
			// Safari in private mode, storage disabled by policy, …
			return null;
		}
	}

	private write(key: string, value: string) {
		if (!isBrowser()) return;
		try {
			localStorage.setItem(key, value);
		} catch {
			// the mode still applies for this page, it just won't be remembered
		}
	}
}

export function createModeManager(options: ModeManagerOptions = {}): ModeManager {
	return new ModeManager(options);
}

function querySystemMode(): ResolvedMode | undefined {
	if (!isBrowser() || typeof matchMedia !== "function") return undefined;
	return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** The subset of the options the blocking script needs to reach the same result. */
export type InitialModeConfig = Pick<
	ModeManagerOptions,
	| "defaultMode"
	| "defaultTheme"
	| "darkClassNames"
	| "lightClassNames"
	| "themeColors"
	| "modeStorageKey"
	| "themeStorageKey"
>;

/**
 * Applies the stored mode to `<html>` before the page paints.
 *
 * This is the function `createInitialModeExpression` stringifies into the
 * blocking script, so it has to stay self-contained: no imports, no
 * references to anything outside its own body, and no defaults that live
 * somewhere else.
 */
function applyInitialMode({
	defaultMode = "system",
	defaultTheme = "",
	darkClassNames = ["dark"],
	lightClassNames = [],
	themeColors,
	modeStorageKey = "implement-mode",
	themeStorageKey = "implement-theme",
}: InitialModeConfig = {}) {
	const root = document.documentElement;
	let storedMode = null;
	let storedTheme = null;
	try {
		storedMode = localStorage.getItem(modeStorageKey);
		storedTheme = localStorage.getItem(themeStorageKey);
	} catch {
		// storage can be unavailable; fall back to the defaults
	}

	const mode =
		storedMode === "dark" || storedMode === "light" || storedMode === "system"
			? storedMode
			: defaultMode;
	const theme = storedTheme ?? defaultTheme;
	const light =
		mode === "light" || (mode === "system" && matchMedia("(prefers-color-scheme: light)").matches);

	const added = (light ? lightClassNames : darkClassNames).filter(Boolean);
	const removed = (light ? darkClassNames : lightClassNames).filter(Boolean);
	if (removed.length > 0) root.classList.remove(...removed);
	if (added.length > 0) root.classList.add(...added);
	root.style.colorScheme = light ? "light" : "dark";
	if (theme) root.setAttribute("data-theme", theme);

	if (themeColors) {
		const meta = document.querySelector('meta[name="theme-color"]');
		if (meta) meta.setAttribute("content", light ? themeColors.light : themeColors.dark);
	}
}

/**
 * The source of the blocking script that applies the stored mode before the
 * first paint. `ModeWatcher` puts this in the head for you; call it yourself
 * when the script has to live somewhere else — inline in an `index.html`, or
 * injected by a server hook alongside `injectScript: false`.
 *
 * ```ts
 * const script = createInitialModeExpression({ defaultMode: "dark" });
 * ```
 */
export function createInitialModeExpression(config: InitialModeConfig = {}): string {
	// `<` can only come from the caller's own class names or theme colors, but
	// an escaped one still can't close the surrounding <script>
	const args = JSON.stringify(config).replaceAll("<", "\\u003C");
	return `(${applyInitialMode.toString()})(${args});`;
}

export type ModeWatcherProps = ModeManagerOptions & {
	/** Share a manager created with `createModeManager()`; omitted, one is made. */
	manager?: ModeManager;
	/** Whether to add the blocking script that beats the first paint. Defaults to `true`. */
	injectScript?: boolean;
	/** `nonce` for the blocking script, for pages under a Content Security Policy. */
	nonce?: string;
};

/**
 * Mount this once, at the root of the app. It renders nothing of its own: it
 * puts a blocking script in the head so the stored mode is on `<html>` before
 * the page paints, then keeps `<html>` in step with the manager for as long as
 * it stays mounted.
 *
 * ```ts
 * import { createModeManager, ModeWatcher } from "@implementjs/primitives";
 *
 * export const mode = createModeManager();
 *
 * App({ target }).render(
 * 	ModeWatcher({ manager: mode }),
 * 	Button({ onClick: () => mode.toggleMode() }, "Toggle theme"),
 * );
 * ```
 */
export function ModeWatcher({
	manager,
	injectScript = true,
	nonce,
	...options
}: ModeWatcherProps = {}): Mountable {
	const state = manager ?? new ModeManager(options);
	if (manager) state.configure(options);

	const settings = state.options;
	const config: InitialModeConfig = {
		defaultMode: settings.defaultMode,
		defaultTheme: settings.defaultTheme,
		darkClassNames: settings.darkClassNames,
		lightClassNames: settings.lightClassNames,
		themeColors: settings.themeColors,
		modeStorageKey: settings.modeStorageKey,
		themeStorageKey: settings.themeStorageKey,
	};

	const head: HeadChild[] = [];
	// dark until the script below (or the manager, once mounted) says otherwise,
	// so there is always a tag for them to update
	if (settings.themeColors) {
		head.push(Implement.Head.Meta({ name: "theme-color", content: settings.themeColors.dark }));
	}
	if (injectScript) {
		head.push(
			Implement.Head.Script(
				nonce === undefined ? {} : { nonce },
				createInitialModeExpression(config),
			),
		);
	}

	return Implement.Lifecycle({ onMount: () => state.start() }, Implement.Head(...head));
}
