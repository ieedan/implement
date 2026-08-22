import type { Rule } from "eslint";
import type { Node } from "estree";
import { ARIA_ATTRIBUTES, DEPRECATED_ARIA_ATTRIBUTES, type AriaAttribute } from "../aria.ts";
import { didYouMean, staticKey } from "../ast.ts";

/**
 * A literal the rule can judge. Anything else — an identifier, a call, a
 * signal — is a value only known at runtime, and gets skipped.
 */
type StaticValue =
	| { kind: "string"; value: string }
	| { kind: "boolean"; value: boolean }
	| {
			kind: "number";
			value: number;
	  };

function staticValue(node: Node): StaticValue | null {
	if (node.type === "Literal") {
		if (typeof node.value === "string") return { kind: "string", value: node.value };
		if (typeof node.value === "boolean") return { kind: "boolean", value: node.value };
		if (typeof node.value === "number") return { kind: "number", value: node.value };
		return null;
	}
	// Negative numbers parse as a unary minus wrapping the literal.
	if (node.type === "UnaryExpression" && node.operator === "-") {
		const inner = staticValue(node.argument);
		return inner?.kind === "number" ? { kind: "number", value: -inner.value } : null;
	}
	if (node.type === "TemplateLiteral" && node.expressions.length === 0) {
		const [quasi] = node.quasis;
		return quasi == null ? null : { kind: "string", value: quasi.value.cooked ?? quasi.value.raw };
	}
	return null;
}

/** How the value reads once it reaches the DOM, where every attribute is text. */
function asText(value: StaticValue): string {
	return String(value.value);
}

const BOOLEANS = new Set(["true", "false"]);

/** The permitted values for an attribute, phrased for a message. */
function expected(attribute: AriaAttribute): string {
	switch (attribute.type) {
		case "boolean":
			return "true or false";
		case "tristate":
			return "true, false, or mixed";
		case "integer":
			return "an integer";
		case "number":
			return "a number";
		default:
			return (attribute.values ?? []).join(", ");
	}
}

/** `null` when the value is fine, otherwise why it is not. */
function violation(attribute: AriaAttribute, value: StaticValue): "value" | null {
	const text = asText(value);
	switch (attribute.type) {
		case "boolean":
			return BOOLEANS.has(text) ? null : "value";
		case "tristate":
			return BOOLEANS.has(text) || text === "mixed" ? null : "value";
		case "integer":
			return Number.isInteger(Number(text)) && text.trim() !== "" ? null : "value";
		case "number":
			return !Number.isNaN(Number(text)) && text.trim() !== "" ? null : "value";
		case "token":
			return (attribute.values ?? []).includes(text) ? null : "value";
		case "tokenlist": {
			const tokens = text.split(/\s+/u).filter((token) => token !== "");
			if (tokens.length === 0) return "value";
			const allowed = attribute.values ?? [];
			return tokens.every((token) => allowed.includes(token)) ? null : "value";
		}
		// `id`, `idlist` and `string` are whatever the author wants them to be:
		// the ids they point at live in another file as often as not.
		default:
			return null;
	}
}

type Options = { extraAttributes?: string[] };

const rule: Rule.RuleModule = {
	meta: {
		type: "problem",
		docs: {
			description:
				"Disallow unknown `aria-*` attributes, and values outside the set an attribute permits",
			recommended: true,
		},
		hasSuggestions: true,
		schema: [
			{
				type: "object",
				properties: {
					extraAttributes: {
						type: "array",
						items: { type: "string" },
						uniqueItems: true,
					},
				},
				additionalProperties: false,
			},
		],
		messages: {
			unknown: '"{{name}}" is not an ARIA attribute.',
			unknownSuggest: '"{{name}}" is not an ARIA attribute. Did you mean "{{suggestion}}"?',
			deprecated: '"{{name}}" is deprecated. {{reason}}',
			value: '"{{name}}" does not accept {{actual}}. Expected {{expected}}.',
			replace: 'Replace with "{{suggestion}}"',
		},
	},

	create(context) {
		const options: Options = context.options[0] ?? {};
		const extra = new Set(options.extraAttributes ?? []);
		const known = Object.keys(ARIA_ATTRIBUTES);

		return {
			Property(node) {
				// An `aria-*` key in a destructuring pattern reads a prop rather
				// than setting one, so there is nothing to validate.
				if (node.parent.type !== "ObjectExpression") return;

				const name = staticKey(node);
				if (name == null || !name.startsWith("aria-")) return;
				if (extra.has(name)) return;

				const deprecation = DEPRECATED_ARIA_ATTRIBUTES[name];
				if (deprecation != null) {
					context.report({
						node: node.key,
						messageId: "deprecated",
						data: { name, reason: deprecation },
					});
					return;
				}

				const attribute = ARIA_ATTRIBUTES[name];
				if (attribute == null) {
					const suggestion = didYouMean(name, known);
					if (suggestion == null) {
						context.report({ node: node.key, messageId: "unknown", data: { name } });
						return;
					}
					context.report({
						node: node.key,
						messageId: "unknownSuggest",
						data: { name, suggestion },
						suggest: [
							{
								messageId: "replace",
								data: { suggestion },
								fix(fixer) {
									const raw = context.sourceCode.getText(node.key);
									const quote = raw.startsWith("'") ? "'" : '"';
									return fixer.replaceText(node.key, `${quote}${suggestion}${quote}`);
								},
							},
						],
					});
					return;
				}

				// A readable is a perfectly good prop value, and what it yields is
				// not knowable here — only literals get judged.
				const value = staticValue(node.value);
				if (value == null) return;

				if (violation(attribute, value) != null) {
					context.report({
						node: node.value,
						messageId: "value",
						data: {
							name,
							actual: value.kind === "string" ? `"${value.value}"` : asText(value),
							expected: expected(attribute),
						},
					});
				}
			},
		};
	},
};

export default rule;
