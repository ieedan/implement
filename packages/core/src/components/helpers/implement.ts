import { dom } from "../../dom";
import { ReactiveMap, ReactiveSet } from "../../signal";
import type { Mountable } from "../types";
import { globalEvents, type DocumentProps, type WindowProps } from "./global-events";

/**
 * Attaches `window` event listeners for as long as it is mounted, so
 * handler lifetime follows tree position: place one inside
 * `If(open).Then(...)` and the listeners attach when the branch mounts and
 * detach when it unmounts. Renders nothing.
 *
 * Event props match elements (`onKeydown`, `onResize`, …). `on*Capture`
 * listens in the capture phase. `ev.target` is not narrowed to the global
 * object — for a document `keydown` it is whatever element had focus.
 *
 * ```ts
 * ImplementWindow({ onResize, onHashchange: onRoute });
 * ```
 */
export function ImplementWindow(props: WindowProps = {}): Mountable {
	return globalEvents(() => dom.windowTarget(), props);
}

/**
 * Attaches `document` event listeners for as long as it is mounted — the
 * `window` counterpart is `ImplementWindow`. Renders nothing.
 *
 * ```ts
 * If(open).Then(
 * 	panel,
 * 	ImplementDocument({ onMousedown: onOutsideClick }),
 * );
 * ```
 */
export function ImplementDocument(props: DocumentProps = {}): Mountable {
	return globalEvents(() => dom.documentTarget(), props);
}

/**
 * Creates a reactive `Set`: a real `Set` that is also a
 * `Readable<ReadonlySet<T>>`. Mutators (`add`, `delete`, `clear`,
 * `toggle`) notify subscribers with an immutable snapshot, so derived
 * values, bindings, and props stay in sync with no copying on your side.
 *
 * ```ts
 * const selected = ImplementSet<string>();
 * Button({ onClick: () => selected.toggle(id) }, "Select");
 * Span(selected.bind((s) => `${s.size} selected`));
 * ```
 */
export function ImplementSet<T>(values?: Iterable<T> | null): ReactiveSet<T> {
	return new ReactiveSet(values);
}

/**
 * Creates a reactive `Map`: a real `Map` that is also a
 * `Readable<ReadonlyMap<K, V>>`. Mutators (`set`, `delete`, `clear`)
 * notify subscribers with an immutable snapshot. `get(key)` reads an entry
 * (non-reactive); `get()` with no arguments is the readable's snapshot.
 *
 * ```ts
 * const drafts = ImplementMap<string, string>();
 * Span(drafts.bind((d) => d.get(id) ?? ""));
 * ```
 */
export function ImplementMap<K, V>(entries?: Iterable<readonly [K, V]> | null): ReactiveMap<K, V> {
	return new ReactiveMap(entries);
}
