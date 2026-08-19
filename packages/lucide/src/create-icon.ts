import { Svg, type Mountable, type SvgProps } from "@implementjs/core";

export type { SvgProps } from "@implementjs/core";

/** An icon component: call it with optional `SvgProps` to get a mountable `<svg>`. */
export type IconComponent = (props?: SvgProps) => Mountable;

const DEFAULT_ATTRIBUTES =
	`xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" ` +
	`fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`;

/**
 * Wraps a Lucide glyph body in the standard Lucide root attributes and returns
 * an icon component backed by the core `Svg` helper, so each icon's markup is
 * parsed once and cloned per mount. The `lucide lucide-<name>` classes are
 * merged with (not replaced by) any `class`/`className` the caller passes.
 */
export function createLucideIcon(name: string, body: string): IconComponent {
	const source = `<svg ${DEFAULT_ATTRIBUTES}>${body}</svg>`;
	const defaultClasses = `lucide lucide-${name}`;
	return (props = {}) => {
		// fold className into class: the two keys each rewrite the class
		// attribute wholesale, so only a single merged binding may reach Svg
		const { class: classValue, className, ...rest } = props;
		return Svg(source, { ...rest, class: [defaultClasses, classValue, className] });
	};
}
