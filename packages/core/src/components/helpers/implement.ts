import { ReactiveMap, ReactiveSet } from "../../signal";
import type { Mountable } from "../types";
import { Boundary } from "./boundary";
import { globalEvents, type DocumentProps, type WindowProps } from "./global-events";
import { Head } from "./head";
import { Lifecycle } from "./lifecycle";
import { Watch } from "./watch";

/**
 * Special components addressing the framework itself rather than an element,
 * mirroring Svelte's `<svelte:window>`/`<svelte:document>`.
 *
 * Event props match elements (`onKeydown`, `onResize`, …). `on*Capture`
 * listens in the capture phase. `ev.target` is not narrowed to the global
 * object — for a document `keydown` it is whatever element had focus.
 */
export const Implement = {
	/**
	 * Attaches `window` event listeners for as long as it is mounted, so
	 * handler lifetime follows tree position: place one inside
	 * `If(open).Then(...)` and the listeners attach when the branch mounts and
	 * detach when it unmounts. Renders nothing.
	 *
	 * ```ts
	 * Implement.Window({ onResize, onHashchange: onRoute });
	 * ```
	 */
	Window(props: WindowProps = {}): Mountable {
		return globalEvents(window, props);
	},

	/**
	 * Attaches `document` event listeners for as long as it is mounted — the
	 * `window` counterpart is `Implement.Window`. Renders nothing.
	 *
	 * ```ts
	 * If(open).Then(
	 * 	panel,
	 * 	Implement.Document({ onMousedown: onOutsideClick }),
	 * );
	 * ```
	 */
	Document(props: DocumentProps = {}): Mountable {
		return globalEvents(document, props);
	},

	/**
	 * Creates a reactive `Set`: a real `Set` that is also a
	 * `Readable<ReadonlySet<T>>`. Mutators (`add`, `delete`, `clear`,
	 * `toggle`) notify subscribers with an immutable snapshot, so derived
	 * values, bindings, and props stay in sync with no copying on your side.
	 *
	 * ```ts
	 * const selected = Implement.Set<string>();
	 * Button({ onClick: () => selected.toggle(id) }, "Select");
	 * Span(selected.bind((s) => `${s.size} selected`));
	 * ```
	 */
	Set<T>(values?: Iterable<T> | null): ReactiveSet<T> {
		return new ReactiveSet(values);
	},

	/**
	 * Creates a reactive `Map`: a real `Map` that is also a
	 * `Readable<ReadonlyMap<K, V>>`. Mutators (`set`, `delete`, `clear`)
	 * notify subscribers with an immutable snapshot. `get(key)` reads an entry
	 * (non-reactive); `get()` with no arguments is the readable's snapshot.
	 *
	 * ```ts
	 * const drafts = Implement.Map<string, string>();
	 * Span(drafts.bind((d) => d.get(id) ?? ""));
	 * ```
	 */
	Map<K, V>(entries?: Iterable<readonly [K, V]> | null): ReactiveMap<K, V> {
		return new ReactiveMap(entries);
	},

	Boundary,

	Head,

	Lifecycle,

	Watch,
};
