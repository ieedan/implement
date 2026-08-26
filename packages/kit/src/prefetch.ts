/**
 * Preloading links before they are followed.
 *
 * A navigation already resolves everything the destination needs before it
 * commits — the route's chunks and its `__data.json` (see `./runtime.ts`) —
 * so the click pays for a round trip the reader watches. The pointer arriving
 * over a link is the earliest honest signal that the click is coming, and it
 * arrives a few hundred milliseconds ahead of it. Spending that window on the
 * fetches is what makes the navigation land instantly.
 *
 * The behaviour is declared in markup, not wired per link: an element carries
 * `data-implement-preload-data` or `data-implement-preload-code`, and every
 * link beneath it inherits the setting from the nearest ancestor that sets
 * one. So an app turns it on for the whole document and off for the handful
 * of links where it is wrong (an expensive report, a `?logout` link) without
 * touching either of them individually.
 *
 * One delegated listener per event serves the whole document rather than a
 * listener per anchor, which is what makes this cost nothing on a page of a
 * thousand links — and what makes it work for links that were not in the DOM
 * when it was installed.
 *
 * What the default applies to is narrower than "every link", and deliberately.
 * This framework routes the router's own `Link` and nothing else: a plain
 * `<a href="/x">` is a full document load, and a chunk or a payload warmed for
 * one is thrown away the moment it is followed. So the inherited default
 * reaches links carrying {@link ROUTED_LINK_ATTRIBUTE}, and any other link has
 * to be asked for by name — which is what an app that routes its own clicks
 * does with the attribute.
 */

import { ROUTED_LINK_ATTRIBUTE } from "@implementjs/router";
import { normalizeRoutePath } from "./match.ts";
import {
	PRELOAD_CODE_ATTRIBUTE,
	PRELOAD_DATA_ATTRIBUTE,
	type PreloadCodeKind,
	type PreloadDataKind,
	type PreloadOptions,
} from "./preload-kinds.ts";
import { preloadCode, preloadData } from "./runtime.ts";

export {
	PRELOAD_CODE_ATTRIBUTE,
	PRELOAD_DATA_ATTRIBUTE,
	type PreloadCodeKind,
	type PreloadDataKind,
	type PreloadOptions,
} from "./preload-kinds.ts";

const DATA_KINDS = new Set<string>(["hover", "tap", "off"]);
const CODE_KINDS = new Set<string>(["eager", "viewport", "hover", "tap", "off"]);

/**
 * What `anchor` was *told* to do, or `null` when nothing told it anything: the
 * nearest ancestor that declares the attribute wins, which is what makes a
 * document-wide setting overridable per subtree and per link. An unrecognized
 * value counts as nothing declared rather than throwing — a typo in an
 * attribute should cost the speedup, not the page.
 */
function declaredSetting(
	anchor: Element,
	attribute: string,
	kinds: ReadonlySet<string>,
): string | null {
	const source = anchor.closest(`[${attribute}]`);
	const value = source?.getAttribute(attribute);
	if (value === null || value === undefined || !kinds.has(value)) return null;
	return value;
}

/**
 * The setting governing `anchor`: what it was told, falling back to the app's
 * default only for a link the router follows itself.
 *
 * A plain `<a>` is a full document load in this framework, so warming its
 * route is work the click throws away. Naming the attribute is how an app that
 * routes such a link some other way says so, and it is honoured for any link —
 * only the *unasked-for* default is narrowed.
 */
function settingFor<K extends string>(
	anchor: Element,
	attribute: string,
	kinds: ReadonlySet<string>,
	fallback: K,
	whenUnrouted: K,
): K {
	const declared = declaredSetting(anchor, attribute, kinds);
	// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Checked against the kind set it came from.
	if (declared !== null) return declared as K;
	return anchor.hasAttribute(ROUTED_LINK_ATTRIBUTE) ? fallback : whenUnrouted;
}

/**
 * Whether the reader has asked their browser to use less data. An automatic
 * preload is a guess spending bandwidth on the reader's behalf, which is
 * exactly what the preference is about — so the speculative paths check it.
 * An explicit `preloadData()` call is the app's own decision and does not.
 */
function savingData(): boolean {
	// not in lib.dom, and absent outside Chromium
	// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Optional, non-standard API read defensively.
	const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
	return connection?.saveData === true;
}

/**
 * The path a preload for `anchor` would warm, or `null` when there is nothing
 * to warm: a link the browser handles itself (a download, a new tab, another
 * origin, a `mailto:`), or one pointing at the page already on screen.
 *
 * `href` is read off the property rather than the attribute so it is already
 * resolved against the document — a relative link is the common case, and
 * comparing it to the current path is the whole point.
 */
function preloadTarget(anchor: HTMLAnchorElement): string | null {
	if (anchor.hasAttribute("download")) return null;
	const target = anchor.target;
	if (target !== "" && target !== "_self") return null;
	// the same opt-out `rel="external"` gives a router: the app is not what
	// serves this, whatever the origin says
	if (anchor.rel.toLowerCase().split(/\s+/).includes("external")) return null;
	// an `<a name>` with no href, or a bare fragment on this page
	const href = anchor.getAttribute("href");
	if (href === null || href === "" || href.startsWith("#")) return null;
	let url: URL;
	try {
		url = new URL(anchor.href, window.location.href);
	} catch {
		return null;
	}
	if (url.origin !== window.location.origin) return null;
	const path = normalizeRoutePath(url.pathname);
	// nothing to warm for where the reader already is
	if (path === normalizeRoutePath(window.location.pathname)) return null;
	return path;
}

/**
 * A preload is a guess, and a guess that fails costs the app nothing: the
 * navigation runs the same fetches itself and falls back to a document load if
 * they fail again. Reporting it here would put a console error behind every
 * pointer that crossed a link on a flaky connection.
 */
function ignore(): void {}

/** The link an event landed on, from whatever it landed on inside it. */
function anchorFrom(target: EventTarget | null): HTMLAnchorElement | null {
	return target instanceof Element ? target.closest("a") : null;
}

/** Warm `anchor` for `kind`, if `kind` is one the event that fired is for. */
function warm(anchor: HTMLAnchorElement, defaults: Required<PreloadOptions>, on: "hover" | "tap") {
	if (savingData()) return;
	const path = preloadTarget(anchor);
	if (path === null) return;
	const data = settingFor<PreloadDataKind>(
		anchor,
		PRELOAD_DATA_ATTRIBUTE,
		DATA_KINDS,
		defaults.data,
		"off",
	);
	// data implies code: `preloadData` loads the route's chunks too, so a link
	// set to both on the same trigger makes one pass, not two
	if (data === on) {
		preloadData(path).catch(ignore);
		return;
	}
	const code = settingFor<PreloadCodeKind>(
		anchor,
		PRELOAD_CODE_ATTRIBUTE,
		CODE_KINDS,
		defaults.code,
		"off",
	);
	if (code === on) preloadCode(path).catch(ignore);
}

/**
 * Installs the link-preloading behaviour, and returns the teardown for it.
 *
 * Called by the generated client entry with the plugin's `preload` option, so
 * an app configures this in `vite.config.ts` rather than here. Safe to call
 * where there is no document (it does nothing), and safe to call twice — the
 * second install simply replaces the first once the first is torn down.
 */
export function initPreloading(options: PreloadOptions = {}): () => void {
	if (typeof document === "undefined") return ignore;
	const defaults: Required<PreloadOptions> = {
		data: options.data ?? "hover",
		code: options.code ?? "hover",
	};

	/**
	 * The last anchor a hover fired for. Moving the pointer across a link's
	 * children re-fires `pointerover` for each of them, and while a repeat
	 * preload is already cheap — the module handles and the data cache both
	 * join what is in flight — this keeps the common case to one `closest`
	 * walk per link rather than one per element crossed.
	 */
	let hovered: HTMLAnchorElement | null = null;

	const onHover = (event: Event) => {
		const anchor = anchorFrom(event.target);
		if (anchor === null) {
			hovered = null;
			return;
		}
		if (anchor === hovered) return;
		hovered = anchor;
		warm(anchor, defaults, "hover");
	};

	const onTap = (event: Event) => {
		const anchor = anchorFrom(event.target);
		if (anchor !== null) warm(anchor, defaults, "tap");
	};

	// `pointerover` rather than `pointerenter`, which does not bubble and so
	// cannot be delegated. On a touch device it fires just before
	// `pointerdown`, which is what makes `"hover"` degrade to `"tap"` there
	// rather than to nothing.
	document.addEventListener("pointerover", onHover, { passive: true });
	// a link reached with the keyboard never sees a pointer, and the reader is
	// one Enter away
	document.addEventListener("focusin", onHover, { passive: true });
	// before `click`, so the chunk request overlaps the rest of the press
	document.addEventListener("pointerdown", onTap, { passive: true });

	const stopScanning = scanForCode(defaults.code);

	return () => {
		document.removeEventListener("pointerover", onHover);
		document.removeEventListener("focusin", onHover);
		document.removeEventListener("pointerdown", onTap);
		stopScanning();
	};
}

/**
 * The half of the behaviour no event drives: `"eager"` links warm as soon as
 * they exist, and `"viewport"` links when they scroll into view. Both need to
 * find anchors rather than wait for one, so this watches the document for
 * them — only the nodes an update actually added, so the cost tracks DOM churn
 * rather than document size.
 *
 * Data is deliberately not offered on these triggers. Code is immutable and
 * cached for the life of the page, so fetching a chunk early is only ever a
 * bandwidth question; a load result goes stale, and prefetching every one in
 * the viewport would be a way to serve the reader yesterday's data.
 */
function scanForCode(fallback: PreloadCodeKind): () => void {
	const observer =
		typeof IntersectionObserver === "undefined"
			? null
			: new IntersectionObserver((entries) => {
					for (const entry of entries) {
						if (!entry.isIntersecting) continue;
						// code loads once and stays loaded, so a link that has been
						// seen never needs watching again
						observer?.unobserve(entry.target);
						if (!(entry.target instanceof HTMLAnchorElement)) continue;
						const path = preloadTarget(entry.target);
						if (path !== null) preloadCode(path).catch(ignore);
					}
				});

	const consider = (anchor: HTMLAnchorElement) => {
		if (savingData()) return;
		const kind = settingFor<PreloadCodeKind>(
			anchor,
			PRELOAD_CODE_ATTRIBUTE,
			CODE_KINDS,
			fallback,
			"off",
		);
		if (kind !== "eager" && kind !== "viewport") return;
		const path = preloadTarget(anchor);
		if (path === null) return;
		if (kind === "eager") preloadCode(path).catch(ignore);
		// observing an element already observed is a no-op, so re-scanning a
		// subtree costs nothing
		else observer?.observe(anchor);
	};

	const scan = (root: ParentNode) => {
		for (const anchor of root.querySelectorAll("a")) consider(anchor);
	};

	scan(document);

	const mutations = new MutationObserver((records) => {
		for (const record of records) {
			for (const node of record.addedNodes) {
				if (!(node instanceof Element)) continue;
				// the added node itself may be the anchor, and `querySelectorAll`
				// only looks below it
				if (node instanceof HTMLAnchorElement) consider(node);
				scan(node);
			}
		}
	});
	mutations.observe(document.documentElement, { childList: true, subtree: true });

	return () => {
		mutations.disconnect();
		observer?.disconnect();
	};
}
