import { isReadable, subscribe } from "../../signal";
import type { Unsubscribe } from "../../types";
import type { Bindable } from "../props";
import type { Mountable } from "../types";

/**
 * Inserts HTML as sibling nodes. Use this instead of an `innerHTML` prop so
 * surrounding children are not wiped.
 */
export function Html(html: Bindable<string>): Mountable {
	return () => {
		const start = document.createComment("");
		const end = document.createComment("");
		let unsubscribe: Unsubscribe | null = null;

		const clear = () => {
			let node = start.nextSibling;
			while (node && node !== end) {
				const next = node.nextSibling;
				node.remove();
				node = next;
			}
		};

		const apply = (value: string) => {
			if (!start.parentNode) return;
			clear();
			const template = document.createElement("template");
			template.innerHTML = value;
			start.parentNode.insertBefore(template.content, end);
		};

		return {
			mount(parent: HTMLElement) {
				unsubscribe?.();
				clear();
				start.remove();
				end.remove();
				parent.append(start, end);
				if (isReadable<string>(html)) {
					unsubscribe = subscribe([html], apply);
				} else {
					apply(html);
				}
			},
			unmount() {
				unsubscribe?.();
				unsubscribe = null;
				clear();
				start.remove();
				end.remove();
			},
			getFirstDomNode() {
				const first = start.nextSibling;
				if (first && first !== end) return first;
				return start.isConnected ? start : null;
			},
		};
	};
}
