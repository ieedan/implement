import { attachAtCursor, claimElement, claimSvgRoot, claimText, wasClaimed } from "./hydrate";

/**
 * The DOM factory surface core mounts through. The browser environment
 * delegates to the real `document`; the server render installs a structural
 * stand-in for the duration of a synchronous render, which is why nothing in
 * core may touch `document`/`window` directly.
 */
export type DomEnvironment = {
	createElement(tag: string): HTMLElement;
	createTextNode(data: string): Text;
	createComment(data: string): Comment;
	head(): HTMLElement;
	body(): HTMLElement;
	setTitle(value: string): void;
	/** `null` outside the browser — global-event helpers no-op then. */
	windowTarget(): EventTarget | null;
	/** `null` outside the browser — global-event helpers no-op then. */
	documentTarget(): EventTarget | null;
	/** Parse trusted HTML and insert the resulting nodes before `before`. */
	insertHtml(html: string, parent: ParentNode, before: Node): void;
	/** Build an `<svg>` root from trusted markup, or `null` when it does not parse to one. */
	createSvgRoot(source: string): SVGSVGElement | null;
};

// Parsed sources, cached forever: each unique string parses once and every
// mount is a cheap clone. Intended for a fixed set of glyphs — don't feed this
// unbounded generated markup.
const svgTemplates = new Map<string, HTMLTemplateElement>();

const browser: DomEnvironment = {
	createElement: (tag) => document.createElement(tag),
	createTextNode: (data) => document.createTextNode(data),
	createComment: (data) => document.createComment(data),
	head: () => document.head,
	body: () => document.body,
	setTitle: (value) => {
		document.title = value;
	},
	windowTarget: () => window,
	documentTarget: () => document,
	insertHtml: (html, parent, before) => {
		const template = document.createElement("template");
		template.innerHTML = html;
		parent.insertBefore(template.content, before);
	},
	createSvgRoot: (source) => {
		let template = svgTemplates.get(source);
		if (!template) {
			template = document.createElement("template");
			// the HTML parser switches to the SVG namespace at <svg>, so no
			// createElementNS dance is needed
			template.innerHTML = source;
			svgTemplates.set(source, template);
		}
		const root = template.content.firstElementChild;
		if (!(root instanceof SVGSVGElement)) {
			console.warn("Svg: source did not parse to a root <svg> element", source);
			return null;
		}
		// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Parsed SVG root was verified as SVGSVGElement above.
		return root.cloneNode(true) as SVGSVGElement;
	},
};

let active: DomEnvironment = browser;

/** Swap the active environment (server render). Returns a restore function. */
export function installDomEnvironment(environment: DomEnvironment): () => void {
	const previous = active;
	active = environment;
	return () => {
		active = previous;
	};
}

/**
 * Stable facade so call sites survive an environment swap mid-lifetime.
 * During a hydration pass, element/text/svg creation first tries to claim the
 * next serialized node; comments are always created fresh (server anchors are
 * swept when the pass ends).
 */
export const dom: DomEnvironment & {
	/** Append `node`, unless hydration already adopted it in place. */
	attach(parent: HTMLElement, node: Node): void;
} = {
	createElement: (tag) => claimElement(tag) ?? active.createElement(tag),
	createTextNode: (data) => claimText(data) ?? active.createTextNode(data),
	createComment: (data) => active.createComment(data),
	attach: (parent, node) => {
		if (wasClaimed(node)) return;
		if (!attachAtCursor(parent, node)) parent.appendChild(node);
	},
	head: () => active.head(),
	body: () => active.body(),
	setTitle: (value) => active.setTitle(value),
	windowTarget: () => active.windowTarget(),
	documentTarget: () => active.documentTarget(),
	insertHtml: (html, parent, before) => active.insertHtml(html, parent, before),
	createSvgRoot: (source) => claimSvgRoot() ?? active.createSvgRoot(source),
};
