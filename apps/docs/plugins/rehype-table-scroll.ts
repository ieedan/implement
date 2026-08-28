/**
 * Minimal structural view of a hast node — enough to walk the tree and splice
 * a wrapper in. Velite bundles its own unified types, so importing hast's here
 * would only be a second set that does not match.
 */
export type HastNode = {
	type: string;
	tagName?: string;
	properties?: Record<string, unknown>;
	children?: HastNode[];
};

/** The class `typeset.css` gives a block that scrolls sideways on its own. */
const SCROLL_CLASS = "typeset-scroll";

function wrap(table: HastNode): HastNode {
	return {
		type: "element",
		tagName: "div",
		// tabindex: a region that scrolls has to be reachable by keyboard, and
		// the table's own cells are not focusable.
		properties: { className: [SCROLL_CLASS], tabIndex: 0 },
		children: [table],
	};
}

function wrapTables(node: HastNode): void {
	const children = node.children;
	if (children == null) return;
	for (const [index, child] of children.entries()) {
		if (child.type !== "element") continue;
		if (child.tagName === "table") {
			// markdown tables never nest, so there is nothing to recurse into
			children[index] = wrap(child);
			continue;
		}
		wrapTables(child);
	}
}

/**
 * Puts every markdown table in a horizontally scrollable wrapper.
 *
 * A table cannot narrow past its own min-content width — a cell holding
 * `Readable<"connecting" | "open" | "closed">` has a floor no `max-width` can
 * argue with — so on a phone a wide table overflows, and with nothing between
 * it and the page the whole document scrolls sideways: the header slides off
 * and the prose beside the table goes with it. The wrapper takes that scroll,
 * and the table keeps wrapping to fit whenever it can.
 *
 * Build time rather than on mount, so the prerendered HTML already has it and
 * the page does not reflow once the client picks it up.
 */
export function rehypeTableScroll() {
	return (tree: HastNode) => {
		wrapTables(tree);
	};
}
