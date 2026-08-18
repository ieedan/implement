/** Whole-line oxlint / oxfmt / prettier / eslint suppression comments. */
const WHOLE_LINE =
	/^\s*(?:\/\/|\/\*)\s*(?:(?:oxlint|eslint)-(?:disable(?:-next-line|-line)?|enable)\b|oxfmt-ignore|prettier-ignore)\b/;

/** Trailing suppressions on the same line as code. */
const TRAILING =
	/\s*(?:\/\/|\/\*)\s*(?:(?:oxlint|eslint)-(?:disable(?:-next-line|-line)?|enable)\b|oxfmt-ignore|prettier-ignore)\b.*$/;

/**
 * Lesson `code.ts` / `solution.ts` files may carry ignore comments so one-line
 * imports survive formatters and unused starter imports pass the linter. Those
 * comments are noise in the playground, so strip them before display.
 */
export function stripLessonSource(source: string): string {
	return source
		.replaceAll("\r\n", "\n")
		.split("\n")
		.filter((line) => !WHOLE_LINE.test(line))
		.map((line) => line.replace(TRAILING, ""))
		.join("\n");
}
