/** The DOM event a prop name binds to, and which phase it listens in. */
export type ResolvedEvent = { event: string; capture: boolean };

/**
 * Maps an event prop name onto the `addEventListener` call it stands for:
 * `onKeydown` → `keydown`, `onKeydownCapture` → `keydown` in the capture phase.
 * Returns `null` for anything that is not an event prop.
 *
 * Elements and the global targets (`ImplementDocument`, `ImplementWindow`) both
 * accept the same prop shape, so they share this rather than each carrying a
 * copy — the copies drifted once already, and `on*Capture` bound a `keydowncapture`
 * event that never fires.
 */
export function resolveEventName(key: string): ResolvedEvent | null {
	if (key.length < 3 || !key.startsWith("on")) return null;
	const third = key[2];
	if (third === undefined || third !== third.toUpperCase() || third === third.toLowerCase()) {
		return null;
	}
	let name = key.slice(2);
	let capture = false;
	// `onCapture` itself is a `capture` handler, not a capture-phase binding, so
	// the suffix only counts when something precedes it.
	if (name.endsWith("Capture") && name.length > "Capture".length) {
		capture = true;
		name = name.slice(0, -"Capture".length);
	}
	return { event: name.toLowerCase(), capture };
}
