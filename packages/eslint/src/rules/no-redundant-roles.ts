import type { Rule } from "eslint";
import { elementPropsTag } from "../elements.ts";
import { readProps, writtenRole } from "../props.ts";
import { implicitRoleOf, isKnownRole } from "../roles.ts";

const rule: Rule.RuleModule = {
	meta: {
		type: "suggestion",
		docs: {
			description: "Disallow a `role` an element already has by default",
			recommended: true,
		},
		schema: [],
		messages: {
			redundant:
				'`{{element}}` already has the "{{role}}" role, so writing it again changes nothing.',
		},
	},

	create(context) {
		return {
			ObjectExpression(node) {
				// Only the props of an element the call actually names; the implicit
				// role is a fact about the tag, so there is nothing to compare
				// against without one.
				const tag = elementPropsTag(context, node);
				if (tag == null) return;

				const props = readProps(node);
				// A spread could be supplying the role that ends up winning.
				if (props.hasSpread) return;

				const role = writtenRole(props, isKnownRole);
				if (role == null || role !== implicitRoleOf(tag, node)) return;

				context.report({
					node: props.keys.get("role") ?? node,
					messageId: "redundant",
					data: { element: `<${tag}>`, role },
				});
			},
		};
	},
};

export default rule;
