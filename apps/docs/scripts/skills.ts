import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SITE_ORIGIN } from "../src/lib/site.ts";

/**
 * Regenerates the page index inside each agent skill from the docs collections.
 *
 * The skills ship into projects built with implement, where there is no docs
 * checkout to read — so they link out to the published `.md` twins instead of
 * carrying their own copy of the prose. That trades one staleness problem for
 * a smaller one: the prose can no longer drift, but the *list* still can, when
 * a page is added or renamed here. So the list is generated, committed, and
 * checked for drift in CI, exactly like `registry.json`.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const docs = path.join(here, "..");
const root = path.join(docs, "..", "..");

const START = "<!-- pages:start -->";
const END = "<!-- pages:end -->";

type Page = { title: string; description: string; section: string; permalink: string };

function isPage(value: unknown): value is Page {
	if (value == null || typeof value !== "object") return false;
	// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- object checked above, fields checked below.
	const { title, description, section, permalink } = value as Record<string, unknown>;
	return [title, description, section, permalink].every((field) => typeof field === "string");
}

function collection(name: string): Page[] {
	const file = path.join(docs, ".velite", `${name}.json`);
	if (!fs.existsSync(file)) {
		throw new Error(`${file} is missing — run \`pnpm generate\` first.`);
	}
	const raw: unknown = JSON.parse(fs.readFileSync(file, "utf8"));
	if (!Array.isArray(raw) || !raw.every(isPage)) {
		throw new Error(`${file} is not a list of docs pages — is velite's output stale?`);
	}
	return raw;
}

function page(name: string, permalink: string): Page {
	const match = collection(name).find((entry) => entry.permalink === permalink);
	if (match === undefined) {
		throw new Error(`no page ${permalink} in collection ${name}`);
	}
	return match;
}

/** The pages grouped under their section headings, in the order the sidebar shows them. */
function index(pages: Page[]): string {
	const sections = new Map<string, Page[]>();
	for (const page of pages) {
		const group = sections.get(page.section);
		if (group === undefined) sections.set(page.section, [page]);
		else group.push(page);
	}

	return [...sections]
		.map(([section, group]) => {
			const links = group.map(
				(entry) => `- [${entry.title}](${SITE_ORIGIN}${entry.permalink}.md) — ${entry.description}`,
			);
			return [`### ${section}`, "", ...links].join("\n");
		})
		.join("\n\n");
}

type PackageLink = {
	name: string;
	collection: string;
	permalink: string;
	/** When set, used instead of the docs page's description. */
	description?: string;
};

type PackageGroup = {
	title: string;
	packages: PackageLink[];
};

/**
 * One link per package, pointing at that package's published intro (or the
 * page that covers it, for packages that share a collection).
 */
const catalog: PackageGroup[] = [
	{
		title: "Framework",
		packages: [
			{ name: "@implementjs/core", collection: "pages", permalink: "/docs" },
			{ name: "@implementjs/router", collection: "pages", permalink: "/docs/router" },
			{ name: "@implementjs/kit", collection: "kit", permalink: "/kit" },
			{ name: "@implementjs/vite", collection: "pages", permalink: "/docs/vite" },
		],
	},
	{
		title: "Components",
		packages: [
			{ name: "@implementjs/primitives", collection: "primitives", permalink: "/primitives/docs" },
			{ name: "@implementjs/ui", collection: "ui", permalink: "/ui" },
		],
	},
	{
		title: "Forms",
		packages: [{ name: "@implementjs/formish", collection: "formish", permalink: "/formish" }],
	},
	{
		title: "Theming",
		packages: [
			{
				name: "@implementjs/mode-watcher",
				collection: "modeWatcher",
				permalink: "/mode-watcher",
			},
		],
	},
	{
		title: "Icons",
		packages: [{ name: "@implementjs/lucide", collection: "lucide", permalink: "/lucide" }],
	},
	{
		title: "Tooling",
		packages: [
			{ name: "create-implement-app", collection: "create", permalink: "/create" },
			{ name: "@implementjs/eslint", collection: "eslint", permalink: "/eslint" },
		],
	},
	{
		title: "Adapters",
		packages: [
			{
				name: "@implementjs/adapter-static",
				collection: "kit",
				permalink: "/kit/adapters",
				description: "Builds an implement kit app into static files for any static host.",
			},
			{
				name: "@implementjs/adapter-node",
				collection: "kit",
				permalink: "/kit/adapters",
				description: "Builds an implement kit app into a standalone Node server.",
			},
			{
				name: "@implementjs/adapter-vercel",
				collection: "kit",
				permalink: "/kit/adapters",
				description: "Builds an implement kit app for Vercel, through the Build Output API.",
			},
			{
				name: "@implementjs/adapter-cloudflare",
				collection: "kit",
				permalink: "/kit/adapters",
				description:
					"Builds an implement kit app into a Cloudflare worker with static assets beside it.",
			},
			{
				name: "@implementjs/adapter-iis",
				collection: "kit",
				permalink: "/kit/adapters",
				description: "Builds an implement kit app for IIS on Windows Server.",
			},
		],
	},
];

function packageIndex(groups: PackageGroup[]): string {
	return groups
		.map((group) => {
			const links = group.packages.map((entry) => {
				const docs = page(entry.collection, entry.permalink);
				const description = entry.description ?? docs.description;
				return `- [${entry.name}](${SITE_ORIGIN}${docs.permalink}.md) — ${description}`;
			});
			return [`### ${group.title}`, "", ...links].join("\n");
		})
		.join("\n\n");
}

function write(skill: string, body: string): void {
	const file = path.join(root, ".agents", "skills", skill, "SKILL.md");
	const source = fs.readFileSync(file, "utf8");
	const start = source.indexOf(START);
	const end = source.indexOf(END);
	if (start === -1 || end === -1) {
		throw new Error(`${file} is missing its ${START} / ${END} markers.`);
	}

	const next = `${source.slice(0, start + START.length)}\n\n${body}\n\n${source.slice(end)}`;
	if (next === source) return;
	fs.writeFileSync(file, next);
	console.log(`updated .agents/skills/${skill}/SKILL.md`);
}

write("implementjs", index(collection("pages")));
write("implementjs-kit", index(collection("kit")));
write("implement-packages", packageIndex(catalog));
