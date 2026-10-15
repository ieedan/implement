import {
	derived,
	Fragment,
	isReadable,
	signal,
	Span,
	type Child,
	type Readable,
} from "@implementjs/core";
import {
	createHighlighterCore,
	type GrammarState,
	type HighlighterCore,
	type ThemedToken,
} from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";

// Add the languages you need. Each one loads the first time it is used.
const languages = {
	bash: () => import("shiki/langs/shellscript.mjs"),
	css: () => import("shiki/langs/css.mjs"),
	diff: () => import("shiki/langs/diff.mjs"),
	html: () => import("shiki/langs/html.mjs"),
	javascript: () => import("shiki/langs/javascript.mjs"),
	json: () => import("shiki/langs/json.mjs"),
	jsx: () => import("shiki/langs/jsx.mjs"),
	markdown: () => import("shiki/langs/markdown.mjs"),
	python: () => import("shiki/langs/python.mjs"),
	sql: () => import("shiki/langs/sql.mjs"),
	tsx: () => import("shiki/langs/tsx.mjs"),
	typescript: () => import("shiki/langs/typescript.mjs"),
	yaml: () => import("shiki/langs/yaml.mjs"),
};

type Language = keyof typeof languages | "ansi";

const aliases: Record<string, keyof typeof languages> = {
	js: "javascript",
	md: "markdown",
	py: "python",
	sh: "bash",
	shell: "bash",
	shellscript: "bash",
	ts: "typescript",
	yml: "yaml",
	zsh: "bash",
};

let shiki: Promise<HighlighterCore> | undefined;

function getShiki(): Promise<HighlighterCore> {
	shiki ??= createHighlighterCore({
		themes: [import("shiki/themes/github-light.mjs"), import("shiki/themes/github-dark.mjs")],
		langs: [],
		engine: createJavaScriptRegexEngine({ forgiving: true }),
	});
	return shiki;
}

function isListed(name: string): name is keyof typeof languages {
	return Object.hasOwn(languages, name);
}

function resolveLanguage(language: string): Language | null {
	const name = language.toLowerCase();
	if (name === "ansi" || isListed(name)) return name;
	return aliases[name] ?? null;
}

/** One rendered line per line of code, and the grammar state after the last one. */
export type HighlightResult = { lines: Child[]; state: GrammarState | undefined };

export type Highlighter = {
	/**
	 * Highlights `code`, one child per line. Pass the `state` a previous call
	 * returned to carry on from where that code left off.
	 */
	highlight(code: string, state?: GrammarState): HighlightResult;
};

/** The inline style shiki gives a token: its color in each theme, as custom properties. */
function tokenStyle(token: ThemedToken): string {
	return Object.entries(token.htmlStyle ?? {})
		.map(([property, value]) => `${property}:${value}`)
		.join(";");
}

/** A line of tokens as spans. An empty line holds a newline, so copying a selection keeps it. */
function renderLine(tokens: ThemedToken[]): Child {
	if (tokens.length === 0) return "\n";
	return Fragment(
		...tokens.map((token) =>
			Span(
				{
					style: tokenStyle(token),
					class: "text-(--shiki-light) dark:text-(--shiki-dark)",
				},
				token.content,
			),
		),
	);
}

/**
 * Loads a language and returns a highlighter for it, or `null` for one that is
 * not listed above.
 */
export async function loadHighlighter(language: string): Promise<Highlighter | null> {
	const lang = resolveLanguage(language);
	if (!lang) return null;

	const core = await getShiki();
	if (lang !== "ansi" && !core.getLoadedLanguages().includes(lang)) {
		await core.loadLanguage(languages[lang]);
	}

	return {
		highlight(code, state) {
			const tokenize = (text: string) =>
				core.codeToTokens(text, {
					lang,
					themes: { light: "github-light", dark: "github-dark" },
					defaultColor: false,
					grammarState: state,
				}).tokens;

			// ANSI has no grammar state, so each line is tokenized on its own and
			// gets the same colors whether it arrives in one piece or streams.
			const tokens =
				lang === "ansi" ? code.split("\n").flatMap((line) => tokenize(line)) : tokenize(code);

			return { lines: tokens.map(renderLine), state: core.getLastGrammarState(tokens) };
		},
	};
}

/** Highlights code once, one child per line — `null` for a language that is not listed. */
export async function highlightCode(code: string, language: string): Promise<Child[] | null> {
	const highlighter = await loadHighlighter(language);
	return highlighter ? highlighter.highlight(code).lines : null;
}

/**
 * Highlighters by the name they were asked for, once loaded: `null` for a
 * language that is not listed, so it is not asked for again.
 */
const loaded = new Map<string, Highlighter | null>();
const loading = new Set<string>();
/** Bumped as each language finishes loading, so whatever was waiting on it re-reads. */
const loads = signal(0);

/** The highlighter for a language when it is ready, starting the load the first time it is asked for. */
function highlighterFor(language: string): Highlighter | null {
	const ready = loaded.get(language);
	if (ready !== undefined) return ready;

	// the server renders the plain lines; the client highlights them once it
	// has the grammar, so the markup it hydrates is the markup that was sent
	if (typeof window === "undefined" || loading.has(language)) return null;

	loading.add(language);
	void loadHighlighter(language)
		.catch(() => null)
		.then((highlighter) => {
			loaded.set(language, highlighter);
			loading.delete(language);
			loads.set(loads.get() + 1);
		});
	return null;
}

function toReadable(value: string | Readable<string>): Readable<string> {
	return isReadable(value) ? value : signal(value);
}

/**
 * The lines of `code`, highlighted for `language`: one child each, to put in
 * a `CodeBlockLine`. Until the grammar has loaded — and on the server — they
 * are the plain lines.
 *
 * Pass a readable for code that streams in. Lines that are complete are
 * tokenized once, carrying the grammar state forward, so only the last line,
 * the one still being written, is tokenized again on each change.
 *
 * ```ts
 * const lines = highlightedCode(code, "ts");
 *
 * CodeBlockContent(
 * 	{ lineNumbers: true },
 * 	ForEach(lines, (_, index) => index, (line) => CodeBlockLine(Dynamic(line))),
 * );
 * ```
 */
export function highlightedCode(
	code: string | Readable<string>,
	language: string | Readable<string>,
): Readable<Child[]> {
	// the complete lines, highlighted, and where the grammar stood after them
	let done: {
		highlighter: Highlighter | null;
		text: string;
		lines: Child[];
		state: GrammarState | undefined;
	} = { highlighter: null, text: "", lines: [], state: undefined };

	return derived([toReadable(code), toReadable(language), loads], (value, lang) => {
		// a trailing newline would render as an extra empty line
		const text = value.endsWith("\n") ? value.slice(0, -1) : value;
		const highlighter = highlighterFor(lang);

		if (!highlighter) return text.split("\n").map((line) => line || "\n");

		// anything but more of the same code starts over
		if (done.highlighter !== highlighter || !text.startsWith(done.text)) {
			done = { highlighter, text: "", lines: [], state: undefined };
		}

		const end = text.lastIndexOf("\n") + 1;
		if (end > done.text.length) {
			const result = highlighter.highlight(text.slice(done.text.length, end - 1), done.state);
			done = {
				highlighter,
				text: text.slice(0, end),
				lines: [...done.lines, ...result.lines],
				state: result.state,
			};
		}

		// the last line is still being written, so it is tokenized on every change
		const tail = highlighter.highlight(text.slice(end), done.state).lines[0] ?? "\n";
		return [...done.lines, tail];
	});
}
