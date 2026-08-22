import { aria, elementRoles, roles } from "aria-query";
import type { Node } from "estree";
import { staticKey } from "./ast.ts";

/**
 * `aria-query` types its keys as literal unions of every role and attribute it
 * knows. A string read out of somebody's source is not one of those until it
 * has been looked up, so the three tables are widened once, here, and every
 * rule goes through the functions below.
 */
type RoleDefinition = {
	props: Readonly<Record<string, unknown>>;
	requiredProps: Readonly<Record<string, unknown>>;
};
type ElementConcept = {
	name: string;
	constraints?: readonly unknown[];
	attributes?: readonly { name?: unknown; value?: unknown }[];
};

/* oxlint-disable typescript/no-unsafe-type-assertion -- Widening aria-query's literal key unions to the arbitrary strings a rule reads from source. */
const ROLE_TABLE = roles as unknown as ReadonlyMap<string, RoleDefinition>;
const ARIA_TABLE = aria as unknown as ReadonlyMap<string, unknown>;
const ELEMENT_ROLES = elementRoles as unknown as ReadonlyMap<ElementConcept, readonly string[]>;
/* oxlint-enable typescript/no-unsafe-type-assertion */

/**
 * The role tables come from `aria-query`, the same data `eslint-plugin-jsx-a11y`
 * and Svelte's compiler warnings read. Which roles require which properties,
 * and which properties a role supports at all, is derived from the spec's
 * inheritance graph — not something worth hand-copying into this repo.
 *
 * The attribute names and value types in `./aria.ts` stay hand-kept: this
 * version of `aria-query` is missing `aria-colindextext`/`aria-rowindextext`
 * and still lists the two deprecated attributes as ordinary ones.
 */

/** The `aria-*` properties a role cannot do without. */
export function requiredPropsFor(role: string): string[] {
	return Object.keys(ROLE_TABLE.get(role)?.requiredProps ?? {});
}

/** Whether a role permits an attribute, counting inherited and global ones. */
export function roleSupports(role: string, attribute: string): boolean {
	const definition = ROLE_TABLE.get(role);
	return definition != null && attribute in definition.props;
}

/**
 * Whether `aria-query` knows the attribute at all. Rules check this before
 * calling a property unsupported, so a gap in its table reads as "no opinion"
 * rather than as a mistake in the code being linted.
 */
export function isKnownAriaAttribute(attribute: string): boolean {
	return ARIA_TABLE.get(attribute) != null;
}

export function isKnownRole(role: string): boolean {
	return ROLE_TABLE.get(role) != null;
}

type ImplicitRole = {
	role: string;
	/** Attribute values the element must carry for the role to apply. */
	attributes: { name: string; value?: string }[];
};

/**
 * Implicit roles by tag, built once from `aria-query`'s element/role concepts.
 *
 * Concepts carrying a `constraints` entry — "scoped to the body element" and
 * friends — are dropped: they depend on where the element sits in the
 * document, which a lint rule reading one call cannot know.
 */
const IMPLICIT_ROLES = ((): Map<string, ImplicitRole[]> => {
	const byTag = new Map<string, ImplicitRole[]>();
	for (const [concept, names] of ELEMENT_ROLES.entries()) {
		if (concept.constraints != null && concept.constraints.length > 0) continue;
		const [role] = names;
		if (typeof role !== "string") continue;

		const declared = concept.attributes ?? [];
		const attributes = declared.flatMap((attribute) =>
			typeof attribute.name === "string"
				? [
						{
							name: attribute.name,
							value: typeof attribute.value === "string" ? attribute.value : undefined,
						},
					]
				: [],
		);
		// A constraint expressed as an attribute we cannot compare is no better
		// than a textual one.
		if (attributes.length !== declared.length) continue;

		const existing = byTag.get(concept.name);
		if (existing == null) byTag.set(concept.name, [{ role, attributes }]);
		else existing.push({ role, attributes });
	}
	return byTag;
})();

/**
 * The role a browser already gives `tag`, given the props written beside it.
 *
 * `input` is the reason this takes props at all: its role is decided by
 * `type`, so `Input({ type: "checkbox" })` is a checkbox and a bare `Input` is
 * a textbox. A candidate whose attributes cannot be confirmed from the literal
 * props is skipped rather than assumed.
 */
export function implicitRoleOf(
	tag: string,
	props: Node & { type: "ObjectExpression" },
): string | null {
	const candidates = IMPLICIT_ROLES.get(tag);
	if (candidates == null) return null;

	const written = new Map<string, string>();
	for (const property of props.properties) {
		const key = staticKey(property);
		if (key == null || property.type !== "Property") continue;
		if (property.value.type === "Literal" && typeof property.value.value === "string") {
			written.set(key, property.value.value);
		}
	}

	// Prefer the most specific match, so `input[type=checkbox]` wins over a
	// bare `input` entry regardless of the order they were declared in.
	const matches = candidates.filter((candidate) =>
		candidate.attributes.every(({ name, value }) => {
			const actual = written.get(name);
			if (actual == null) return false;
			return value == null || actual === value;
		}),
	);
	if (matches.length > 0) {
		return matches.reduce((best, next) =>
			next.attributes.length > best.attributes.length ? next : best,
		).role;
	}

	const bare = candidates.find((candidate) => candidate.attributes.length === 0);
	return bare?.role ?? null;
}
