import type { Rule } from "eslint";
import type { Node } from "estree";
import { isSignal } from "../ast.ts";

/**
 * Where a value is tested for truth rather than read. A signal is an object,
 * so every one of these takes the truthy branch forever.
 */
function testedExpression(node: Rule.Node): Node | null {
	switch (node.type) {
		case "ConditionalExpression":
			return node.test;
		case "IfStatement":
		case "WhileStatement":
		case "DoWhileStatement":
			return node.test;
		case "UnaryExpression":
			return node.operator === "!" ? node.argument : null;
		case "LogicalExpression":
			// Only the left side decides which way the operator goes; the right is
			// the value it yields.
			return node.operator === "??" ? null : node.left;
		default:
			return null;
	}
}

const rule: Rule.RuleModule = {
	meta: {
		type: "problem",
		docs: {
			description: "Disallow testing a signal for truthiness instead of its value",
			recommended: true,
		},
		schema: [],
		messages: {
			signalCondition:
				"`{{name}}` is a signal, which is an object and so always truthy — this takes the same branch forever. Test the value with `{{name}}.bind((value) => …)`, or read it with `{{name}}.get()` if you meant a one-off check.",
		},
	},

	create(context) {
		return {
			"ConditionalExpression, IfStatement, WhileStatement, DoWhileStatement, UnaryExpression, LogicalExpression"(
				node: Rule.Node,
			) {
				const tested = testedExpression(node);
				if (tested == null || !isSignal(context, tested)) return;

				context.report({
					node: tested,
					messageId: "signalCondition",
					data: { name: context.sourceCode.getText(tested) },
				});
			},
		};
	},
};

export default rule;
