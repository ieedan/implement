const stroke = `stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"`;

const svg = (body: string) =>
	`<svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;

export const icons = {
	menu: svg(`<path d="M3 4.5h10M3 8h10M3 11.5h10" ${stroke}/>`),
	chevronLeft: svg(`<path d="M10 4L6 8l4 4" ${stroke}/>`),
	chevronRight: svg(`<path d="M6 4l4 4-4 4" ${stroke}/>`),
	refresh: svg(
		`<path d="M13 8a5 5 0 1 1-1.3-3.4M13 3.5V6h-2.5" ${stroke}/>`,
	),
};
