import type { Rule } from "eslint";
import { readProps, writtenRole } from "../props.ts";
import { isKnownRole, requiredPropsFor } from "../roles.ts";

const rule: Rule.RuleModule = {
	meta: {
		type: "problem",
		docs: {
			description: "Enforce that a `role` carries the `aria-*` properties it requires",
			recommended: true,
		},
		schema: [],
		messages: {
			missing:
				'The "{{role}}" role requires {{missing}}. Without {{subject}} a screen reader cannot say what state this is in.',
		},
	},

	create(context) {
		return {
			ObjectExpression(node) {
				const props = readProps(node);
				const role = writtenRole(props, isKnownRole);
				if (role == null) return;

				// A spread could be carrying the property this looks for, and there
				// is no reading it from here.
				if (props.hasSpread) return;

				const missing = requiredPropsFor(role).filter((name) => !props.keys.has(name));
				if (missing.length === 0) return;

				const roleProperty = props.keys.get("role");
				context.report({
					node: roleProperty ?? node,
					messageId: "missing",
					data: {
						role,
						missing: missing.map((name) => `\`${name}\``).join(" and "),
						subject: missing.length > 1 ? "them" : "it",
					},
				});
			},
		};
	},
};

export default rule;
