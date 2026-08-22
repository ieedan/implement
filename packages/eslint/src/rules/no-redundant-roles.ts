import type { Rule } from "eslint";
import { coreElementTag } from "../elements.ts";
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
			CallExpression(node) {
				const tag = coreElementTag(context, node.callee);
				if (tag == null) return;

				const [first] = node.arguments;
				if (first?.type !== "ObjectExpression") return;

				const props = readProps(first);
				// A spread could be supplying the role that ends up winning.
				if (props.hasSpread) return;

				const role = writtenRole(props, isKnownRole);
				if (role == null || role !== implicitRoleOf(tag, first)) return;

				context.report({
					node: props.keys.get("role") ?? first,
					messageId: "redundant",
					data: { element: `<${tag}>`, role },
				});
			},
		};
	},
};

export default rule;
