/**
 * Hydration: adopting server-rendered DOM instead of recreating it.
 *
 * The server ran the exact same mount + `syncDomOrder` code, so the serialized
 * markup is already in the final arrangement a fresh client mount converges
 * to. Hydration therefore replays the normal mount choreography unchanged —
 * helpers keep appending fresh anchor comments and running their sync passes —
 * while element and text creation goes through a claim cursor that adopts the
 * next matching serialized node instead of building a new one. The server's
 * own anchor comments are never claimed; whatever a pass leaves unclaimed is
 * swept when it ends.
 *
 * Any structural mismatch (the claimed node is not what the code creates,
 * which means client state diverged from the server render) marks the whole
 * pass failed. Creation falls back to building fresh nodes mid-pass and
 * `App.render` discards everything and remounts from scratch, so a mismatch
 * degrades to exactly the tier-1 behavior.
 */

type ParentState = {
	/** Next serialized node this parent may hand out. */
	cursor: Node | null;
	/** The parent's children before any claiming, for the leftover sweep. */
	preexisting: Set<Node>;
};

type HydrationState = {
	root: Element;
	parents: Map<Node, ParentState>;
	claimed: Set<Node>;
	/** The element the current `mount(parent)` call is mounting into. */
	currentParent: Node | null;
	failed: boolean;
};

let state: HydrationState | null = null;

export function beginHydration(root: Element): void {
	state = {
		root,
		parents: new Map(),
		claimed: new Set(),
		currentParent: null,
		failed: false,
	};
}

/**
 * Ends the pass. On success, sweeps every serialized node that was never
 * claimed (the server's anchor comments, plus any subtree the client render
 * legitimately no longer produces). Returns false when the pass failed and
 * the caller must discard the server markup and mount fresh.
 */
export function endHydration(): boolean {
	const current = state;
	state = null;
	if (!current) return true;
	if (current.failed) return false;
	for (const { preexisting } of current.parents.values()) {
		for (const node of preexisting) {
			if (!current.claimed.has(node)) (node as ChildNode).remove();
		}
	}
	return true;
}

export function isHydrating(): boolean {
	return state !== null && !state.failed;
}

/** A structural mismatch: fall back to fresh creation for the rest of the pass. */
function fail(): null {
	if (state) state.failed = true;
	return null;
}

/** Track the element a mount call is inserting into, so claims know their parent. */
export function withMountParent<T>(parent: HTMLElement, fn: () => T): T {
	if (!state) return fn();
	const previous = state.currentParent;
	state.currentParent = parent;
	try {
		return fn();
	} finally {
		if (state) state.currentParent = previous;
	}
}

/** Claimable parents: the hydration root and any element claimed this pass. */
function parentStateFor(parent: Node | null): ParentState | null {
	if (!state || state.failed || !parent) return null;
	if (parent !== state.root && !state.claimed.has(parent)) return null;
	let entry = state.parents.get(parent);
	if (!entry) {
		entry = { cursor: parent.firstChild, preexisting: new Set(parent.childNodes) };
		state.parents.set(parent, entry);
	}
	return entry;
}

function parentState(): ParentState | null {
	return parentStateFor(state?.currentParent ?? null);
}

/**
 * Position a freshly created node (a helper's anchor comment) during
 * hydration. Fresh mounting appends anchors and lets `syncDomOrder` pull
 * content into place, but during hydration an anchor appended at the end
 * would sit beyond later siblings' still-unclaimed nodes and the sync pass
 * would drag content past them. Inserting at the cursor — the exact spot the
 * replay has reached — keeps every subsequent sync convergent with the
 * arrangement a fresh mount produces. Returns false when not hydrating (the
 * caller appends normally).
 */
export function attachAtCursor(parent: HTMLElement, node: Node): boolean {
	const entry = parentStateFor(parent);
	if (!entry) return false;
	entry.cursor ? parent.insertBefore(node, entry.cursor) : parent.appendChild(node);
	return true;
}

/**
 * Serialized anchor comments belong to helpers that always create fresh ones,
 * so claims for content nodes step over them (the sweep removes them later).
 */
function skipComments(entry: ParentState): void {
	while (entry.cursor && entry.cursor.nodeType === 8) {
		entry.cursor = entry.cursor.nextSibling;
	}
}

export function claimElement(tag: string): HTMLElement | null {
	const entry = parentState();
	if (!entry) return null;
	skipComments(entry);
	const node = entry.cursor;
	if (!(node instanceof Element) || node.localName !== tag) return fail();
	entry.cursor = node.nextSibling;
	state!.claimed.add(node);
	return node as HTMLElement;
}

export function claimSvgRoot(): SVGSVGElement | null {
	const entry = parentState();
	if (!entry) return null;
	skipComments(entry);
	const node = entry.cursor;
	if (!(node instanceof Element) || node.localName !== "svg") return fail();
	entry.cursor = node.nextSibling;
	state!.claimed.add(node);
	return node as SVGSVGElement;
}

/**
 * Claims an anchor comment with matching data. Only for anchors whose position
 * is load-bearing (Svg): structural helpers' end markers are position-corrected
 * by `syncDomOrder` and are recreated fresh instead.
 */
export function claimComment(data: string): Comment | null {
	const entry = parentState();
	if (!entry) return null;
	while (entry.cursor && entry.cursor.nodeType === 8 && entry.cursor.nodeValue !== data) {
		entry.cursor = entry.cursor.nextSibling;
	}
	const node = entry.cursor;
	if (!node || node.nodeType !== 8) return fail();
	entry.cursor = node.nextSibling;
	state!.claimed.add(node);
	return node as Comment;
}

export function claimText(data: string): Text | null {
	const entry = parentState();
	if (!entry) return null;
	skipComments(entry);
	// the serializer emits nothing for empty text, so recreate it in place
	if (data === "") {
		const node = state!.root.ownerDocument.createTextNode("");
		entry.cursor
			? entry.cursor.parentNode!.insertBefore(node, entry.cursor)
			: state!.currentParent!.appendChild(node);
		state!.claimed.add(node);
		return node;
	}
	const node = entry.cursor;
	if (!(node instanceof Text)) return fail();
	if (node.data === data) {
		entry.cursor = node.nextSibling;
		state!.claimed.add(node);
		return node;
	}
	// adjacent text mountables serialize merged; carve this one's piece off
	if (node.data.startsWith(data)) {
		const tail = node.splitText(data.length);
		entry.preexisting.add(tail);
		entry.cursor = tail;
		state!.claimed.add(node);
		return node;
	}
	return fail();
}

/** True when `node` was adopted this pass and is already in position. */
export function wasClaimed(node: Node): boolean {
	return state !== null && state.claimed.has(node);
}

export type HtmlBlock = {
	/** Where the helper's own start comment belongs (first content node, or the end position). */
	before: Node | null;
	/** Where the helper's own end comment belongs (the node after the block). */
	after: Node | null;
};

/**
 * Claims an `Html` block: the span the server serialized between its
 * `<!--html-->` / `<!--/html-->` delimiters. Content is adopted as-is — the
 * markup is trusted and deterministic, so it is not re-parsed or compared.
 */
export function claimHtmlBlock(): HtmlBlock | null {
	const entry = parentState();
	if (!entry) return null;
	// step over other helpers' anchors, but stop at content — an Html mount
	// whose cursor is not at an html delimiter is a structural mismatch
	while (entry.cursor && entry.cursor.nodeType === 8 && entry.cursor.nodeValue !== "html") {
		entry.cursor = entry.cursor.nextSibling;
	}
	const start = entry.cursor;
	if (!start || start.nodeType !== 8) return fail();
	let node = start.nextSibling;
	const first = node && !(node.nodeType === 8 && node.nodeValue === "/html") ? node : null;
	while (node && !(node.nodeType === 8 && node.nodeValue === "/html")) {
		state!.claimed.add(node);
		node = node.nextSibling;
	}
	if (!node) return fail();
	const after = node.nextSibling;
	entry.cursor = after;
	return { before: first ?? after, after };
}
