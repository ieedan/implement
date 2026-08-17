import { isReadable, subscribe } from "../../signal";
import type { Unsubscribe } from "../../types";
import { applySvgProps, type Bindable, type SvgProps } from "../props";
import type { Mountable } from "../types";

export type { SvgProps } from "../props";

// Parsed sources, cached forever: each unique string parses once and every
// mount is a cheap clone. Intended for a fixed set of glyphs — don't feed this
// unbounded generated markup.
const templates = new Map<string, HTMLTemplateElement>();

function instantiate(source: string): SVGSVGElement | null {
	let template = templates.get(source);
	if (!template) {
		template = document.createElement("template");
		// the HTML parser switches to the SVG namespace at <svg>, so no
		// createElementNS dance is needed
		template.innerHTML = source;
		templates.set(source, template);
	}
	const root = template.content.firstElementChild;
	if (!(root instanceof SVGSVGElement)) {
		console.warn("Svg: source did not parse to a root <svg> element", source);
		return null;
	}
	return root.cloneNode(true) as SVGSVGElement;
}

/**
 * Builds an `<svg>` element from trusted markup. The string is the template
 * (parsed once and cloned per mount), the props are the instance: they are
 * applied to the root after cloning, so they override attributes baked into
 * the source. A reactive source swaps the whole element in place; reactive
 * props update attributes without any re-parsing.
 *
 * ```ts
 * Svg(icons.check, { class: "h-4 w-4", fill: color, onClick });
 * ```
 */
export function Svg(source: Bindable<string>, props: SvgProps = {}): Mountable {
	return () => {
		const anchor = document.createComment("");
		let element: SVGSVGElement | null = null;
		let unsubscribeProps: Unsubscribe | null = null;
		let unsubscribeSource: Unsubscribe | null = null;

		const clear = () => {
			if (element) props.this?.set(null);
			unsubscribeProps?.();
			unsubscribeProps = null;
			element?.remove();
			element = null;
		};

		const apply = (value: string) => {
			if (!anchor.parentNode) return;
			const next = instantiate(value);
			clear();
			if (!next) return;
			unsubscribeProps = applySvgProps(next, props as Record<string, unknown>);
			anchor.after(next);
			element = next;
			props.this?.set(next);
		};

		return {
			mount(parent: HTMLElement) {
				unsubscribeSource?.();
				unsubscribeSource = null;
				clear();
				anchor.remove();
				parent.appendChild(anchor);
				if (isReadable<string>(source)) {
					unsubscribeSource = subscribe([source], apply);
				} else {
					apply(source);
				}
			},
			unmount() {
				unsubscribeSource?.();
				unsubscribeSource = null;
				clear();
				anchor.remove();
			},
			getFirstDomNode() {
				if (element) return element;
				return anchor.isConnected ? anchor : null;
			},
		};
	};
}
