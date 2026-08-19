import fs from "node:fs";
import path from "node:path";

// Regenerates src/icons/* and src/index.ts from the SVG files shipped by
// lucide-static. Each icon becomes its own module exporting the component
// under both its plain name (House) and its Icon-suffixed alias (HouseIcon),
// so bundlers only keep the icons an application imports.

const iconsDir = new URL(import.meta.resolve("lucide-static/package.json")).pathname.replace(
	/package\.json$/,
	"icons",
);
const outDir = new URL("../src/icons", import.meta.url).pathname;
const indexFile = new URL("../src/index.ts", import.meta.url).pathname;

// icon names that would shadow restricted globals when used as identifiers
const RESTRICTED_NAMES = new Set(["Infinity", "NaN", "undefined"]);

function toPascalCase(name: string): string {
	return name.replace(/(^|-)([a-z0-9])/g, (_, __, char: string) => char.toUpperCase());
}

function extractBody(svg: string): string {
	const match = svg.match(/<svg[^>]*>([\s\S]*)<\/svg>/);
	if (!match?.[1]) throw new Error("could not extract <svg> body");
	return match[1]
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean)
		.join("");
}

const files = fs
	.readdirSync(iconsDir)
	.filter((file) => file.endsWith(".svg"))
	.toSorted();

fs.mkdirSync(outDir, { recursive: true });

// leave up-to-date files untouched: a dev server watching src/ would otherwise
// see every icon "change" (fresh mtime, same bytes) and reload thousands of times
let written = 0;
function writeIfChanged(file: string, content: string): void {
	let existing: string | undefined;
	try {
		existing = fs.readFileSync(file, "utf-8");
	} catch {}
	if (existing === content) return;
	fs.writeFileSync(file, content);
	written++;
}

const indexLines: string[] = [
	"// generated from ../scripts/generate-icons.ts",
	"",
	'export { createLucideIcon, type IconComponent, type SvgProps } from "./create-icon";',
	"",
];

// Alias pairs like arrow-down-0-1/arrow-down-01 collapse to one PascalCase
// name; keep the first (identical) glyph, since a colliding `export *` name
// would otherwise be silently dropped from the barrel. Differing bodies under
// one name would mean dropping a real icon, so that still fails loudly.
const generated = new Map<string, string>();
const expectedFiles = new Set<string>();
let skipped = 0;

for (const file of files) {
	const name = file.replace(/\.svg$/, "");
	const exportName = toPascalCase(name);
	if (!/^[A-Za-z][A-Za-z0-9]*$/.test(exportName)) {
		throw new Error(`icon "${name}" produced an invalid identifier "${exportName}"`);
	}
	const body = extractBody(fs.readFileSync(path.join(iconsDir, file), "utf-8"));
	if (/[`\\]|\$\{/.test(body)) {
		throw new Error(`icon "${name}" body cannot be embedded in a template literal`);
	}
	const existing = generated.get(exportName);
	if (existing !== undefined) {
		if (existing !== body) {
			throw new Error(`icons "${name}" and an earlier file both export "${exportName}"`);
		}
		skipped++;
		continue;
	}
	generated.set(exportName, body);
	const disable = RESTRICTED_NAMES.has(exportName)
		? "// oxlint-disable-next-line no-shadow-restricted-names\n"
		: "";

	// mirror oxfmt (printWidth 100): collapse the call when it fits on one
	// line, so regenerating over formatted output is a no-op
	const singleLine = `export const ${exportName} = /* @__PURE__ */ createLucideIcon("${name}", \`${body}\`);`;
	const declaration =
		singleLine.length <= 100
			? singleLine
			: `export const ${exportName} = /* @__PURE__ */ createLucideIcon(\n\t"${name}",\n\t\`${body}\`,\n);`;

	const content = `// generated from ../../scripts/generate-icons.ts

import { createLucideIcon } from "../create-icon";

/**
 * Lucide \`${name}\` icon.
 * @see https://lucide.dev/icons/${name}
 */
${disable}${declaration}

export { ${exportName} as ${exportName}Icon };
`;

	expectedFiles.add(`${name}.ts`);
	writeIfChanged(path.join(outDir, `${name}.ts`), content);
	indexLines.push(`export * from "./icons/${name}";`);
}

// remove modules whose icon no longer exists upstream
let removed = 0;
for (const file of fs.readdirSync(outDir)) {
	if (!expectedFiles.has(file)) {
		fs.rmSync(path.join(outDir, file));
		removed++;
	}
}

writeIfChanged(indexFile, `${indexLines.join("\n")}\n`);

console.log(
	`generated ${generated.size} icons (${written} written, ${removed} removed, ${skipped} duplicate aliases skipped)`,
);
