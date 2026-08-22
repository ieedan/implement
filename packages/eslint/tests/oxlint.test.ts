import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, expect, it } from "vitest";

/**
 * The rules are written against ESLint's API, and everything else in this
 * folder tests them through ESLint's own `RuleTester`. oxlint runs the same
 * files through a separate implementation of that API, which is in alpha and
 * explicitly not covered by semver — so the plugin is also run end to end by
 * the real binary, on real TypeScript, to catch the day the two disagree.
 */

const PLUGIN = fileURLToPath(new URL("../src/index.ts", import.meta.url));
const OXLINT = fileURLToPath(new URL("../node_modules/oxlint/bin/oxlint", import.meta.url));

const FIXTURE = `import { Button, Div, Html, ImplementLifecycle, signal, watch, type Readable, type Signal } from "@implementjs/core";
import { mode } from "./mode";

export function Toggle(open: Readable<boolean>, rows: Signal<string[]>): unknown {
	const local = signal(0);

	// Fine: the signal is created here, so both die together.
	local.onChange((value: number) => value);

	// A leak: \`mode\` is imported, so the subscription outlives this call.
	mode.current.subscribe((value: unknown) => value);

	// A Lifecycle that only owns a watch.
	ImplementLifecycle({ onMount: () => watch([mode.current], (v: unknown) => v) });

	// Signal in a condition, known only from the parameter's annotation.
	const label = open ? "Close" : "Open";

	// Signal of a collection, known from the type argument.
	const picked = signal<Set<string>>(new Set());

	// Signal of a collection, known from the annotation on the declaration.
	const drafts: Signal<Map<string, string>> = signal(new Map());

	// Fine: the readonly type says this collection is replaced, not mutated.
	const touched = signal<ReadonlySet<string>>(new Set());

	// Raw markup, and the same call once a disable comment has justified it.
	const raw = Div(Html(body));
	// oxlint-disable-next-line implementjs/no-html
	const allowed = Div(Html(body));

	// A role missing what it requires, and one carrying what it cannot use.
	const box = Div({ role: "checkbox" });
	const btn = Div({ role: "button", "aria-checked": open });
	// A role the element already has.
	const dup = Button({ role: "button" }, "Save");

	// A list rendered from a snapshot rather than through ForEach.
	const list = Ul(...rows.get().map((row: string) => Li(row)));

	// Fine: an event handler wants the value it has right now.
	const onSave = () => save(rows.get().map(toDto));

	return {
		"aria-lable": "Close",
		"aria-hidden": "yes",
		"aria-current": "page",
		role: "buton",
		class: "aria-invalid:border",
		children: [label, picked, drafts, touched, raw, allowed, box, btn, dup, list, onSave],
	};
}
`;

type Diagnostic = { code: string; severity: string; labels: { span: { line: number } }[] };

function isDiagnostic(value: unknown): value is Diagnostic {
	if (value == null || typeof value !== "object") return false;
	if (!("code" in value) || !("severity" in value) || !("labels" in value)) return false;
	return (
		typeof value.code === "string" &&
		typeof value.severity === "string" &&
		Array.isArray(value.labels)
	);
}

let diagnostics: Diagnostic[] = [];
let directory = "";

beforeAll(() => {
	directory = mkdtempSync(join(tmpdir(), "implementjs-eslint-"));
	writeFileSync(join(directory, "fixture.ts"), FIXTURE);
	writeFileSync(
		join(directory, ".oxlintrc.json"),
		JSON.stringify({
			jsPlugins: [PLUGIN],
			rules: {
				"implementjs/no-hanging-unsubscribe": "error",
				"implementjs/prefer-effect": "warn",
				"implementjs/valid-aria": "error",
				"implementjs/valid-role": "error",
				"implementjs/no-signal-collection": "warn",
				"implementjs/no-signal-condition": "error",
				"implementjs/prefer-foreach": "error",
				"implementjs/no-html": "error",
				"implementjs/no-redundant-roles": "warn",
				"implementjs/role-has-required-aria-props": "error",
				"implementjs/role-supports-aria-props": "error",
			},
		}),
	);

	// oxlint exits non-zero whenever it reports anything, which is the point.
	let stdout = "";
	try {
		stdout = execFileSync(OXLINT, ["--disable-nested-config", "-f", "json", "fixture.ts"], {
			cwd: directory,
			encoding: "utf8",
		});
	} catch (error) {
		const failure: unknown = error;
		if (failure == null || typeof failure !== "object" || !("stdout" in failure)) throw error;
		stdout = String(failure.stdout);
	}

	const parsed: unknown = JSON.parse(stdout);
	if (parsed == null || typeof parsed !== "object" || !("diagnostics" in parsed)) {
		throw new Error(`oxlint produced no diagnostics object:\n${stdout}`);
	}
	const { diagnostics: reported } = parsed;
	if (!Array.isArray(reported) || !reported.every(isDiagnostic)) {
		throw new Error(`oxlint reported diagnostics in an unexpected shape:\n${stdout}`);
	}
	diagnostics = reported;
});

afterAll(() => {
	if (directory !== "") rmSync(directory, { recursive: true, force: true });
});

/**
 * The rules reported on the fixture line containing `marker`. Keying on the
 * source rather than a line number keeps the expectations readable and stops
 * an edit to the fixture from quietly moving what each one asserts.
 */
function on(marker: string): string[] {
	const lines = FIXTURE.split("\n");
	const index = lines.findIndex((line) => line.includes(marker));
	if (index === -1) throw new Error(`No fixture line contains ${JSON.stringify(marker)}`);
	return diagnostics
		.filter((diagnostic) => diagnostic.labels.some((label) => label.span.line === index + 1))
		.map((diagnostic) => diagnostic.code)
		.toSorted();
}

it("loads the plugin from TypeScript source and namespaces every rule", () => {
	expect(diagnostics.length).toBeGreaterThan(0);
	for (const diagnostic of diagnostics) {
		expect(diagnostic.code).toMatch(/^implementjs\(/u);
	}
});

it("resolves scope well enough to leave a component-local signal alone", () => {
	expect(on("local.onChange")).toEqual([]);
});

it("reports a subscription to an imported signal", () => {
	expect(on("mode.current.subscribe")).toEqual(["implementjs(no-hanging-unsubscribe)"]);
});

it("reports a Lifecycle that only owns a watch", () => {
	expect(on("ImplementLifecycle({")).toEqual(["implementjs(prefer-effect)"]);
});

it("reports a misspelled aria attribute, a bad value, and a bad role", () => {
	expect(on('"aria-lable"')).toEqual(["implementjs(valid-aria)"]);
	expect(on('"aria-hidden"')).toEqual(["implementjs(valid-aria)"]);
	expect(on('role: "buton"')).toEqual(["implementjs(valid-role)"]);
});

it("leaves valid props and Tailwind aria variants alone", () => {
	expect(on('"aria-current"')).toEqual([]);
	expect(on("aria-invalid:border")).toEqual([]);
});

it("carries severity across from the config", () => {
	const bySeverity = new Map(diagnostics.map((d) => [d.code, d.severity]));
	expect(bySeverity.get("implementjs(prefer-effect)")).toBe("warning");
	expect(bySeverity.get("implementjs(valid-aria)")).toBe("error");
});

it("reads a parameter's type annotation to find a signal in a condition", () => {
	expect(on("const label =")).toEqual(["implementjs(no-signal-condition)"]);
});

it("finds a signal of a collection through a type argument", () => {
	expect(on("const picked =")).toEqual(["implementjs(no-signal-collection)"]);
});

it("finds a signal of a collection through the declaration's annotation", () => {
	expect(on("const drafts:")).toEqual(["implementjs(no-signal-collection)"]);
});

it("reports a list rendered from a snapshot, and spares the event handler", () => {
	expect(on("const list =")).toEqual(["implementjs(prefer-foreach)"]);
	expect(on("const onSave =")).toEqual([]);
});

it("respects the readonly opt-out on a signal of a collection", () => {
	expect(on("const touched =")).toEqual([]);
});

it("reports raw Html, and honours a disable comment that justifies it", () => {
	expect(on("const raw =")).toEqual(["implementjs(no-html)"]);
	expect(on("const allowed =")).toEqual([]);
});

it("checks a role against what it requires and what it supports", () => {
	expect(on("const box =")).toEqual(["implementjs(role-has-required-aria-props)"]);
	expect(on("const btn =")).toEqual(["implementjs(role-supports-aria-props)"]);
});

it("reports a role an element already has, resolved through core's helpers", () => {
	expect(on("const dup =")).toEqual(["implementjs(no-redundant-roles)"]);
});
