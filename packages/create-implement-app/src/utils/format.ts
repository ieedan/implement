/**
 * Writing what the formatter would have written.
 *
 * A scaffolded app comes with `oxfmt` and a config for it, so anything the templates write that
 * the formatter disagrees with is rewritten by the app's first `pnpm format` — a dirty tree of
 * editor config and components the developer never opened. These helpers put the generators on
 * the same rules the app is handed, so that first format is a no-op.
 */

/**
 * The width oxfmt measures a line against, and how wide it counts a tab — the two numbers the
 * generated `oxfmt.config.ts` pins (`printWidth: 100`, and prettier's default tab width, which
 * `useTabs` does not change).
 */
const PRINT_WIDTH = 100;
const TAB_WIDTH = 2;

/**
 * How wide a key has to be before the formatter will move its value below it: the tab width, plus
 * the three columns prettier insists the move has to gain to be worth making. Under that — `code`,
 * `link` — the value stays on the key's line however far past the width it runs.
 */
const MIN_KEY_WIDTH = TAB_WIDTH + 3;

/**
 * A JSON file, as oxfmt would leave it.
 *
 * `JSON.stringify(value, null, "\t")` writes every array an entry per line; oxfmt — prettier's
 * rules, on oxc — puts one back on a single line the moment it fits. A generated file that
 * disagrees with the formatter the same scaffold installs is rewritten by the app's first
 * `pnpm format`, which is editor-config churn nobody asked for, so the templates write what oxfmt
 * would have written instead: an object a key per line, an array collapsed wherever it fits.
 */
export function json(value: unknown): string {
	return `${print(value, 0, "", "")}\n`;
}

/**
 * One value, as the lines it occupies. `prefix` is what shares its first line — the `"key": ` of
 * the property it belongs to — and `suffix` the `,` that follows it, because both count against
 * the width the formatter is deciding on.
 */
function print(value: unknown, depth: number, prefix: string, suffix: string): string {
	const indent = "\t".repeat(depth);

	if (Array.isArray(value) && value.length > 0) {
		const inline = `${prefix}${flat(value)}${suffix}`;
		if (fits(inline, depth)) return inline;

		const entries = value.map(
			(entry, i) => `${indent}\t${print(entry, depth + 1, "", i < value.length - 1 ? "," : "")}`,
		);
		return `${prefix}[\n${entries.join("\n")}\n${indent}]${suffix}`;
	}

	const entries = properties(value);
	if (entries !== undefined && entries.length > 0) {
		// an object stays a key per line whatever its width: prettier keeps the break the source
		// already had, so this is both what the templates read like and a fixed point
		const lines = entries.map(
			([key, entry], i) =>
				`${indent}\t${print(entry, depth + 1, `${JSON.stringify(key)}: `, i < entries.length - 1 ? "," : "")}`,
		);
		return `${prefix}{\n${lines.join("\n")}\n${indent}}${suffix}`;
	}

	return `${prefix}${JSON.stringify(value)}${suffix}`;
}

/** The one line form: what the value looks like with every break taken out of it. */
function flat(value: unknown): string {
	if (Array.isArray(value)) return `[${value.map((entry) => flat(entry)).join(", ")}]`;

	const entries = properties(value);
	if (entries === undefined) return JSON.stringify(value);
	if (entries.length === 0) return "{}";

	return `{ ${entries.map(([key, entry]) => `${JSON.stringify(key)}: ${flat(entry)}`).join(", ")} }`;
}

function fits(line: string, depth: number): boolean {
	return depth * TAB_WIDTH + line.length <= PRINT_WIDTH;
}

/** The properties `JSON.stringify` would write, or `undefined` for anything that is not an object. */
function properties(value: unknown): [string, unknown][] | undefined {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
	return Object.entries(value).filter(([, entry]) => entry !== undefined);
}

/**
 * A `key: value` property of a generated object literal, on the lines oxfmt would give it. A
 * tailwind class list is long enough to push its line past the width on its own, and what the
 * formatter does with one is drop the value onto a line of its own — so the templates write it
 * that way rather than leave the app's first `pnpm format` something to rewrite.
 */
export function property(prop: string, depth: number, suffix = ","): string {
	const line = `${"\t".repeat(depth)}${prop}${suffix}`;
	if (fits(`${prop}${suffix}`, depth)) return line;

	// only a string, which is the one thing prettier will not break apart, and only under a key
	// wide enough to be worth breaking after
	const [, key, value] = /^([^:]+):\s("[^"]*")$/.exec(prop) ?? [];
	if (key === undefined || value === undefined || key.length < MIN_KEY_WIDTH) return line;

	const indent = "\t".repeat(depth);
	return `${indent}${key}:\n${indent}\t${value}${suffix}`;
}

/** An object literal, kept on one line while it fits and opened up a property per line when not. */
export function object(props: string[], depth: number, suffix = ","): string[] {
	const indent = "\t".repeat(depth);
	if (props.length === 0) return [`${indent}{}${suffix}`];

	const inline = `{ ${props.join(", ")} }${suffix}`;
	if (fits(inline, depth)) return [`${indent}${inline}`];

	return [`${indent}{`, ...props.map((prop) => property(prop, depth + 1)), `${indent}}${suffix}`];
}

/**
 * A component call — a props object and then children, which is the shape of every element the
 * templates write. One line while the whole call fits, and otherwise an argument per line, which
 * is what oxfmt does with arguments it cannot keep together.
 */
export function call(
	callee: string,
	props: string[],
	children: string[],
	depth: number,
	suffix = ",",
): string[] {
	const indent = "\t".repeat(depth);
	const args = [...(props.length > 0 ? [`{ ${props.join(", ")} }`] : []), ...children];

	const inline = `${callee}(${args.join(", ")})${suffix}`;
	if (fits(inline, depth)) return [`${indent}${inline}`];

	return [
		`${indent}${callee}(`,
		...(props.length > 0 ? object(props, depth + 1) : []),
		...children.map((child) => `${indent}\t${child},`),
		`${indent})${suffix}`,
	];
}
