import { expect, it } from "vitest";
import { eslintPages, kitPages, pages, uiPages } from "../src/lib/content";
import { markdownResponse } from "../src/lib/markdown";

/** The markdown body a `.md` route answers with. */
async function body(collection: typeof pages, folder: string, slug: string) {
	return await markdownResponse(collection, folder, slug).text();
}

it("points cross-references at the twin rather than the page", async () => {
	const lifecycle = await body(pages, "", "lifecycle");

	// the prerendered HTML is served straight off the CDN, so a reader that follows
	// `/docs/derived` gets the app shell instead of the markdown it asked for
	expect(lifecycle).toContain("(https://implementjs.dev/docs/derived.md)");
	expect(lifecycle).not.toContain("(/docs/derived)");
});

it("keeps the fragment on the far side of the extension", async () => {
	expect(await body(kitPages, "kit", "routing")).toContain(
		"(https://implementjs.dev/docs/router.md#params-are-signals)",
	);
});

it("leaves a target with no twin absolute and otherwise untouched", async () => {
	// `/primitives` is the library's landing page, not one of its docs
	expect(await body(pages, "", "")).toContain("(https://implementjs.dev/primitives)");
});

it("knows the ui pages have twins too", async () => {
	// `/ui/*` answers at `/ui/*.md`, so its links have to be rewritten like any other
	expect(await body(uiPages, "ui", "")).toContain("(https://implementjs.dev/ui/button.md)");
});

/**
 * Prose only. A `data-source` placeholder resolves to the component's own file,
 * and the links in its doc comments are code — they stay exactly as written.
 */
function prose(markdown: string): string {
	return markdown.replaceAll(/^```[\s\S]*?^```/gm, "");
}

it("leaves nothing site-relative behind", async () => {
	for (const [collection, folder] of [
		[pages, ""],
		[kitPages, "kit"],
		[uiPages, "ui"],
		[eslintPages, "eslint"],
	] as const) {
		for (const page of collection) {
			const markdown = await body(collection, folder, page.slug);
			expect(prose(markdown), page.permalink).not.toMatch(/\]\(\//);
		}
	}
});
