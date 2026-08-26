import { isReadable, subscribe } from "../../signal";
import type { Unsubscribe } from "../../types";
import { resolveEventName } from "../event-name";
import type { Bindable } from "../props";
import type { Mountable } from "../types";

type EventHandlers<EventMap, This> = {
	[K in keyof EventMap & string as `on${Capitalize<K>}`]?: Bindable<
		(this: This, ev: EventMap[K]) => void
	>;
} & {
	[K in keyof EventMap & string as `on${Capitalize<K>}Capture`]?: Bindable<
		(this: This, ev: EventMap[K]) => void
	>;
};

/** `onKeydown`, `onMousedownCapture`, … typed against `DocumentEventMap`. */
export type DocumentProps = EventHandlers<DocumentEventMap, Document>;

/** `onResize`, `onHashchange`, … typed against `WindowEventMap`. */
export type WindowProps = EventHandlers<WindowEventMap, Window>;

function noop() {}

function bindListener(
	target: EventTarget,
	event: string,
	value: unknown,
	capture: boolean,
): Unsubscribe {
	const options: AddEventListenerOptions = { capture };

	const attach = (handler: unknown): Unsubscribe => {
		if (typeof handler !== "function") return noop;
		// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Global event props accept any listener after a function check.
		const listener = handler as EventListener;
		target.addEventListener(event, listener, options);
		return () => target.removeEventListener(event, listener, options);
	};

	if (isReadable(value)) {
		let current: Unsubscribe = noop;
		const unsub = subscribe([value], (handler) => {
			current();
			current = attach(handler);
		});
		return () => {
			unsub();
			current();
		};
	}

	return attach(value);
}

/** `resolveTarget` defers the global lookup to mount time and returns `null` on the server, where listeners are a no-op. */
export function globalEvents(
	resolveTarget: () => EventTarget | null,
	props: Record<string, unknown>,
): Mountable {
	return () => {
		const detachers: Unsubscribe[] = [];

		const detach = () => {
			for (const unsubscribe of detachers) unsubscribe();
			detachers.length = 0;
		};

		return {
			mount() {
				detach();
				const target = resolveTarget();
				if (!target) return;
				for (const [key, value] of Object.entries(props)) {
					if (value === undefined) continue;
					const parsed = resolveEventName(key);
					if (!parsed) continue;
					detachers.push(bindListener(target, parsed.event, value, parsed.capture));
				}
			},
			unmount() {
				detach();
			},
			getFirstDomNode() {
				// no DOM of its own; logical siblings must never anchor against it
				return null;
			},
		};
	};
}
