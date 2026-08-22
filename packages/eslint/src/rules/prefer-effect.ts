import type { Rule } from "eslint";
import type { Node } from "estree";
import { coreImportDeclaration, coreImportInScope, isCoreHelper } from "../ast.ts";

const LIFECYCLE = new Set(["ImplementLifecycle"]);

/** What the rewrite names. */
const EFFECT = "ImplementEffect";

/**
 * The two standalone helpers with the same semantics as `ImplementEffect`:
 * both run the effect once with the current values and again on every change.
 * `readable.subscribe`/`readable.onChange` deliberately skip that first run, so
 * swapping either of them for an effect would change behaviour and neither is
 * matched here.
 */
const IMMEDIATE = new Set(["watch", "subscribe"]);

/** The call an arrow hands back, whether by expression or by `return`. */
function returnedCall(node: Node): (Node & { type: "CallExpression" }) | null {
	if (node.type !== "ArrowFunctionExpression" || node.params.length > 0) return null;

	const { body } = node;
	if (body.type === "CallExpression") return body;
	if (body.type !== "BlockStatement" || body.body.length !== 1) return null;

	const [statement] = body.body;
	if (statement?.type !== "ReturnStatement" || statement.argument == null) return null;
	return statement.argument.type === "CallExpression" ? statement.argument : null;
}

const rule: Rule.RuleModule = {
	meta: {
		type: "suggestion",
		docs: {
			description:
				"Prefer `ImplementEffect` over an `ImplementLifecycle` that exists only to own a `watch`",
			recommended: true,
		},
		hasSuggestions: true,
		schema: [],
		messages: {
			preferEffect:
				"`ImplementEffect` subscribes on mount and unsubscribes on unmount, so this `ImplementLifecycle` is doing by hand what it does on its own.",
			replace: "Replace with `ImplementEffect`",
		},
	},

	create(context) {
		return {
			CallExpression(node) {
				if (!isCoreHelper(context, node.callee, LIFECYCLE)) return;

				// Children make the node own a subtree, which an effect cannot do.
				if (node.arguments.length !== 1) return;

				const [props] = node.arguments;
				if (props?.type !== "ObjectExpression" || props.properties.length !== 1) return;

				const [property] = props.properties;
				if (
					property?.type !== "Property" ||
					property.computed ||
					property.key.type !== "Identifier" ||
					property.key.name !== "onMount"
				) {
					return;
				}

				const call = returnedCall(property.value);
				if (call == null || !isCoreHelper(context, call.callee, IMMEDIATE)) return;

				const args = call.arguments.map((argument) => context.sourceCode.getText(argument));
				const rewritten = `${EFFECT}(${args.join(", ")})`;

				if (coreImportInScope(context, node, EFFECT)) {
					context.report({
						node,
						messageId: "preferEffect",
						suggest: [{ messageId: "replace", fix: (fixer) => fixer.replaceText(node, rewritten) }],
					});
					return;
				}

				// The helper has to be imported before the rewrite can name it. It
				// joins the `ImplementLifecycle` import, which is the one the rule
				// matched on and so is always core's.
				const declaration =
					node.callee.type === "Identifier" ? coreImportDeclaration(context, node.callee) : null;
				const last = declaration?.specifiers.at(-1);
				if (last == null) {
					context.report({ node, messageId: "preferEffect" });
					return;
				}

				context.report({
					node,
					messageId: "preferEffect",
					suggest: [
						{
							messageId: "replace",
							fix: (fixer) => [
								fixer.insertTextAfter(last, `, ${EFFECT}`),
								fixer.replaceText(node, rewritten),
							],
						},
					],
				});
			},
		};
	},
};

export default rule;
