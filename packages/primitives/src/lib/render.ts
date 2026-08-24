import type { Child, ComponentProps } from "@implementjs/core";

/**
 * The shape of a `render` prop. It receives the props the part computed —
 * merged with the ones you passed — and the part's children, and returns what
 * to render in place of the part's default element.
 *
 * ```ts
 * Separator({ render: (props) => Hr(props) });
 * ```
 */
export type RenderFn<P> = (props: P, ...children: Child[]) => Child;

/**
 * The props of the element a part renders, plus the `render` prop that
 * delegates that element to you. Pass the element factory the part renders by
 * default, the same way you would to `ComponentProps`:
 *
 * ```ts
 * export type SeparatorProps = RenderableProps<typeof Div> & {
 * 	orientation?: "horizontal" | "vertical";
 * };
 * ```
 */
// oxlint-disable-next-line typescript/no-explicit-any -- Mirrors the constraint on core's ComponentProps.
export type RenderableProps<T extends ((...args: any) => any) | keyof HTMLElementTagNameMap> =
	ComponentProps<T> & {
		/**
		 * Render your own element or component instead of the part's default.
		 * Spread the props you are given onto whatever you return, or the part
		 * loses its behavior, accessibility, and styling hooks.
		 */
		render?: RenderFn<ComponentProps<T>>;
	};
