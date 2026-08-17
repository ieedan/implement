import rehypeShiki from "@shikijs/rehype";
import { defineCollection, defineConfig, s } from "velite";

const pages = defineCollection({
	name: "Page",
	pattern: "**/*.md",
	schema: s
		.object({
			title: s.string().max(99),
			description: s.string().max(999),
			order: s.number().optional(),
			slug: s.path(),
			content: s.markdown(),
		})
		.transform((data) => {
			const slug = data.slug === "index" ? "" : data.slug.replace(/\/index$/, "");
			return {
				...data,
				slug,
				permalink: slug === "" ? "/docs" : `/docs/${slug}`,
			};
		}),
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
	collections: { pages },
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
	},
});
