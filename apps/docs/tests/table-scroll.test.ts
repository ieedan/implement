import { expect, it } from "vitest";
import { rehypeTableScroll, type HastNode } from "../plugins/rehype-table-scroll";
import { kitPages } from "../src/lib/content";

function element(tagName: string, ...children: HastNode[]): HastNode {
	return { type: "element", tagName, children };
}

it("wraps a table in a scroller, wherever it sits", () => {
	const tree = element(
		"root",
		element("p"),
		element("table"),
		element("blockquote", element("table")),
	);
	rehypeTableScroll()(tree);

	const [paragraph, wrapper, blockquote] = tree.children ?? [];
	expect(paragraph?.tagName).toBe("p");
	expect(wrapper?.tagName).toBe("div");
	expect(wrapper?.properties).toEqual({ className: ["typeset-scroll"], tabIndex: 0 });
	expect(wrapper?.children?.[0]?.tagName).toBe("table");
	// a nested table is wrapped where it is, not lifted out of the quote
	expect(blockquote?.children?.[0]?.tagName).toBe("div");
});

/**
 * The bug this is here for: a table cannot narrow past its own min-content
 * width, so on a phone an unwrapped one takes the whole page sideways with it
 * — the header slides off and the prose beside it goes too.
 */
it("leaves no table in the rendered docs without one", () => {
	const websockets = kitPages.find((page) => page.slug === "websockets");

	expect(websockets?.content).toContain('<div class="typeset-scroll" tabindex="0"><table>');
	for (const page of kitPages) {
		const tables = page.content.match(/<table/g)?.length ?? 0;
		const wrapped = page.content.match(/class="typeset-scroll"[^>]*><table/g)?.length ?? 0;
		expect(wrapped, `${page.permalink} has an unwrapped table`).toBe(tables);
	}
});
