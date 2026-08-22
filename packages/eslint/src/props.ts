import type { Node } from "estree";
import { staticKey } from "./ast.ts";

/** A props object read for what a rule can actually see in it. */
export type ReadProps = {
	/** Statically-known keys, in source order. */
	keys: Map<string, Node & { type: "Property" }>;
	/** True when a spread could add keys this cannot see. */
	hasSpread: boolean;
	/** True when a spread appears after `key`, so it could overwrite it. */
	spreadAfter(key: string): boolean;
};

export function readProps(object: Node & { type: "ObjectExpression" }): ReadProps {
	const keys = new Map<string, Node & { type: "Property" }>();
	const spreadIndexes: number[] = [];
	const keyIndexes = new Map<string, number>();

	object.properties.forEach((property, index) => {
		if (property.type === "SpreadElement") {
			spreadIndexes.push(index);
			return;
		}
		const key = staticKey(property);
		if (key == null) return;
		keys.set(key, property);
		keyIndexes.set(key, index);
	});

	return {
		keys,
		hasSpread: spreadIndexes.length > 0,
		spreadAfter(key) {
			const index = keyIndexes.get(key);
			if (index == null) return spreadIndexes.length > 0;
			return spreadIndexes.some((spread) => spread > index);
		},
	};
}

/**
 * The role a `role` prop names, taking the first token ARIA would understand.
 * `null` when the value is not a plain string — a readable decides it at
 * runtime and no rule here can follow that.
 */
export function writtenRole(props: ReadProps, isKnown: (role: string) => boolean): string | null {
	const property = props.keys.get("role");
	if (property == null || property.value.type !== "Literal") return null;
	if (typeof property.value.value !== "string") return null;
	const tokens = property.value.value.split(/\s+/u).filter((token) => token !== "");
	return tokens.find((token) => isKnown(token)) ?? null;
}
