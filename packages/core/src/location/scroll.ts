/**
 * Scroll restoration.
 *
 * A browser cannot restore scroll for an app that renders its own pages: when
 * a `popstate` lands, the DOM is still the page being left, so whatever the
 * browser scrolls to is measured against the wrong document. The router takes
 * the job over instead (`history.scrollRestoration = "manual"`) and records a
 * position per history entry itself.
 *
 * Positions are keyed by entry rather than by URL — one URL visited twice in a
 * session is two entries with two positions. The key rides in `history.state`;
 * the positions live in `sessionStorage`, because `"manual"` also opts out of
 * the restore a browser does on reload, and that puts it back.
 */

type ScrollPosition = { x: number; y: number };

/** Where an entry's key rides in `history.state`, alongside anything else on it. */
const STATE_KEY = "implement:scroll";

const STORAGE_KEY = "implement:scroll-positions";

/** Back stacks deeper than this are not worth the storage. */
const MAX_POSITIONS = 50;

const positions = new Map<number, ScrollPosition>();

/** Keys are handed out in order; the counter survives reloads through storage. */
let nextKey = 0;

/** The entry the app is navigating to, and whose key `history.state` carries. */
let currentKey = 0;

/**
 * The entry whose page is on screen. It trails `currentKey` for as long as a
 * navigation resolver holds a commit open, and captures and restores both go
 * through it — so a second `popstate` arriving mid-flight records the scroll
 * against the page that is actually showing, not the one being navigated to.
 */
let committedKey = 0;

let installed = false;

let restoredInitial = false;

function readKey(state: unknown): number | null {
	if (typeof state !== "object" || state === null) return null;
	const key: unknown = Reflect.get(state, STATE_KEY);
	return typeof key === "number" ? key : null;
}

function readPosition(value: unknown): ScrollPosition | null {
	if (typeof value !== "object" || value === null) return null;
	const x: unknown = Reflect.get(value, "x");
	const y: unknown = Reflect.get(value, "y");
	return typeof x === "number" && typeof y === "number" ? { x, y } : null;
}

function record(key: number, position: ScrollPosition): void {
	// re-inserting keeps the map in least-recently-touched order, so the
	// entries dropped below are the ones furthest from where the user is
	positions.delete(key);
	positions.set(key, position);
	for (const oldest of positions.keys()) {
		if (positions.size <= MAX_POSITIONS) break;
		positions.delete(oldest);
	}
}

function persist(): void {
	try {
		sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ next: nextKey, entries: [...positions] }));
	} catch {
		// storage disabled, full, or partitioned away — restoration degrades to
		// what it does for any entry with no recorded position
	}
}

function restorePersisted(): void {
	let raw: string | null;
	try {
		raw = sessionStorage.getItem(STORAGE_KEY);
	} catch {
		return;
	}
	if (raw === null) return;
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return;
	}
	if (typeof parsed !== "object" || parsed === null) return;
	const next: unknown = Reflect.get(parsed, "next");
	if (typeof next === "number") nextKey = Math.max(nextKey, next);
	const entries: unknown = Reflect.get(parsed, "entries");
	if (!Array.isArray(entries)) return;
	for (const entry of entries) {
		if (!Array.isArray(entry)) continue;
		const key: unknown = entry[0];
		const position = readPosition(entry[1]);
		if (typeof key !== "number" || position === null) continue;
		record(key, position);
	}
}

/** Adopt `key` as the entry the app is on, keeping the counter ahead of it. */
function enterEntry(key: number): void {
	currentKey = key;
	if (nextKey <= key) nextKey = key + 1;
}

/**
 * Take scroll restoration over from the browser and key the entry the document
 * loaded on. Called once, when the shared browser location signal is created.
 */
export function installScrollRestoration(): void {
	if (installed) return;
	installed = true;
	if ("scrollRestoration" in history) history.scrollRestoration = "manual";
	restorePersisted();
	const existing = readKey(history.state);
	if (existing === null) {
		currentKey = nextKey++;
		history.replaceState(currentEntryState(), "");
	} else {
		enterEntry(existing);
	}
	committedKey = currentKey;
	// the position of the entry a tab is sitting on is only ever written on the
	// way out, and closing or reloading is a way out the router never sees
	window.addEventListener("pagehide", () => {
		captureScroll();
		persist();
	});
}

/** Record where the page is scrolled to, against the entry being left. */
export function captureScroll(): void {
	record(committedKey, { x: window.scrollX, y: window.scrollY });
	persist();
}

/** Mark the entry a navigation just committed to as the one now on screen. */
export function commitEntry(): void {
	committedKey = currentKey;
}

/**
 * History state for an entry `pushState` is about to create. A fresh entry
 * starts with nothing on it but its key, and holds no position until it is
 * left.
 */
export function newEntryState(): unknown {
	currentKey = nextKey++;
	positions.delete(currentKey);
	return { [STATE_KEY]: currentKey };
}

/** History state for the current entry, keeping its key and anything else on it. */
export function currentEntryState(): unknown {
	const existing: unknown = history.state;
	const base = typeof existing === "object" && existing !== null ? existing : {};
	return { ...base, [STATE_KEY]: currentKey };
}

/** Adopt the entry a `popstate` moved to, given its `history.state`. */
export function adoptPoppedEntry(state: unknown): void {
	const key = readKey(state);
	// an entry the router never keyed — pushed before it installed, or by
	// something else on the page — has no position to come back to
	enterEntry(key ?? nextKey);
}

/** Scroll to the position recorded for the entry on screen, or to the top. */
export function restoreScroll(): void {
	const position = positions.get(committedKey);
	window.scrollTo(position?.x ?? 0, position?.y ?? 0);
}

export function scrollToTop(): void {
	window.scrollTo(0, 0);
}

/**
 * Restore the position of the entry the document loaded on — a reload, or a
 * session the browser restored. Called after a router's first render, the
 * earliest point at which the page is tall enough to scroll through, and only
 * ever once.
 */
export function restoreInitialScroll(): void {
	if (!installed || restoredInitial) return;
	restoredInitial = true;
	const position = positions.get(committedKey);
	// nothing recorded means nothing to go back to; leave the page where the
	// browser put it rather than yanking it to the top
	if (position) window.scrollTo(position.x, position.y);
}
