import type { Rule } from "eslint";
import type { Node } from "estree";

/**
 * A callee that names a component. Every element and helper the framework
 * renders through is PascalCase (`Div`, `Ul`, `ForEach`, a userland `Item`),
 * so this is what separates a list being rendered from one being sent to an
 * API or written to storage.
 */
function isComponentCallee(callee: Node): boolean {
	const name =
		callee.type === "Identifier"
			? callee.name
			: callee.type === "MemberExpression" &&
				  !callee.computed &&
				  callee.property.type === "Identifier"
				? callee.property.name
				: null;
	return name != null && /^[A-Z]/u.test(name);
}

/** `x.get()` with no arguments — the snapshot read, not `Map.prototype.get`. */
function isSnapshotRead(node: Node): boolean {
	return (
		node.type === "CallExpression" &&
		node.arguments.length === 0 &&
		node.callee.type === "MemberExpression" &&
		!node.callee.computed &&
		node.callee.property.type === "Identifier" &&
		node.callee.property.name === "get"
	);
}

const rule: Rule.RuleModule = {
	meta: {
		type: "problem",
		docs: {
			description: "Disallow rendering a list through `signal.get().map()` instead of `ForEach`",
			recommended: true,
		},
		schema: [],
		messages: {
			preferForEach:
				"`get()` reads the value once, so this list renders with whatever was there at mount and never changes again. Use `ForEach({{source}}, getKey, render)`, which re-renders as the signal changes.",
		},
	},

	create(context) {
		return {
			CallExpression(node) {
				const { callee } = node;
				if (
					callee.type !== "MemberExpression" ||
					callee.computed ||
					callee.property.type !== "Identifier" ||
					callee.property.name !== "map"
				) {
					return;
				}
				if (!isSnapshotRead(callee.object)) return;

				// Outside a rendered position, reading the current value and mapping
				// it is the correct thing to do — an event handler building a
				// payload, a one-off snapshot. Only children are reactive.
				const parent = node.parent;
				const rendered =
					parent.type === "SpreadElement"
						? parent.parent.type === "CallExpression" && isComponentCallee(parent.parent.callee)
						: parent.type === "CallExpression" &&
							parent.arguments.includes(node) &&
							isComponentCallee(parent.callee);
				if (!rendered) return;

				// `callee.object` is the `get()` call; its own object is the signal.
				const source =
					callee.object.type === "CallExpression" &&
					callee.object.callee.type === "MemberExpression"
						? context.sourceCode.getText(callee.object.callee.object)
						: "items";

				context.report({ node, messageId: "preferForEach", data: { source } });
			},
		};
	},
};

export default rule;
