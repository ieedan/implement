/**
 * The vitest-like API lesson tests import as `@tutorial/test`.
 *
 * The check runner (`lesson-test.ts`) mounts the user's code off-screen, points
 * this module at it with `__setActiveLesson`, then runs the lesson's test. The
 * playground rewrites `from "@tutorial/test"` to a shim over this module, and
 * the tsconfig `paths` alias makes the same specifier type-check in the repo.
 */

type ActiveLesson = { root: HTMLElement; source: string };

let active: ActiveLesson | null = null;

/** @internal Set by the check runner around each test run. */
export function __setActiveLesson(lesson: ActiveLesson | null): void {
	active = lesson;
}

function root(): HTMLElement {
	if (active == null) {
		throw new Error("No lesson is mounted. Lesson tests only run through the Check button.");
	}
	return active.root;
}

/** The user's current code, for criteria the DOM can't show (e.g. "uses signal()"). */
export function source(): string {
	if (active == null) {
		throw new Error("No lesson is mounted. Lesson tests only run through the Check button.");
	}
	return active.source;
}

/** Wait for pending DOM updates. */
export function tick(): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, 0));
}

function normalize(text: string | null): string {
	return (text ?? "").replace(/\s+/g, " ").trim();
}

/** Strings match as case-insensitive substrings of whitespace-normalized text. */
function matchText(matcher: string | RegExp, text: string): boolean {
	if (typeof matcher === "string") {
		return text.toLowerCase().includes(normalize(matcher).toLowerCase());
	}
	return matcher.test(text);
}

function fmt(value: unknown): string {
	if (value instanceof Element) return `<${value.tagName.toLowerCase()}>`;
	if (value instanceof RegExp) return String(value);
	if (typeof value === "string") {
		const short = value.length > 40 ? `${value.slice(0, 40)}…` : value;
		return JSON.stringify(short);
	}
	try {
		return JSON.stringify(value) ?? String(value);
	} catch {
		return String(value);
	}
}

// --- queries -----------------------------------------------------------------

function elements(): HTMLElement[] {
	return [...root().querySelectorAll<HTMLElement>("*")];
}

function roleOf(el: HTMLElement): string | null {
	const explicit = el.getAttribute("role");
	if (explicit != null) return explicit;
	const tag = el.tagName.toLowerCase();
	if (/^h[1-6]$/.test(tag)) return "heading";
	switch (tag) {
		case "button":
			return "button";
		case "a":
			return el.hasAttribute("href") ? "link" : null;
		case "input": {
			const type = (el as HTMLInputElement).type;
			if (type === "checkbox") return "checkbox";
			if (type === "radio") return "radio";
			if (type === "range") return "slider";
			if (type === "number") return "spinbutton";
			if (type === "button" || type === "submit" || type === "reset") return "button";
			return "textbox";
		}
		case "textarea":
			return "textbox";
		case "select":
			return "combobox";
		case "ul":
		case "ol":
			return "list";
		case "li":
			return "listitem";
		case "p":
			return "paragraph";
		case "img":
			return "img";
		case "table":
			return "table";
		default:
			return null;
	}
}

function headingLevel(el: HTMLElement): number | null {
	const aria = el.getAttribute("aria-level");
	if (aria != null) return Number(aria);
	const match = /^h([1-6])$/.exec(el.tagName.toLowerCase());
	return match ? Number(match[1]) : null;
}

function accessibleName(el: HTMLElement): string {
	const label = el.getAttribute("aria-label");
	if (label != null) return normalize(label);
	if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
		return normalize(el.placeholder);
	}
	return normalize(el.textContent);
}

export type RoleOptions = { name?: string | RegExp; level?: number };

function queryByRole(role: string, options: RoleOptions = {}): HTMLElement | null {
	return (
		elements().find((el) => {
			if (roleOf(el) !== role) return false;
			if (options.level != null && headingLevel(el) !== options.level) return false;
			if (options.name != null && !matchText(options.name, accessibleName(el))) return false;
			return true;
		}) ?? null
	);
}

function queryByText(matcher: string | RegExp): HTMLElement | null {
	const matches = elements().filter((el) => matchText(matcher, normalize(el.textContent)));
	// Prefer the deepest match so the element itself is returned, not an ancestor.
	return matches.find((el) => !matches.some((other) => other !== el && el.contains(other))) ?? null;
}

export const screen = {
	/** The element the lesson is mounted into. */
	get container(): HTMLElement {
		return root();
	},
	/** First element matching a CSS selector, or fail with `description`. */
	get(selector: string, description?: string): HTMLElement {
		const el = root().querySelector<HTMLElement>(selector);
		if (el == null) {
			throw new Error(
				`Expected ${description ?? `a \`${selector}\` element`}, but couldn't find one.`,
			);
		}
		return el;
	},
	getAll(selector: string): HTMLElement[] {
		return [...root().querySelectorAll<HTMLElement>(selector)];
	},
	query(selector: string): HTMLElement | null {
		return root().querySelector<HTMLElement>(selector);
	},
	getByText(matcher: string | RegExp): HTMLElement {
		const el = queryByText(matcher);
		if (el == null) throw new Error(`Could not find an element with text ${fmt(matcher)}.`);
		return el;
	},
	queryByText,
	getByRole(role: string, options: RoleOptions = {}): HTMLElement {
		const el = queryByRole(role, options);
		if (el == null) {
			const level = options.level != null ? ` at level ${options.level}` : "";
			const name = options.name != null ? ` named ${fmt(options.name)}` : "";
			throw new Error(`Could not find a ${role}${level}${name}.`);
		}
		return el;
	},
	queryByRole,
	getByPlaceholder(matcher: string | RegExp): HTMLElement {
		const el = elements().find(
			(candidate) =>
				(candidate instanceof HTMLInputElement || candidate instanceof HTMLTextAreaElement) &&
				matchText(matcher, normalize(candidate.placeholder)),
		);
		if (el == null) throw new Error(`Could not find an input with placeholder ${fmt(matcher)}.`);
		return el;
	},
};

// --- events ------------------------------------------------------------------

function asInput(element: Element, action: string): HTMLInputElement | HTMLTextAreaElement {
	if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
		return element;
	}
	throw new Error(`userEvent.${action}() needs an input element, got ${fmt(element)}.`);
}

export const userEvent = {
	async click(element: Element): Promise<void> {
		if (element instanceof HTMLElement) element.click();
		else element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
		await tick();
	},
	/** Append `text` to the input one character at a time, like a user typing. */
	async type(element: Element, text: string): Promise<void> {
		const input = asInput(element, "type");
		for (const char of text) {
			input.value += char;
			input.dispatchEvent(new Event("input", { bubbles: true }));
		}
		await tick();
	},
	/** Replace the input's value with `value`. */
	async fill(element: Element, value: string): Promise<void> {
		const input = asInput(element, "fill");
		input.value = value;
		input.dispatchEvent(new Event("input", { bubbles: true }));
		input.dispatchEvent(new Event("change", { bubbles: true }));
		await tick();
	},
	async clear(element: Element): Promise<void> {
		await userEvent.fill(element, "");
	},
};

// --- expect ------------------------------------------------------------------

export type Matchers = {
	toBe(expected: unknown): void;
	toEqual(expected: unknown): void;
	toBeTruthy(): void;
	toBeFalsy(): void;
	toBeNull(): void;
	toBeDefined(): void;
	toBeGreaterThan(expected: number): void;
	toBeLessThan(expected: number): void;
	toMatch(expected: string | RegExp): void;
	toContain(expected: unknown): void;
	toHaveLength(expected: number): void;
	toBeInTheDocument(): void;
	toBeDisabled(): void;
	toHaveTextContent(expected: string | RegExp): void;
	toHaveClass(...classes: string[]): void;
	toHaveAttribute(name: string, value?: string): void;
	toHaveStyle(styles: Record<string, string>): void;
	toHaveValue(expected: string): void;
	readonly not: Matchers;
};

function deepEqual(a: unknown, b: unknown): boolean {
	if (Object.is(a, b)) return true;
	if (typeof a !== "object" || typeof b !== "object" || a == null || b == null) return false;
	if (Array.isArray(a) !== Array.isArray(b)) return false;
	const aKeys = Object.keys(a);
	const bKeys = Object.keys(b);
	if (aKeys.length !== bKeys.length) return false;
	return aKeys.every((key) =>
		deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
	);
}

/**
 * `expect(value).toBe(...)`, with an optional lesson-facing failure message:
 * `expect(heading, "The heading should show the count.").toHaveTextContent("Count: 1")`.
 */
export function expect(actual: unknown, message?: string): Matchers {
	return buildMatchers(actual, false, message);
}

function buildMatchers(actual: unknown, negated: boolean, message: string | undefined): Matchers {
	const subject = fmt(actual);

	const assert = (passed: boolean, description: string): void => {
		if (passed !== negated) return;
		throw new Error(message ?? `Expected ${subject} ${negated ? "not " : ""}${description}.`);
	};

	const asString = (matcher: string): string => {
		if (typeof actual !== "string") {
			throw new Error(`${matcher}() needs a string, got ${subject}.`);
		}
		return actual;
	};

	const asElement = (matcher: string): HTMLElement => {
		if (!(actual instanceof HTMLElement)) {
			throw new Error(`${matcher}() needs an element, got ${subject}.`);
		}
		return actual;
	};

	return {
		toBe: (expected) => assert(Object.is(actual, expected), `to be ${fmt(expected)}`),
		toEqual: (expected) => assert(deepEqual(actual, expected), `to equal ${fmt(expected)}`),
		toBeTruthy: () => assert(Boolean(actual), "to be truthy"),
		toBeFalsy: () => assert(!actual, "to be falsy"),
		toBeNull: () => assert(actual === null, "to be null"),
		toBeDefined: () => assert(actual !== undefined, "to be defined"),
		toBeGreaterThan: (expected) =>
			assert(typeof actual === "number" && actual > expected, `to be greater than ${expected}`),
		toBeLessThan: (expected) =>
			assert(typeof actual === "number" && actual < expected, `to be less than ${expected}`),
		toMatch: (expected) => {
			const value = asString("toMatch");
			assert(
				typeof expected === "string" ? value.includes(expected) : expected.test(value),
				`to match ${fmt(expected)}`,
			);
		},
		toContain: (expected) => {
			const passed =
				typeof actual === "string"
					? typeof expected === "string" && actual.includes(expected)
					: Array.isArray(actual) && actual.some((item) => deepEqual(item, expected));
			assert(passed, `to contain ${fmt(expected)}`);
		},
		toHaveLength: (expected) => {
			const length =
				actual != null && typeof actual === "object" && "length" in actual
					? (actual as { length: unknown }).length
					: typeof actual === "string"
						? actual.length
						: undefined;
			assert(length === expected, `to have length ${expected}, but it has ${String(length)}`);
		},
		toBeInTheDocument: () =>
			assert(actual instanceof Element && document.contains(actual), "to be in the document"),
		toBeDisabled: () => {
			const el = asElement("toBeDisabled");
			const disabled =
				("disabled" in el && el.disabled === true) || el.getAttribute("aria-disabled") === "true";
			assert(disabled, "to be disabled");
		},
		toHaveTextContent: (expected) => {
			const el = asElement("toHaveTextContent");
			assert(
				matchText(expected, normalize(el.textContent)),
				`to have text content ${fmt(expected)}, but its text is ${fmt(normalize(el.textContent))}`,
			);
		},
		toHaveClass: (...classes) => {
			const el = asElement("toHaveClass");
			assert(
				classes.every((name) => el.classList.contains(name)),
				`to have class ${classes.map((name) => fmt(name)).join(", ")}`,
			);
		},
		toHaveAttribute: (name, value) => {
			const el = asElement("toHaveAttribute");
			const passed = value === undefined ? el.hasAttribute(name) : el.getAttribute(name) === value;
			const detail = value === undefined ? "" : ` with value ${fmt(value)}`;
			assert(passed, `to have attribute ${fmt(name)}${detail}`);
		},
		toHaveStyle: (styles) => {
			const el = asElement("toHaveStyle");
			// Normalize expected values (e.g. "red" vs "rgb(255, 0, 0)") by computing
			// them on a probe element and comparing computed style to computed style.
			const probe = document.createElement("div");
			probe.style.cssText = "position:fixed;left:-10000px;top:0";
			document.body.appendChild(probe);
			try {
				const computed = getComputedStyle(el);
				const passed = Object.entries(styles).every(([property, value]) => {
					const name = property.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);
					probe.style.setProperty(name, value);
					return computed.getPropertyValue(name) === getComputedStyle(probe).getPropertyValue(name);
				});
				assert(passed, `to have style ${fmt(styles)}`);
			} finally {
				probe.remove();
			}
		},
		toHaveValue: (expected) => {
			const el = asElement("toHaveValue");
			const value =
				el instanceof HTMLInputElement ||
				el instanceof HTMLTextAreaElement ||
				el instanceof HTMLSelectElement
					? el.value
					: undefined;
			assert(value === expected, `to have value ${fmt(expected)}, but its value is ${fmt(value)}`);
		},
		get not(): Matchers {
			return buildMatchers(actual, !negated, message);
		},
	};
}
