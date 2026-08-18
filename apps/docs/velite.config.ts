import rehypeShiki from "@shikijs/rehype";
import { remarkAlert } from "remark-github-blockquote-alert";
import { defineCollection, defineConfig, s } from "velite";

const markdown = s.object({
	title: s.string().max(99),
	description: s.string().max(999),
	slug: s.path(),
	content: s.markdown(),
});

function stripOrderPrefixes(path: string): string {
	return path
		.split("/")
		.map((segment) => segment.replace(/^\d+_/, ""))
		.join("/");
}

function toPermalink(fileSlug: string, prefix: string, folder?: string) {
	let slug = fileSlug;
	if (folder != null) {
		if (slug === folder) slug = "index";
		else if (slug.startsWith(`${folder}/`)) slug = slug.slice(folder.length + 1);
	}
	slug = slug === "index" ? "" : slug.replace(/\/index$/, "");
	slug = stripOrderPrefixes(slug);
	return {
		slug,
		permalink: slug === "" ? prefix : `${prefix}/${slug}`,
	};
}

function toLessonDir(fileSlug: string): string {
	let dir = fileSlug.startsWith("lessons/") ? fileSlug.slice("lessons/".length) : fileSlug;
	if (dir === "index") return "";
	return dir.replace(/\/index$/, "");
}

const pages = defineCollection({
	name: "Page",
	// Positive glob only: Velite concatenates every collection pattern in watch
	// mode, so `!lessons/**` here would skip tutorial rebuilds too.
	pattern: "*.md",
	schema: markdown
		.extend({
			section: s.string().max(99),
			order: s.number().optional(),
		})
		.transform((data) => ({
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
			lessonDir: toLessonDir(data.slug),
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
		remarkPlugins: [
			// Velite bundles its own unified types, which don't match remark/rehype plugins'.
			// @ts-expect-error
			remarkAlert,
		],
		rehypePlugins: [
			[
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
		data.tutorials.sort((a, b) =>
			a.lessonDir.localeCompare(b.lessonDir, undefined, { numeric: true }),
		);
	},
});
