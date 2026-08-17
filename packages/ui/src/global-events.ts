import { MountNode } from "./mountable";
import type { Unsubscribe } from "./types";

type GlobalHandler = {
	event: string;
	handler: EventListener;
	options: AddEventListenerOptions | undefined;
};

class _globalEvents<EventMap> extends MountNode {
	private target: EventTarget;
	private handlers: GlobalHandler[] = [];
	private detachers: Unsubscribe[] = [];

	constructor(target: EventTarget) {
		super();
		this.target = target;
	}

	/**
	 * Listens for `event` on the global target while mounted. Unlike
	 * `Component.on`, `ev.target` is not narrowed — for a document `keydown`
	 * it is whatever element had focus, not the document.
	 */
	on<E extends keyof EventMap & string>(
		event: E,
		handler: (ev: EventMap[E]) => void,
		options?: AddEventListenerOptions,
	): this {
		this.handlers.push({ event, handler: handler as unknown as EventListener, options });
		return this;
	}

	override getFirstDomNode(): Node | null {
		// no DOM of its own; logical siblings must never anchor against it
		return null;
	}

	mount(parent: HTMLElement) {
		this.detach();
		this.parent = parent;
		for (const { event, handler, options } of this.handlers) {
			this.target.addEventListener(event, handler, options);
			this.detachers.push(() => this.target.removeEventListener(event, handler, options));
		}
	}

	override unmount() {
		this.detach();
		super.unmount();
	}

	private detach() {
		this.detachers.forEach((unsubscribe) => unsubscribe());
		this.detachers = [];
	}
}

/**
 * Special components addressing the framework itself rather than an element,
 * mirroring Svelte's `<svelte:window>`/`<svelte:document>`. `UIFramework` is a
 * placeholder namespace until the framework has a name.
 */
export const UIFramework = {
	/**
	 * Attaches `window` event listeners for as long as it is mounted, so
	 * handler lifetime follows tree position: place one inside
	 * `If(open).Then(...)` and the listeners attach when the branch mounts and
	 * detach when it unmounts. Renders nothing.
	 *
	 * ```ts
	 * UIFramework.Window().on("resize", onResize).on("hashchange", onRoute);
	 * ```
	 */
	Window(): _globalEvents<WindowEventMap> {
		return new _globalEvents<WindowEventMap>(window);
	},

	/**
	 * Attaches `document` event listeners for as long as it is mounted — the
	 * `window` counterpart is `UIFramework.Window`. Renders nothing.
	 *
	 * ```ts
	 * If(open).Then(
	 * 	panel,
	 * 	UIFramework.Document().on("mousedown", onOutsideClick),
	 * );
	 * ```
	 */
	Document(): _globalEvents<DocumentEventMap> {
		return new _globalEvents<DocumentEventMap>(document);
	},
};
