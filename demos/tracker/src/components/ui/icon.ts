import { derived, Svg, type Mountable, type Readable } from "@packages/implement";
import { cx } from "../../lib/cx";

// Icons are raw SVG strings handed to the Svg helper, which parses each one
// once and clones it per mount. Size and color come from classes on the root.
const svg = (body: string) =>
	`<svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;

const stroke = `stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"`;

export const icons = {
	plus: svg(`<path d="M8 3v10M3 8h10" ${stroke}/>`),
	search: svg(
		`<circle cx="7" cy="7" r="4.5" ${stroke}/><path d="M10.5 10.5L13.5 13.5" ${stroke}/>`,
	),
	chevronLeft: svg(`<path d="M10 4L6 8l4 4" ${stroke}/>`),
	chevronDown: svg(`<path d="M4 6.5l4 4 4-4" ${stroke}/>`),
	dots: svg(
		`<circle cx="3.5" cy="8" r="1.25" fill="currentColor"/><circle cx="8" cy="8" r="1.25" fill="currentColor"/><circle cx="12.5" cy="8" r="1.25" fill="currentColor"/>`,
	),
	trash: svg(
		`<path d="M3 4.5h10M6.5 4.5v-1a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1M4.5 4.5l.6 8a1 1 0 0 0 1 .9h3.8a1 1 0 0 0 1-.9l.6-8" ${stroke}/>`,
	),
	comment: svg(
		`<path d="M2.5 4.5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H8.5l-3 3v-3h-1a2 2 0 0 1-2-2v-4z" ${stroke}/>`,
	),
	check: svg(`<path d="M3.5 8.5l3 3 6-7" ${stroke}/>`),
	x: svg(`<path d="M4 4l8 8M12 4l-8 8" ${stroke}/>`),
	inbox: svg(
		`<path d="M4.2 3.5h7.6a1 1 0 0 1 .95.7l1.35 4.3v3a1 1 0 0 1-1 1h-10a1 1 0 0 1-1-1v-3L3.25 4.2a1 1 0 0 1 .95-.7z" ${stroke}/><path d="M2.5 9.5h3.3c0 1.1.98 2 2.2 2s2.2-.9 2.2-2h3.3" ${stroke}/>`,
	),
	list: svg(`<path d="M3 4.5h10M3 8h10M3 11.5h6.5" ${stroke}/>`),
	tag: svg(
		`<path d="M2.5 3.5a1 1 0 0 1 1-1h3.6a1 1 0 0 1 .7.3l5.6 5.6a1 1 0 0 1 0 1.4l-3.6 3.6a1 1 0 0 1-1.4 0L2.8 7.8a1 1 0 0 1-.3-.7V3.5z" ${stroke}/><circle cx="5.75" cy="5.75" r="1" fill="currentColor"/>`,
	),
	user: svg(
		`<circle cx="8" cy="5.5" r="2.5" ${stroke}/><path d="M3.25 13.5a4.75 4.75 0 0 1 9.5 0" ${stroke}/>`,
	),
	userDashed: svg(
		`<circle cx="8" cy="5.5" r="2.5" ${stroke} stroke-dasharray="2.5 2"/><path d="M3.25 13.5a4.75 4.75 0 0 1 9.5 0" ${stroke} stroke-dasharray="2.5 2"/>`,
	),

	statusBacklog: svg(`<circle cx="8" cy="8" r="5.75" ${stroke} stroke-dasharray="2.4 2.4"/>`),
	statusTodo: svg(`<circle cx="8" cy="8" r="5.75" ${stroke}/>`),
	statusInProgress: svg(
		`<circle cx="8" cy="8" r="5.75" ${stroke}/><path d="M8 8V4.5A3.5 3.5 0 0 1 8 11.5Z" fill="currentColor"/>`,
	),
	statusDone: svg(
		`<circle cx="8" cy="8" r="6.5" fill="currentColor"/><path d="M5 8.3l2 2L11 5.8" stroke="#09090b" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>`,
	),
	statusCanceled: svg(
		`<circle cx="8" cy="8" r="6.5" fill="currentColor"/><path d="M5.9 5.9l4.2 4.2M10.1 5.9l-4.2 4.2" stroke="#09090b" stroke-width="1.7" stroke-linecap="round"/>`,
	),

	priorityNone: svg(
		`<rect x="3" y="7.25" width="10" height="1.5" rx="0.75" fill="currentColor" opacity="0.6"/>`,
	),
	priorityLow: svg(
		`<rect x="2" y="9" width="3" height="5" rx="1" fill="currentColor"/><rect x="6.5" y="6" width="3" height="8" rx="1" fill="currentColor" opacity="0.25"/><rect x="11" y="3" width="3" height="11" rx="1" fill="currentColor" opacity="0.25"/>`,
	),
	priorityMedium: svg(
		`<rect x="2" y="9" width="3" height="5" rx="1" fill="currentColor"/><rect x="6.5" y="6" width="3" height="8" rx="1" fill="currentColor"/><rect x="11" y="3" width="3" height="11" rx="1" fill="currentColor" opacity="0.25"/>`,
	),
	priorityHigh: svg(
		`<rect x="2" y="9" width="3" height="5" rx="1" fill="currentColor"/><rect x="6.5" y="6" width="3" height="8" rx="1" fill="currentColor"/><rect x="11" y="3" width="3" height="11" rx="1" fill="currentColor"/>`,
	),
	priorityUrgent: svg(
		`<rect x="2" y="2" width="12" height="12" rx="3" fill="currentColor"/><path d="M8 5v3.5" stroke="#09090b" stroke-width="1.7" stroke-linecap="round"/><circle cx="8" cy="11" r="0.9" fill="#09090b"/>`,
	),
} as const;

export type IconName = keyof typeof icons;

/** Inline icon. Size and color come from the classes (defaults to 16px). */
export function Icon(name: IconName, className = "h-4 w-4"): Mountable {
	return Svg(icons[name], { class: cx("inline-block shrink-0", className) });
}

/** Icon whose glyph and classes track a readable value. */
export function ReactiveIcon<T>(
	source: Readable<T>,
	getIcon: (value: T) => IconName,
	getClass: (value: T) => string,
): Mountable {
	return Svg(
		derived([source], (value) => icons[getIcon(value)]),
		{ class: derived([source], (value) => cx("inline-block shrink-0", getClass(value))) },
	);
}
