import { isReadable, type Child } from "@implementjs/core";

function isPropsObject(value: unknown): value is Record<string, unknown> {
	return value != null && typeof value === "object" && !Array.isArray(value) && !isReadable(value);
}

export type ComponentInit<P, R = Child> = (props: P, ...children: Child[]) => R;

export interface Component<P, R = Child> {
	(props: P, ...children: Child[]): R;
	(...children: Child[]): R;
	readonly __componentProps?: P;
}

/**
 * Wraps a component initializer so props are optional and children can be
 * passed as the first argument, matching native element call styles.
 *
 * ```ts
 * export const Checkbox = createComponent(function Checkbox(props, ...children) {
 *   return Button(props, ...children);
 * });
 *
 * Checkbox({}, "Label");
 * Checkbox("Label");
 * ```
 */
export function createComponent<P, R = Child>(init: ComponentInit<P, R>): Component<P, R> {
	function component(props: P, ...children: Child[]): R;
	function component(...children: Child[]): R;
	function component(propsOrChild?: P | Child, ...rest: Child[]): R {
		/* oxlint-disable typescript/no-unsafe-type-assertion -- Component overload resolution requires narrowing props vs. children. */
		if (isPropsObject(propsOrChild)) {
			return init(propsOrChild as P, ...rest);
		}

		const children = (propsOrChild === undefined ? rest : [propsOrChild, ...rest]) as Child[];
		return init({} as P, ...children);
		/* oxlint-enable typescript/no-unsafe-type-assertion */
	}

	return component;
}
