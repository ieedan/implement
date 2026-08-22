import type { Rule } from "eslint";
import type { Node } from "estree";
import { atModuleScope, isCoreHelper, isDiscarded, lifetimeOf } from "../ast.ts";

type Options = { checkParameters?: boolean };

/** Subscription methods on a readable. Both hand back an unsubscribe. */
const METHODS = new Set(["subscribe", "onChange"]);

/** The standalone forms, which take their sources as an array. */
const HELPERS = new Set(["watch", "subscribe"]);

const rule: Rule.RuleModule = {
	meta: {
		type: "problem",
		docs: {
			description:
				"Require the unsubscribe from a subscription to be kept when the signal outlives the code subscribing to it",
			recommended: true,
		},
		schema: [
			{
				type: "object",
				properties: {
					checkParameters: { type: "boolean" },
				},
				additionalProperties: false,
			},
		],
		messages: {
			method:
				"This subscription is never unsubscribed, and `{{name}}` outlives the function that made it. Return the unsubscribe from `ImplementLifecycle`'s `onMount`, or keep it and call it yourself.",
			helper:
				"This `{{callee}}` is never stopped, and `{{name}}` outlives the function that called it. Use `ImplementEffect`, which subscribes on mount and cleans up on unmount, or keep the returned stop function.",
		},
	},

	create(context) {
		const options: Options = context.options[0] ?? {};
		const checkParameters = options.checkParameters ?? false;

		/**
		 * Whether a source is long-lived enough for a dangling subscription to
		 * matter. A parameter only counts when the project has said its
		 * components are handed signals from outside.
		 */
		function escapes(node: Node): boolean {
			const lifetime = lifetimeOf(context, node);
			return lifetime === "outlives" || (checkParameters && lifetime === "parameter");
		}

		return {
			CallExpression(node) {
				if (!isDiscarded(node)) return;

				// A subscription at module scope lives as long as the app does,
				// which is usually the whole point of putting it there.
				if (atModuleScope(context, node)) return;

				const { callee } = node;

				if (
					callee.type === "MemberExpression" &&
					!callee.computed &&
					callee.property.type === "Identifier" &&
					METHODS.has(callee.property.name)
				) {
					if (!escapes(callee.object)) return;
					context.report({
						node,
						messageId: "method",
						data: { name: context.sourceCode.getText(callee.object) },
					});
					return;
				}

				if (!isCoreHelper(context, callee, HELPERS)) return;

				// `watch([a, b], fn)` — the sources are the first argument. If it
				// is not a literal array there is nothing to weigh up, so the rule
				// stays quiet rather than guess.
				const [sources] = node.arguments;
				if (sources?.type !== "ArrayExpression") return;

				const escaping = sources.elements.find(
					(element) => element != null && element.type !== "SpreadElement" && escapes(element),
				);
				if (escaping == null) return;

				context.report({
					node,
					messageId: "helper",
					data: {
						callee: context.sourceCode.getText(callee),
						name: context.sourceCode.getText(escaping),
					},
				});
			},
		};
	},
};

export default rule;
