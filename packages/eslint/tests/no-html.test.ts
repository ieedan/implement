import rule from "../src/rules/no-html.ts";
import { ruleTester } from "./rule-tester.ts";

ruleTester.run("no-html", rule, {
	valid: [
		// Importing it is not using it; the use sites are what get reported.
		'import { Html } from "@implementjs/core";',
		// Someone else's `Html`.
		'import { Html } from "some-markdown-lib";\nDiv(Html(markup));',
		// A local of the same name.
		"function Html(markup) { return markup; }\nDiv(Html(markup));",
		// Names that merely look alike.
		'import { Html } from "@implementjs/core";\nrenderers.Html(markup);',
		'import { Html } from "@implementjs/core";\nconst map = { Html: renderRaw };',
		// The framework's own preferred alternative.
		'import { Svg } from "@implementjs/core";\nDiv(Svg(markup));',
	],

	invalid: [
		{
			code: 'import { Html } from "@implementjs/core";\nDiv(Html(markup));',
			errors: [{ messageId: "noHtml" }],
		},
		{
			// Every use site is reported, so every one needs its own justification.
			code: 'import { Html } from "@implementjs/core";\nDiv(Html(a), Html(b));',
			errors: [{ messageId: "noHtml" }, { messageId: "noHtml" }],
		},
		{
			// Aliasing on import does not get around it.
			code: 'import { Html as Raw } from "@implementjs/core";\nDiv(Raw(markup));',
			errors: [{ messageId: "noHtml" }],
		},
		{
			// Passed as a value rather than called.
			code: 'import { Html } from "@implementjs/core";\nconst render = Html;',
			errors: [{ messageId: "noHtml" }],
		},
		{
			// Shorthand puts the same identifier in both key and value position;
			// only the value is a use.
			code: 'import { Html } from "@implementjs/core";\nconst renderers = { Html };',
			errors: [{ messageId: "noHtml" }],
		},
	],
});
