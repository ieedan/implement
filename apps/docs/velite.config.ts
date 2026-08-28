import rehypeShiki from "@shikijs/rehype";
import rehypeSlug from "rehype-slug";
import { remarkAlert } from "remark-github-blockquote-alert";
import { defineCollection, defineConfig, s } from "velite";
import { rehypeTableScroll } from "./plugins/rehype-table-scroll";

const markdown = s.object({
	title: s.string().max(99),
	description: s.string().max(999),
	slug: s.path(),
	content: s.markdown(),
	// Uses the same slugger as rehype-slug, so urls match the heading ids.
	toc: s.toc({ maxDepth: 3 }),
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

const primitives = defineCollection({
	name: "PrimitivePage",
	pattern: "primitives/*.md",
	schema: markdown
		.extend({
			section: s.string().max(99),
			order: s.number().optional(),
		})
		.transform((data) => ({
			...data,
			...toPermalink(data.slug, "/primitives/docs", "primitives"),
		})),
});

const ui = defineCollection({
	name: "UiPage",
	pattern: "ui/*.md",
	schema: markdown
		.extend({
			section: s.string().max(99),
			order: s.number().optional(),
		})
		.transform((data) => ({
			...data,
			...toPermalink(data.slug, "/ui", "ui"),
		})),
});

const kit = defineCollection({
	name: "KitPage",
	pattern: "kit/*.md",
	schema: markdown
		.extend({
			section: s.string().max(99),
			order: s.number().optional(),
		})
		.transform((data) => ({
			...data,
			...toPermalink(data.slug, "/kit", "kit"),
		})),
});

const create = defineCollection({
	name: "CreatePage",
	pattern: "create/*.md",
	schema: markdown
		.extend({
			section: s.string().max(99),
			order: s.number().optional(),
		})
		.transform((data) => ({
			...data,
			...toPermalink(data.slug, "/create", "create"),
		})),
});

const lucide = defineCollection({
	name: "LucidePage",
	pattern: "lucide/*.md",
	schema: markdown
		.extend({
			section: s.string().max(99),
			order: s.number().optional(),
		})
		.transform((data) => ({
			...data,
			...toPermalink(data.slug, "/lucide", "lucide"),
		})),
});

const modeWatcher = defineCollection({
	name: "ModeWatcherPage",
	pattern: "mode-watcher/*.md",
	schema: markdown
		.extend({
			section: s.string().max(99),
			order: s.number().optional(),
		})
		.transform((data) => ({
			...data,
			...toPermalink(data.slug, "/mode-watcher", "mode-watcher"),
		})),
});

const formish = defineCollection({
	name: "FormishPage",
	pattern: "formish/*.md",
	schema: markdown
		.extend({
			section: s.string().max(99),
			order: s.number().optional(),
		})
		.transform((data) => ({
			...data,
			...toPermalink(data.slug, "/formish", "formish"),
		})),
});

const eslint = defineCollection({
	name: "EslintPage",
	pattern: "eslint/*.md",
	schema: markdown
		.extend({
			section: s.string().max(99),
			order: s.number().optional(),
		})
		.transform((data) => ({
			...data,
			...toPermalink(data.slug, "/eslint", "eslint"),
		})),
});

const tutorials = defineCollection({
	name: "Tutorial",
	pattern: "lessons/**/*.md",
	schema: markdown
		.extend({
			section: s.string().max(99),
			/** File open in the editor when the lesson loads (multi-file lessons). */
			focus: s.string().optional(),
		})
		.transform((data) => {
			const lessonDir = toLessonDir(data.slug);
			return {
				...data,
				lessonDir,
				// Top-level lesson directory ("implement", "kit") the lesson belongs to.
				part: stripOrderPrefixes(lessonDir).split("/")[0] ?? "",
				...toPermalink(data.slug, "/tutorial", "lessons"),
			};
		}),
});

export default defineConfig({
	root: "src/content",
	strict: true,
	output: {
		data: ".velite",
		// Vite copies static/ into dist on build (dist itself is wiped by every
		// build). Velite owns static/velite — clean: true wipes it every run,
		// so hand-placed files belong directly in static/ instead.
		assets: "static/velite",
		base: "/velite/",
		clean: true,
	},
	collections: {
		pages,
		tutorials,
		primitives,
		ui,
		lucide,
		kit,
		create,
		formish,
		modeWatcher,
		eslint,
	},
	markdown: {
		remarkPlugins: [
			// Velite bundles its own unified types, which don't match remark/rehype plugins'.
			// @ts-expect-error
			remarkAlert,
		],
		rehypePlugins: [
			rehypeSlug,
			rehypeTableScroll,
			[
				// @ts-expect-error
				rehypeShiki,
				{
					// both themes at build time; app.css picks one per mode
					themes: { light: "github-light", dark: "github-dark" },
					defaultColor: false,
					langs: [
						"typescript",
						"ts",
						"tsx",
						"javascript",
						"js",
						"jsx",
						"json",
						"jsonc",
						"html",
						"sh",
					],
				},
			],
		],
	},
	prepare(data) {
		data.pages.sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));
		const primitiveSectionOrder: Record<string, number> = {
			"Start Here": 0,
			Components: 1,
			Utils: 2,
		};
		data.primitives.sort((a, b) => {
			const bySection =
				(primitiveSectionOrder[a.section] ?? 99) - (primitiveSectionOrder[b.section] ?? 99);
			if (bySection !== 0) return bySection;
			const byOrder = (a.order ?? Infinity) - (b.order ?? Infinity);
			if (byOrder !== 0) return byOrder;
			return a.title.localeCompare(b.title);
		});
		data.ui.sort((a, b) => {
			const byOrder = (a.order ?? Infinity) - (b.order ?? Infinity);
			if (byOrder !== 0) return byOrder;
			return a.title.localeCompare(b.title);
		});
		data.lucide.sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));
		data.kit.sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));
		data.create.sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));
		data.formish.sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));
		data.modeWatcher.sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));
		data.eslint.sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));
		data.tutorials.sort((a, b) =>
			a.lessonDir.localeCompare(b.lessonDir, undefined, { numeric: true }),
		);
	},
});
