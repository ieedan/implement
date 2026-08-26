import type { Rule } from "eslint";
import { isElementProps } from "../elements.ts";
import { readProps, writtenRole } from "../props.ts";
import { isKnownAriaAttribute, isKnownRole, roleSupports } from "../roles.ts";

const rule: Rule.RuleModule = {
	meta: {
		type: "problem",
		docs: {
			description: "Enforce that `aria-*` properties are supported by the element's `role`",
			recommended: true,
		},
		schema: [],
		messages: {
			unsupported:
				'The "{{role}}" role does not support `{{attribute}}`, so it is ignored here. Either drop it or use a role that takes it.',
		},
	},

	create(context) {
		return {
			ObjectExpression(node) {
				// Only an element's props carry a `role`; anywhere else the word is
				// just a word.
				if (!isElementProps(context, node)) return;

				const props = readProps(node);
				const role = writtenRole(props, isKnownRole);
				if (role == null) return;

				// A spread after `role` could replace it, and then this is judging
				// against a role the element does not end up with.
				if (props.spreadAfter("role")) return;

				for (const [name, property] of props.keys) {
					if (!name.startsWith("aria-")) continue;
					// An attribute the table has never heard of is `valid-aria`'s
					// business, not this rule's.
					if (!isKnownAriaAttribute(name)) continue;
					if (roleSupports(role, name)) continue;

					context.report({
						node: property,
						messageId: "unsupported",
						data: { role, attribute: name },
					});
				}
			},
		};
	},
};

export default rule;
