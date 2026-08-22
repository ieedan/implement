import type { Rule, Scope } from "eslint";
import type { Node } from "estree";

/** The package the framework's own helpers are imported from. */
export const CORE_MODULE = "@implementjs/core";

/**
 * The scope kinds nothing narrower than the module encloses. A binding in one
 * of these is around for as long as the module is.
 */
const MODULE_SCOPES = new Set(["module", "global"]);

/**
 * True when `node` sits at module scope rather than inside a function.
 *
 * `variableScope` skips past block scopes to the function (or the module) that
 * owns them, which is the granularity lifetime is decided at.
 */
export function atModuleScope(context: Rule.RuleContext, node: Node): boolean {
	return MODULE_SCOPES.has(context.sourceCode.getScope(node).variableScope.type);
}

/**
 * The property name when it is knowable statically. Computed keys and
 * template literals return `null` — a rule should stay quiet rather than
 * guess at a name it cannot read.
 */
export function staticKey(property: Node): string | null {
	if (property.type !== "Property" || property.computed) return null;
	const { key } = property;
	if (key.type === "Identifier") return key.name;
	if (key.type === "Literal" && typeof key.value === "string") return key.value;
	return null;
}

/** Walks a member chain down to the identifier it starts from: `a.b.c` → `a`. */
export function rootIdentifier(node: Node): (Node & { type: "Identifier" }) | null {
	let current = node;
	while (current.type === "MemberExpression") current = current.object;
	return current.type === "Identifier" ? current : null;
}

/** True when the call's result is thrown away rather than bound or returned. */
export function isDiscarded(call: Rule.Node): boolean {
	// `parent` is only null on Program, which is never a call.
	return call.parent?.type === "ExpressionStatement";
}

function lookup(scope: Scope.Scope | null, name: string): Scope.Variable | null {
	let current = scope;
	while (current != null) {
		const found = current.variables.find((variable) => variable.name === name);
		if (found != null) return found;
		current = current.upper;
	}
	return null;
}

/**
 * True when `name` is in scope at `node` as an import from core. Used to tell
 * whether a suggested rewrite can name a helper without adding an import.
 */
export function coreImportInScope(context: Rule.RuleContext, node: Node, name: string): boolean {
	const definition = lookup(context.sourceCode.getScope(node), name)?.defs[0];
	if (definition?.type !== "ImportBinding") return false;
	return definition.parent.source.value === CORE_MODULE;
}

/** The `import` an identifier came in through, when it came from core. */
export function coreImportDeclaration(
	context: Rule.RuleContext,
	identifier: Node & { type: "Identifier" },
): (Node & { type: "ImportDeclaration" }) | null {
	const definition = resolve(context, identifier)?.defs[0];
	if (definition?.type !== "ImportBinding") return null;
	return definition.parent.source.value === CORE_MODULE ? definition.parent : null;
}

/** Resolves an identifier to its declaration, walking out through the scopes. */
export function resolve(
	context: Rule.RuleContext,
	identifier: Node & { type: "Identifier" },
): Scope.Variable | null {
	return lookup(context.sourceCode.getScope(identifier), identifier.name);
}

/**
 * How long the value behind an identifier lives, relative to the code using
 * it.
 *
 * Scope resolution guarantees a variable's declaration encloses every
 * reference to it, so anything declared inside *some* function shares that
 * function's lifetime with the code below it — the check is only whether the
 * declaration is inside a function at all. An import or a module-scope
 * binding is the clear other case: it is there for as long as the module is.
 *
 * A parameter is genuinely undecidable from here, which is why it gets its
 * own answer rather than being folded into one of the two. The same
 * `function MenuRoot(state)` is called both with a state its caller created a
 * line earlier — one lifetime, nothing leaked — and with one out of a context
 * that outlives every consumer.
 */
export type Lifetime = "local" | "outlives" | "parameter" | "unknown";

export function lifetimeOf(context: Rule.RuleContext, node: Node): Lifetime {
	const identifier = rootIdentifier(node);
	if (identifier == null) return "unknown";

	const variable = resolve(context, identifier);
	const definition = variable?.defs[0];
	if (variable == null || definition == null) return "unknown";

	if (definition.type === "ImportBinding") return "outlives";
	if (definition.type === "Parameter") return "parameter";
	return MODULE_SCOPES.has(variable.scope.variableScope.type) ? "outlives" : "local";
}

/**
 * The name an identifier was imported under at the source, when it came from
 * `module`. `import { Button as ButtonElement }` gives back `"Button"` — the
 * name that says which export it is, rather than the local alias.
 */
export function importedName(
	context: Rule.RuleContext,
	identifier: Node & { type: "Identifier" },
	module: string,
): string | null {
	const definition = resolve(context, identifier)?.defs[0];
	if (definition?.type !== "ImportBinding") return null;
	if (definition.parent.source.value !== module) return null;
	const { node } = definition;
	if (node.type !== "ImportSpecifier") return null;
	if (node.imported.type === "Identifier") return node.imported.name;
	return typeof node.imported.value === "string" ? node.imported.value : null;
}

/** The module specifier an identifier was imported from, if it was. */
export function importedFrom(
	context: Rule.RuleContext,
	identifier: Node & { type: "Identifier" },
): string | null {
	const definition = resolve(context, identifier)?.defs[0];
	if (definition?.type !== "ImportBinding") return null;
	const { source } = definition.parent;
	return typeof source.value === "string" ? source.value : null;
}

/**
 * Matches the framework's helpers in both the shapes they are reached
 * through: imported on their own (`ImplementEffect(...)`) and off a namespace
 * import (`core.ImplementEffect(...)`). Only bindings that actually come from
 * `@implementjs/core` match, so a local function of the same name does not.
 */
export function isCoreHelper(
	context: Rule.RuleContext,
	callee: Node,
	names: ReadonlySet<string>,
): boolean {
	if (callee.type === "Identifier") {
		return names.has(callee.name) && importedFrom(context, callee) === CORE_MODULE;
	}
	if (callee.type === "MemberExpression" && !callee.computed) {
		const { object, property } = callee;
		if (object.type !== "Identifier" || property.type !== "Identifier") return false;
		if (!names.has(property.name)) return false;
		return importedFrom(context, object) === CORE_MODULE;
	}
	return false;
}

/**
 * Core's readable types. An annotation naming one of these is the clearest
 * statement that a value is a signal, and the only evidence available when it
 * was created in another file.
 */
const SIGNAL_TYPES = new Set([
	"Derived",
	"Readable",
	"ReadableSource",
	"ReactiveMap",
	"ReactiveSet",
	"Signal",
	"Writable",
]);

/** Core's factories. A call to one of these produces a readable. */
const SIGNAL_FACTORIES = new Set(["derived", "ImplementMap", "ImplementSet", "signal"]);

/*
 * TypeScript's nodes are absent from `@types/estree`, and the linters disagree
 * about nothing here — both put annotations exactly where TS-ESTree does. The
 * accessors below read them through `unknown`, one literal key at a time, so
 * the shape is checked rather than asserted.
 */

/** The type in `x: Foo`, reached through the `TSTypeAnnotation` wrapper. */
function typeAnnotationOf(node: unknown): unknown {
	if (node == null || typeof node !== "object" || !("typeAnnotation" in node)) return undefined;
	const outer = node.typeAnnotation;
	if (outer == null || typeof outer !== "object" || !("typeAnnotation" in outer)) return undefined;
	return outer.typeAnnotation;
}

/** The name of a `TSTypeReference`: `Signal<Set<string>>` → `"Signal"`. */
export function typeReferenceName(type: unknown): string | null {
	if (type == null || typeof type !== "object" || !("typeName" in type)) return null;
	const { typeName } = type;
	if (typeName == null || typeof typeName !== "object" || !("name" in typeName)) return null;
	return typeof typeName.name === "string" ? typeName.name : null;
}

/**
 * The arguments in `Foo<A, B>` — on a type reference or on a call. Both hang
 * them off `typeArguments` as a `TSTypeParameterInstantiation`.
 */
export function typeArgumentsOf(node: unknown): unknown[] {
	if (node == null || typeof node !== "object" || !("typeArguments" in node)) return [];
	const args = node.typeArguments;
	if (args == null || typeof args !== "object" || !("params" in args)) return [];
	return Array.isArray(args.params) ? args.params : [];
}

/** True when an annotation on `node` names one of core's readable types. */
function hasSignalAnnotation(node: unknown): boolean {
	const name = typeReferenceName(typeAnnotationOf(node));
	return name != null && SIGNAL_TYPES.has(name);
}

/**
 * Whether an identifier holds a signal, on syntax alone.
 *
 * There are two kinds of evidence, and the rules that use this only report
 * when one of them is present — an unrecognised value is left alone rather
 * than guessed at. A signal reached through something this cannot resolve (a
 * prop off a destructured object, an import from another file) simply is not
 * detected, which costs a report and never invents one.
 */
export function isSignal(context: Rule.RuleContext, node: Node, depth = 0): boolean {
	if (node.type !== "Identifier" || depth > 3) return false;

	const definition = resolve(context, node)?.defs[0];
	if (definition == null) return false;

	// A parameter says what it is or says nothing.
	if (definition.type === "Parameter") return hasSignalAnnotation(definition.name);
	if (definition.type !== "Variable") return false;

	if (hasSignalAnnotation(definition.name)) return true;

	const { init } = definition.node;
	if (init == null || init.type !== "CallExpression") return false;

	if (init.callee.type === "Identifier") {
		return (
			SIGNAL_FACTORIES.has(init.callee.name) && importedFrom(context, init.callee) === CORE_MODULE
		);
	}

	// `count.bind(...)` is a view onto whatever `count` is.
	if (
		init.callee.type === "MemberExpression" &&
		!init.callee.computed &&
		init.callee.property.type === "Identifier" &&
		init.callee.property.name === "bind"
	) {
		return isSignal(context, init.callee.object, depth + 1);
	}

	return false;
}

function levenshtein(a: string, b: string): number {
	// Only the previous row is ever read, so one row of scratch is enough.
	let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
	for (let i = 1; i <= a.length; i++) {
		const current = [i];
		for (let j = 1; j <= b.length; j++) {
			const substitution = (previous[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1);
			const insertion = (current[j - 1] ?? 0) + 1;
			const deletion = (previous[j] ?? 0) + 1;
			current.push(Math.min(substitution, insertion, deletion));
		}
		previous = current;
	}
	return previous[b.length] ?? 0;
}

/**
 * The closest candidate to `name`, when one is close enough to be worth
 * suggesting. The threshold scales with length so that short names don't
 * match half the table.
 */
export function didYouMean(name: string, candidates: Iterable<string>): string | null {
	const limit = Math.max(2, Math.floor(name.length / 4));
	let best: string | null = null;
	let bestDistance = Infinity;
	for (const candidate of candidates) {
		const distance = levenshtein(name, candidate);
		if (distance < bestDistance) {
			best = candidate;
			bestDistance = distance;
		}
	}
	return bestDistance <= limit ? best : null;
}
