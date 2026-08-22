import type { Rule } from "eslint";
import type { Node } from "estree";
import {
	coreImportDeclaration,
	coreImportInScope,
	isCoreHelper,
	typeArgumentsOf,
	typeReferenceName,
} from "../ast.ts";

/** The collection each `signal(...)` of one should have been instead. */
const REPLACEMENTS: Readonly<Record<string, string>> = {
	Map: "ImplementMap",
	Set: "ImplementSet",
};

/**
 * Writing the readonly type is a deliberate statement that the collection is
 * replaced rather than mutated — which is the whole reason to keep it in a
 * signal. Saying so opts out of the rule.
 */
const IMMUTABLE_INTENT = new Set(["ReadonlyMap", "ReadonlySet"]);

const SIGNAL_FACTORY = new Set(["signal"]);

/** Core's readable types, as they appear in an annotation. */
const SIGNAL_TYPES = new Set(["Derived", "Readable", "Signal", "Writable"]);

/**
 * The collection a `signal()` call is holding, from whichever of the three
 * places says so: the type argument, the value, or the annotation on the
 * variable it is being assigned to.
 */
function collectionOf(node: Node & { type: "CallExpression" }, parent: Node): string | null {
	// Whatever the value looks like, a declared type is the author speaking.
	const declaredInner = declaredCollection(node, parent);
	if (declaredInner != null) {
		return IMMUTABLE_INTENT.has(declaredInner)
			? null
			: declaredInner in REPLACEMENTS
				? declaredInner
				: null;
	}

	const [argument] = node.arguments;
	if (argument?.type === "NewExpression" && argument.callee.type === "Identifier") {
		if (argument.callee.name in REPLACEMENTS) return argument.callee.name;
	}

	return null;
}

/** The collection named by a type argument or by the variable's annotation. */
function declaredCollection(node: Node & { type: "CallExpression" }, parent: Node): string | null {
	const [typeArgument] = typeArgumentsOf(node);
	const fromTypeArgument = typeReferenceName(typeArgument);
	if (fromTypeArgument != null) return fromTypeArgument;

	if (parent.type !== "VariableDeclarator") return null;
	const declared = typeReferenceName(declaredType(parent.id));
	if (declared == null || !SIGNAL_TYPES.has(declared)) return null;

	const [inner] = typeArgumentsOf(declaredType(parent.id));
	return typeReferenceName(inner);
}

/** The type in `x: Foo`, or `undefined` when there is no annotation. */
function declaredType(node: unknown): unknown {
	if (node == null || typeof node !== "object" || !("typeAnnotation" in node)) return undefined;
	const outer = node.typeAnnotation;
	if (outer == null || typeof outer !== "object" || !("typeAnnotation" in outer)) return undefined;
	return outer.typeAnnotation;
}

const rule: Rule.RuleModule = {
	meta: {
		type: "suggestion",
		docs: {
			description: "Prefer `ImplementSet`/`ImplementMap` over a signal holding a `Set` or `Map`",
			recommended: true,
		},
		hasSuggestions: true,
		schema: [],
		messages: {
			preferReactive:
				"A signal only notifies when it is `set`, so mutating this {{collection}} in place changes nothing and updating it means copying the whole collection. `{{replacement}}` is a real {{collection}} whose own mutators notify.",
			replace: "Replace with `{{replacement}}`",
		},
	},

	create(context) {
		return {
			CallExpression(node) {
				if (node.callee.type !== "Identifier") return;
				if (!isCoreHelper(context, node.callee, SIGNAL_FACTORY)) return;

				const collection = collectionOf(node, node.parent);
				if (collection == null) return;

				const replacement = REPLACEMENTS[collection];
				if (replacement == null) return;

				const data = { collection, replacement };

				// The rewrite drops the `Set`/`Map` wrapper, so an annotation naming
				// `Signal<Set<…>>` would be left describing something else. Those are
				// reported without one rather than suggesting code that will not
				// compile.
				const [argument] = node.arguments;
				const annotated =
					node.parent.type === "VariableDeclarator" && declaredType(node.parent.id) != null;
				const rewritable =
					!annotated && argument?.type === "NewExpression" && node.arguments.length === 1;

				if (!rewritable) {
					context.report({ node, messageId: "preferReactive", data });
					return;
				}

				const args = argument.arguments.map((each) => context.sourceCode.getText(each));
				const rewritten = `${replacement}(${args.join(", ")})`;
				const declaration = coreImportDeclaration(context, node.callee);
				const last = declaration?.specifiers.at(-1);

				context.report({
					node,
					messageId: "preferReactive",
					data,
					suggest: [
						{
							messageId: "replace",
							data,
							fix(fixer) {
								const edits = [fixer.replaceText(node, rewritten)];
								// `signal` came from core, so the import to extend is there.
								if (!coreImportInScope(context, node, replacement) && last != null) {
									edits.push(fixer.insertTextAfter(last, `, ${replacement}`));
								}
								return edits;
							},
						},
					],
				});
			},
		};
	},
};

export default rule;
