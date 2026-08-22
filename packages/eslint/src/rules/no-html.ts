import type { Rule } from "eslint";
import { CORE_MODULE, importedFrom } from "../ast.ts";

/** The export this rule is about. */
const HTML = "Html";

const rule: Rule.RuleModule = {
	meta: {
		type: "problem",
		docs: {
			description: "Disallow `Html`, which inserts an unsanitized string as live nodes",
			recommended: true,
		},
		schema: [],
		messages: {
			noHtml:
				"`Html` parses its string as-is with no sanitization, so anything user-provided reaching it is an XSS. If this markup is trusted, say where it comes from in a disable comment.",
		},
	},

	create(context) {
		/**
		 * Local names bound to core's `Html`. Collected from the import rather
		 * than matched by name so an aliased `Html as Raw` is caught too, and a
		 * `Html` of your own is not.
		 */
		const locals = new Set<string>();

		return {
			ImportDeclaration(node) {
				if (node.source.value !== CORE_MODULE) return;
				for (const specifier of node.specifiers) {
					if (specifier.type !== "ImportSpecifier") continue;
					const imported =
						specifier.imported.type === "Identifier"
							? specifier.imported.name
							: specifier.imported.value;
					if (imported === HTML) locals.add(specifier.local.name);
				}
			},

			Identifier(node) {
				if (!locals.has(node.name)) return;

				const { parent } = node;
				// The import itself is not a use of it.
				if (parent.type === "ImportSpecifier") return;
				// `thing.Html` and `{ Html: … }` are names that merely look alike.
				if (parent.type === "MemberExpression" && !parent.computed && parent.property === node) {
					return;
				}
				if (parent.type === "Property" && !parent.computed && parent.key === node) return;

				// A local declaration can shadow the import further down the file.
				if (importedFrom(context, node) !== CORE_MODULE) return;

				context.report({ node, messageId: "noHtml" });
			},
		};
	},
};

export default rule;
