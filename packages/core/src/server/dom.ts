import type { DomEnvironment } from "../dom";

/**
 * Minimal server-side DOM: exactly the surface core touches while mounting
 * (`props.ts`, the helpers, `syncDomOrder`) plus an HTML serializer. Nodes are
 * handed to core as real DOM types through the environment boundary — the
 * casts live in {@link createServerEnvironment} only.
 */

const VOID_ELEMENTS = new Set([
	"area",
	"base",
	"br",
	"col",
	"embed",
	"hr",
	"img",
	"input",
	"link",
	"meta",
	"source",
	"track",
	"wbr",
]);

/** Elements whose text children serialize verbatim, matching DOM innerHTML. */
const RAW_TEXT_ELEMENTS = new Set(["script", "style"]);

export function escapeText(value: string): string {
	return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttribute(value: string): string {
	return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function toKebab(property: string): string {
	return property.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);
}

function toCamel(property: string): string {
	// custom properties are keys in their own right — `--brand` is not `Brand`
	if (property.startsWith("--")) return property;
	return property.replace(/-([a-z])/g, (_, char: string) => char.toUpperCase());
}

const styleDeclarations = Symbol("style-declarations");

/**
 * Backs `el.style`. `setProperty` covers dashed/custom properties; camelCase
 * properties are plain assignments (see `setStyleProperty` in props.ts), which
 * land as own enumerable keys the serializer picks up.
 */
class ServerStyle {
	cssText = "";
	[styleDeclarations] = new Map<string, string>();

	setProperty(name: string, value: string): void {
		this[styleDeclarations].set(name, value);
	}

	removeProperty(name: string): void {
		this[styleDeclarations].delete(name);
	}
}

function serializeStyle(style: ServerStyle): string {
	const parts: string[] = [];
	const raw = style.cssText.trim();
	if (raw) parts.push(raw.endsWith(";") ? raw.slice(0, -1) : raw);
	for (const [name, value] of style[styleDeclarations]) {
		if (value !== "") parts.push(`${name}: ${value}`);
	}
	for (const [name, value] of Object.entries(style)) {
		if (name === "cssText" || typeof value !== "string" || value === "") continue;
		parts.push(`${toKebab(name)}: ${value}`);
	}
	return parts.join("; ");
}

/**
 * The same declarations {@link serializeStyle} writes as css text, as an
 * object keyed the way a style prop is written. The three sources a style can
 * arrive from are read in the order they override each other: `cssText` (a
 * `style` prop given as a string), `setProperty` (dashed and custom
 * properties), then the camelCase own keys plain assignment leaves behind.
 */
function styleObject(style: ServerStyle): Record<string, string> {
	const result: Record<string, string> = {};
	for (const declaration of style.cssText.split(";")) {
		const separator = declaration.indexOf(":");
		if (separator === -1) continue;
		const name = declaration.slice(0, separator).trim();
		const value = declaration.slice(separator + 1).trim();
		if (name !== "" && value !== "") result[toCamel(name)] = value;
	}
	for (const [name, value] of style[styleDeclarations]) {
		if (value !== "") result[toCamel(name)] = value;
	}
	for (const [name, value] of Object.entries(style)) {
		if (name === "cssText" || typeof value !== "string" || value === "") continue;
		result[toCamel(name)] = value;
	}
	return result;
}

export type ServerChildNode = ServerElement | ServerText | ServerComment | ServerRaw;

abstract class ServerNode {
	parentNode: ServerContainer | null = null;

	get nextSibling(): ServerChildNode | null {
		if (!this.parentNode) return null;
		const siblings = this.parentNode.childNodes;
		// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Server node subclasses share one sibling list typed as ServerChildNode.
		const index = siblings.indexOf(this as unknown as ServerChildNode);
		return siblings[index + 1] ?? null;
	}

	get isConnected(): boolean {
		if (this instanceof ServerDocument) return true;
		let parent = this.parentNode;
		while (parent) {
			if (parent instanceof ServerDocument) return true;
			parent = parent.parentNode;
		}
		return false;
	}

	remove(): void {
		if (!this.parentNode) return;
		const siblings = this.parentNode.childNodes;
		// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Server node subclasses share one sibling list typed as ServerChildNode.
		const index = siblings.indexOf(this as unknown as ServerChildNode);
		if (index !== -1) siblings.splice(index, 1);
		this.parentNode = null;
	}

	after(...nodes: ServerChildNode[]): void {
		const parent = this.parentNode;
		if (!parent) return;
		const anchor = this.nextSibling;
		for (const node of nodes) parent.insertBefore(node, anchor);
	}
}

abstract class ServerContainer extends ServerNode {
	childNodes: ServerChildNode[] = [];

	appendChild(node: ServerChildNode): void {
		node.remove();
		node.parentNode = this;
		this.childNodes.push(node);
	}

	append(...nodes: ServerChildNode[]): void {
		for (const node of nodes) this.appendChild(node);
	}

	insertBefore(node: ServerChildNode, before: ServerChildNode | null): void {
		if (before === null) {
			this.appendChild(node);
			return;
		}
		node.remove();
		const index = this.childNodes.indexOf(before);
		if (index === -1) {
			throw new Error("insertBefore: reference node is not a child of this node");
		}
		node.parentNode = this;
		this.childNodes.splice(index, 0, node);
	}
}

export class ServerText extends ServerNode {
	constructor(public data: string) {
		super();
	}
}

export class ServerComment extends ServerNode {
	constructor(public data: string) {
		super();
	}
}

/** Trusted markup inserted verbatim (`Html`, server-parsed `Svg` content). */
export class ServerRaw extends ServerNode {
	constructor(public html: string) {
		super();
	}
}

export class ServerElement extends ServerContainer {
	readonly localName: string;
	readonly attributes = new Map<string, string>();
	#style: ServerStyle | null = null;
	#value: string | null = null;

	constructor(tag: string) {
		super();
		this.localName = tag;
	}

	get tagName(): string {
		return this.localName.toUpperCase();
	}

	setAttribute(name: string, value: string): void {
		this.attributes.set(name, value);
	}

	getAttribute(name: string): string | null {
		return this.attributes.get(name) ?? null;
	}

	hasAttribute(name: string): boolean {
		return this.attributes.has(name);
	}

	removeAttribute(name: string): void {
		this.attributes.delete(name);
	}

	addEventListener(): void {}

	removeEventListener(): void {}

	get style(): ServerStyle {
		if (!this.#style) this.#style = new ServerStyle();
		return this.#style;
	}

	get textContent(): string {
		let text = "";
		for (const child of this.childNodes) {
			if (child instanceof ServerText) text += child.data;
			else if (child instanceof ServerElement) text += child.textContent;
		}
		return text;
	}

	set textContent(value: string) {
		for (const child of this.childNodes) child.parentNode = null;
		this.childNodes = [];
		if (value !== "") this.appendChild(new ServerText(value));
	}

	get value(): string {
		// a select reads from its options so `syncValueProp` re-applies after
		// children mount (the first write lands before any option exists)
		if (this.localName === "select") return this.#selectedOptionValue() ?? "";
		return this.#value ?? this.attributes.get("value") ?? "";
	}

	/** Reflects into serializable form per tag, so SSR output carries the value. */
	set value(next: string) {
		this.#value = next;
		if (this.localName === "input" || this.localName === "option") {
			this.setAttribute("value", this.#value);
		} else if (this.localName === "textarea") {
			this.textContent = this.#value;
		} else if (this.localName === "select") {
			this.#selectOption(this.#value);
		}
	}

	get checked(): boolean {
		return this.attributes.has("checked");
	}

	set checked(next: boolean) {
		if (next) this.setAttribute("checked", "");
		else this.removeAttribute("checked");
	}

	get htmlFor(): string {
		return this.attributes.get("for") ?? "";
	}

	set htmlFor(next: string) {
		this.setAttribute("for", next);
	}

	#selectedOptionValue(): string | null {
		const find = (parent: ServerContainer): string | null => {
			for (const child of parent.childNodes) {
				if (!(child instanceof ServerElement)) continue;
				if (child.localName === "option" && child.attributes.has("selected")) {
					return child.attributes.get("value") ?? child.textContent;
				}
				const nested = find(child);
				if (nested !== null) return nested;
			}
			return null;
		};
		return find(this);
	}

	#selectOption(value: string): void {
		const walk = (parent: ServerContainer) => {
			for (const child of parent.childNodes) {
				if (!(child instanceof ServerElement)) continue;
				if (child.localName === "option") {
					const optionValue = child.attributes.get("value") ?? child.textContent;
					if (optionValue === value) child.setAttribute("selected", "");
					else child.removeAttribute("selected");
				}
				walk(child);
			}
		};
		walk(this);
	}

	serializedStyle(): string {
		return this.#style ? serializeStyle(this.#style) : "";
	}

	/** The element's style declarations as an object, for consumers that are not html. */
	styleObject(): Record<string, string> {
		return this.#style ? styleObject(this.#style) : {};
	}
}

export class ServerDocument extends ServerContainer {
	readonly head = new ServerElement("head");
	readonly body = new ServerElement("body");
	title = "";

	constructor() {
		super();
		this.appendChild(this.head);
		this.appendChild(this.body);
	}
}

function serializeNode(node: ServerChildNode, rawText: boolean): string {
	if (node instanceof ServerText) return rawText ? node.data : escapeText(node.data);
	if (node instanceof ServerComment) return `<!--${node.data}-->`;
	if (node instanceof ServerRaw) return node.html;
	return serializeElement(node);
}

function serializeElement(el: ServerElement): string {
	const tag = el.localName;
	let attrs = "";
	for (const [name, value] of el.attributes) {
		attrs += value === "" ? ` ${name}` : ` ${name}="${escapeAttribute(value)}"`;
	}
	const style = el.serializedStyle();
	if (style && !el.attributes.has("style")) {
		attrs += ` style="${escapeAttribute(style)}"`;
	}
	if (VOID_ELEMENTS.has(tag)) return `<${tag}${attrs}>`;
	return `<${tag}${attrs}>${serializeChildren(el, RAW_TEXT_ELEMENTS.has(tag))}</${tag}>`;
}

export function serializeChildren(parent: ServerElement, rawText = false): string {
	let html = "";
	for (const child of parent.childNodes) html += serializeNode(child, rawText);
	return html;
}

/**
 * Parse trusted `<svg ...>...</svg>` markup: attributes go on a real element
 * (so `applySvgProps` can override them), inner content stays verbatim.
 * Quoted `>` inside attribute values is not supported — this backs `Svg`,
 * which is documented as trusted, fixed glyph markup.
 */
export function parseSvgRoot(source: string): ServerElement | null {
	const trimmed = source.trim();
	const fail = () => {
		console.warn("Svg: source did not parse to a root <svg> element", source);
		return null;
	};
	if (!/^<svg[\s/>]/.test(trimmed)) return fail();
	const open = trimmed.indexOf(">");
	if (open === -1) return fail();
	let attrText = trimmed.slice(4, open);
	let inner: string;
	if (open === trimmed.length - 1 && attrText.endsWith("/")) {
		attrText = attrText.slice(0, -1);
		inner = "";
	} else if (trimmed.endsWith("</svg>")) {
		inner = trimmed.slice(open + 1, -"</svg>".length);
	} else {
		return fail();
	}
	const el = new ServerElement("svg");
	for (const match of attrText.matchAll(/([^\s=/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+)))?/g)) {
		el.setAttribute(match[1]!, match[2] ?? match[3] ?? match[4] ?? "");
	}
	if (inner) el.appendChild(new ServerRaw(inner));
	return el;
}

export function createServerEnvironment(doc: ServerDocument): DomEnvironment {
	// the single place server nodes cross the environment boundary as DOM types
	/* oxlint-disable typescript/no-unsafe-type-assertion -- Server DOM shim implements the browser DomEnvironment interface. */
	return {
		createElement: (tag) => new ServerElement(tag) as unknown as HTMLElement,
		createTextNode: (data) => new ServerText(data) as unknown as Text,
		createComment: (data) => new ServerComment(data) as unknown as Comment,
		head: () => doc.head as unknown as HTMLElement,
		body: () => doc.body as unknown as HTMLElement,
		setTitle: (value) => {
			doc.title = value;
		},
		windowTarget: () => null,
		documentTarget: () => null,
		insertHtml: (html, parent, before) => {
			(parent as unknown as ServerContainer).insertBefore(
				new ServerRaw(html),
				before as unknown as ServerChildNode,
			);
		},
		createSvgRoot: (source) => parseSvgRoot(source) as unknown as SVGSVGElement | null,
	};
	/* oxlint-enable typescript/no-unsafe-type-assertion */
}
