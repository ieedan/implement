import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import rehypeShiki from "@shikijs/rehype";
import { context, defineCollection, defineConfig, s } from "velite";

const markdown = s.object({
	title: s.string().max(99),
	description: s.string().max(999),
	order: s.number().optional(),
	slug: s.path(),
	content: s.markdown(),
});

function toPermalink(fileSlug: string, prefix: string, folder?: string) {
	let slug = fileSlug;
	if (folder != null) {
		if (slug === folder) slug = "index";
		else if (slug.startsWith(`${folder}/`)) slug = slug.slice(folder.length + 1);
	}
	slug = slug === "index" ? "" : slug.replace(/\/index$/, "");
	return {
		slug,
		permalink: slug === "" ? prefix : `${prefix}/${slug}`,
	};
}

function readSibling(filename: string): string {
	const filePath = context().file.path;
	try {
		return readFileSync(join(dirname(filePath), filename), "utf8");
	} catch {
		throw new Error(`Missing ${filename} next to ${filePath}`);
	}
}

const pages = defineCollection({
	name: "Page",
	pattern: ["**/*.md", "!lessons/**"],
	schema: markdown.transform((data) => ({
		...data,
		...toPermalink(data.slug, "/docs"),
	})),
});

const tutorials = defineCollection({
	name: "Tutorial",
	pattern: "lessons/**/*.md",
	schema: markdown
		.extend({
			section: s.string().max(99),
		})
		.transform((data) => ({
			...data,
			code: readSibling("code.ts"),
			solution: readSibling("solution.ts"),
			...toPermalink(data.slug, "/tutorial", "lessons"),
		})),
});

export default defineConfig({
	root: "src/content",
	strict: true,
	output: {
		data: ".velite",
		// Vite copies public/ into dist on build (dist itself is wiped by every build).
		assets: "public/static",
		base: "/static/",
		clean: true,
	},
	collections: { pages, tutorials },
	markdown: {
		rehypePlugins: [
			[
				// Velite bundles its own unified types, which don't match @shikijs/rehype's.
				// @ts-expect-error
				rehypeShiki,
				{
					theme: "github-dark",
					langs: ["typescript", "ts", "tsx", "javascript", "js", "jsx"],
				},
			],
		],
	},
	prepare(data) {
		data.pages.sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));
		data.tutorials.sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));
	},
});
