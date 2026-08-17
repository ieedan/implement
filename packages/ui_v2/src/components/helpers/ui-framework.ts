import type { Mountable } from "../types";
import { Boundary } from "./boundary";
import { globalEvents, type DocumentProps, type WindowProps } from "./global-events";
import { Lifecycle } from "./lifecycle";

/**
 * Special components addressing the framework itself rather than an element,
 * mirroring Svelte's `<svelte:window>`/`<svelte:document>`. `UIFramework` is a
 * placeholder namespace until the framework has a name.
 *
 * Event props match elements (`onKeydown`, `onResize`, …). `on*Capture`
 * listens in the capture phase. `ev.target` is not narrowed to the global
 * object — for a document `keydown` it is whatever element had focus.
 */
export const UIFramework = {
	/**
	 * Attaches `window` event listeners for as long as it is mounted, so
	 * handler lifetime follows tree position: place one inside
	 * `If(open).Then(...)` and the listeners attach when the branch mounts and
	 * detach when it unmounts. Renders nothing.
	 *
	 * ```ts
	 * UIFramework.Window({ onResize, onHashchange: onRoute });
	 * ```
	 */
	Window(props: WindowProps = {}): Mountable {
		return globalEvents(window, props);
	},

	/**
	 * Attaches `document` event listeners for as long as it is mounted — the
	 * `window` counterpart is `UIFramework.Window`. Renders nothing.
	 *
	 * ```ts
	 * If(open).Then(
	 * 	panel,
	 * 	UIFramework.Document({ onMousedown: onOutsideClick }),
	 * );
	 * ```
	 */
	Document(props: DocumentProps = {}): Mountable {
		return globalEvents(document, props);
	},

	Boundary,

	Lifecycle,
};
