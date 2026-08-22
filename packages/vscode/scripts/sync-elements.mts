// Regenerates src/elements.ts from core.
//
// The element list and the void-element list both have to track core, or the
// extension makes confidently wrong suggestions — offering children on a tag
// that takes none, or nothing at all on a tag that was just added. Run through
// the repo's `pnpm generate`; `tests/elements.test.ts` fails when it drifts.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const core = join(here, "../../core/src/components");

export function readElements(): string[] {
	const source = readFileSync(join(core, "elements.ts"), "utf8");
	const names = [...source.matchAll(/export const (\w+) = /g)].flatMap((m) => m[1] ?? []);
	if (!names.length) throw new Error("no element factories found in core/elements.ts");
	return names;
}

export function readVoidElements(): string[] {
	const source = readFileSync(join(core, "props.ts"), "utf8");
	const block = /export type VoidHTMLElement =([\s\S]*?);/.exec(source);
	if (!block?.[1]) throw new Error("VoidHTMLElement not found in core/props.ts");
	const tags = [...block[1].matchAll(/"([a-z0-9]+)"/g)].flatMap((m) => m[1] ?? []);
	if (!tags.length) throw new Error("VoidHTMLElement listed no tags");
	// Core names the factories in PascalCase; the type lists raw tag names.
	const names = tags.map((tag) => tag.slice(0, 1).toUpperCase() + tag.slice(1));
	// `VoidHTMLElement` is a fact about HTML, spanning every tag in
	// `HTMLElementTagNameMap` — so it still names `base`, which core exports no
	// factory for. This list only exists to pick `propsOnly` over
	// `propsChildren` for a factory, so a tag without one is noise.
	const elements = new Set(readElements());
	return names.filter((name) => elements.has(name));
}

const list = (names: string[]): string => names.map((n) => `\t"${n}",`).join("\n");

export function render(elements: string[], voidElements: string[]): string {
	return `// generated from ../scripts/sync-elements.ts

/** Every element factory exported by \`@implementjs/core/elements\`. */
export const ELEMENTS = [
${list(elements)}
] as const;

/** \`VoidHTMLElement\` in core's props.ts — \`ElementChildArgs\` is \`[]\` for these. */
export const VOID_ELEMENTS: ReadonlySet<string> = new Set([
${list(voidElements)}
]);
`;
}

// Only when run directly; the drift test imports the same functions.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const elements = readElements();
	writeFileSync(join(here, "../src/elements.ts"), render(elements, readVoidElements()));
	console.log(`synced ${elements.length} elements from @implementjs/core`);
}
