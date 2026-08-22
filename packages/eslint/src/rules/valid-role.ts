import type { Rule } from "eslint";
import { ABSTRACT_ARIA_ROLES, ARIA_ROLES, DEPRECATED_ARIA_ROLES } from "../aria.ts";
import { didYouMean, staticKey } from "../ast.ts";

type Options = { extraRoles?: string[] };

const rule: Rule.RuleModule = {
	meta: {
		type: "problem",
		docs: {
			description: "Enforce that a `role` prop names a concrete ARIA role",
			recommended: true,
		},
		hasSuggestions: true,
		schema: [
			{
				type: "object",
				properties: {
					extraRoles: {
						type: "array",
						items: { type: "string" },
						uniqueItems: true,
					},
				},
				additionalProperties: false,
			},
		],
		messages: {
			unknown: '"{{role}}" is not an ARIA role.',
			unknownSuggest: '"{{role}}" is not an ARIA role. Did you mean "{{suggestion}}"?',
			abstract:
				'"{{role}}" is an abstract role. Abstract roles are for the ARIA taxonomy itself and are ignored on an element.',
			deprecated: '"{{role}}" is a deprecated role. {{reason}}',
			replace: 'Replace with "{{suggestion}}"',
		},
	},

	create(context) {
		const options: Options = context.options[0] ?? {};
		const extra = new Set(options.extraRoles ?? []);

		return {
			Property(node) {
				if (node.parent.type !== "ObjectExpression") return;
				if (staticKey(node) !== "role") return;

				const { value } = node;
				if (value.type !== "Literal" || typeof value.value !== "string") return;

				// ARIA takes a space-separated list and uses the first role it
				// understands, so every token has to be a real role.
				const roles = value.value.split(/\s+/u).filter((role) => role !== "");
				for (const role of roles) {
					if (extra.has(role) || ARIA_ROLES.has(role)) continue;

					const deprecation = DEPRECATED_ARIA_ROLES[role];
					if (deprecation != null) {
						context.report({
							node: value,
							messageId: "deprecated",
							data: { role, reason: deprecation },
						});
						continue;
					}

					if (ABSTRACT_ARIA_ROLES.has(role)) {
						context.report({ node: value, messageId: "abstract", data: { role } });
						continue;
					}

					const suggestion = didYouMean(role, ARIA_ROLES);
					if (suggestion == null) {
						context.report({ node: value, messageId: "unknown", data: { role } });
						continue;
					}

					context.report({
						node: value,
						messageId: "unknownSuggest",
						data: { role, suggestion },
						suggest: [
							{
								messageId: "replace",
								data: { suggestion },
								// Only the mistyped token is replaced; a fallback list
								// keeps the roles around it.
								fix(fixer) {
									const replaced = roles.map((each) => (each === role ? suggestion : each));
									const raw = context.sourceCode.getText(value);
									const quote = raw.startsWith("'") ? "'" : '"';
									return fixer.replaceText(value, `${quote}${replaced.join(" ")}${quote}`);
								},
							},
						],
					});
				}
			},
		};
	},
};

export default rule;
