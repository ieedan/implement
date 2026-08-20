import {
	computePosition,
	offset,
	type Placement,
	shift,
	flip,
	size,
	type Strategy,
	autoUpdate,
} from "@floating-ui/dom";
import { LIB_PREFIX, noop } from "../../utils";

export type Side = "top" | "right" | "bottom" | "left";
export type Align = "start" | "center" | "end";

export function toFloatingUIPlacement(side: Side, align: Align): Placement {
	if (align === "center") return side;
	return `${side}-${align}`;
}

export function fromFloatingUIPlacement(placement: Placement): [Side, Align] {
	const [side, alignPart] = placement.split("-") as [Side, Align?];
	return [side, alignPart ?? "center"];
}

export type PositioningOptions = {
	side: Side;
	align: Align;
	offset: number;
	strategy: Strategy;
	componentName: string;
	autoUpdate: boolean;
};

export function positionFloatingElement(
	reference: HTMLElement,
	floating: HTMLElement,
	opts: PositioningOptions,
): () => void {
	const update = () => {
		const placement = toFloatingUIPlacement(opts.side, opts.align);
		void computePosition(reference, floating, {
			placement,
			strategy: opts.strategy,
			middleware: [
				offset(opts.offset),
				shift(),
				flip(),
				size({
					apply({ availableWidth, availableHeight, rects, placement: resolved }) {
						const [side, align] = fromFloatingUIPlacement(resolved);
						floating.style.setProperty(
							`--${LIB_PREFIX}-${opts.componentName}-content-transform-origin`,
							toTransformOrigin(side, align, { width: availableWidth, height: availableHeight }),
						);
						floating.style.setProperty(
							`--${LIB_PREFIX}-${opts.componentName}-content-available-width`,
							`${availableWidth}px`,
						);
						floating.style.setProperty(
							`--${LIB_PREFIX}-${opts.componentName}-content-available-height`,
							`${availableHeight}px`,
						);
						floating.style.setProperty(
							`--${LIB_PREFIX}-${opts.componentName}-anchor-width`,
							`${rects.reference.width}px`,
						);
						floating.style.setProperty(
							`--${LIB_PREFIX}-${opts.componentName}-anchor-height`,
							`${rects.reference.height}px`,
						);
					},
				}),
			],
		}).then(({ x, y, placement: resolved }) => {
			floating.style.left = `${x}px`;
			floating.style.top = `${y}px`;
			const [side, align] = resolved.split("-");
			floating.dataset.side = side;
			floating.dataset.align = align;
		});
	};

	if (opts.autoUpdate) {
		return autoUpdate(reference, floating, update);
	}

	update();

	return noop;
}

const ALIGN_ORIGIN: Record<Align, string> = {
	start: "0%",
	center: "50%",
	end: "100%",
};

/** Transform origin so scale/fade animations grow from the trigger. */
function toTransformOrigin(
	side: Side,
	align: Align,
	floating: { width: number; height: number },
): string {
	const alignOrigin = ALIGN_ORIGIN[align];
	if (side === "bottom") return `${alignOrigin} 0px`;
	if (side === "top") return `${alignOrigin} ${floating.height}px`;
	if (side === "right") return `0px ${alignOrigin}`;
	return `${floating.width}px ${alignOrigin}`;
}
