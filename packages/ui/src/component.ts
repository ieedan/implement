import { MountNode, type Mountable } from "./mountable";
import { subscribe, subscribeTracked, isReadable, type Getter, type Readable } from "./signal";
import type { Unsubscribe } from "./types";

export const HTML_TAGS = ["div", "button", "p"] as const;

export type HTMLTag = keyof HTMLElementTagNameMap;

type ElementOf<Tag extends HTMLTag> = HTMLElementTagNameMap[Tag];

/** Event with `target` / `currentTarget` narrowed to the component's element. */
type TypedEvent<E extends keyof HTMLElementEventMap, El extends HTMLElement> = Omit<
	HTMLElementEventMap[E],
	"target" | "currentTarget"
> & {
	readonly target: El;
	readonly currentTarget: El;
};

type Handler = {
	event: string;
	handler: EventListener;
};

type Props = {
	id: string | null;
	class: string | null;
	content: string | null;
	html: string | null;
	key: string | number | null;
};

export class Component<T extends keyof HTMLElementTagNameMap> extends MountNode {
	props: Props = {
		id: null,
		class: null,
		content: null,
		html: null,
		key: null,
	};

	private contentKind: "text" | "html" | null = null;

	protected handlers: Handler[] = [];
	protected pendingSubscriptions: Array<() => Unsubscribe> = [];
	protected signalUnsubscribers: Unsubscribe[] = [];
	protected eventUnsubscribers: Unsubscribe[] = [];

	element: ElementOf<T> | null = null;

	constructor(
		readonly tag: T,
		...children: Mountable[]
	) {
		super(...children);
	}

	protected override getHostElement(): HTMLElement | null {
		return this.element;
	}

	id(id: string): this;
	id(id: Readable<string>): this;
	id<Signals extends readonly Readable<any>[]>(
		signals: readonly [...Signals],
		getter: Getter<string, Signals>,
	): this;
	id<Signals extends readonly Readable<any>[]>(
		idOrSignals: string | Readable<string> | readonly [...Signals],
		getter?: Getter<string, Signals>,
	): this {
		return this.bindProperty(
			(id) => {
				this.props.id = id;
				this.setId();
			},
			idOrSignals,
			getter,
		);
	}

	key(key: string | number): this {
		this.props.key = key;
		return this;
	}

	private setId() {
		if (!this.element || this.props.id === null) return;
		this.element.id = this.props.id;
	}

	classes(classes: string): this;
	classes(classes: Readable<string>): this;
	classes<Signals extends readonly Readable<any>[]>(
		signals: readonly [...Signals],
		getter: Getter<string, Signals>,
	): this;
	classes<Signals extends readonly Readable<any>[]>(
		classesOrSignals: string | Readable<string> | readonly [...Signals],
		getter?: Getter<string, Signals>,
	): this {
		return this.bindProperty(
			(classes) => {
				this.props.class = classes;
				this.setClasses();
			},
			classesOrSignals,
			getter,
		);
	}

	private setClasses() {
		if (!this.element || this.props.class === null) return;
		this.element.className = this.props.class;
	}

	content(content: string): this;
	content(content: Readable<string>): this;
	content<Signals extends readonly Readable<any>[]>(
		signals: readonly [...Signals],
		getter: Getter<string, Signals>,
	): this;
	content<Signals extends readonly Readable<any>[]>(
		contentOrSignals: string | Readable<string> | readonly [...Signals],
		getter?: Getter<string, Signals>,
	): this {
		return this.bindProperty(
			(content) => {
				this.contentKind = "text";
				this.props.content = content;
				this.setContent();
			},
			contentOrSignals,
			getter,
		);
	}

	html(html: string): this;
	html(html: Readable<string>): this;
	html<Signals extends readonly Readable<any>[]>(
		signals: readonly [...Signals],
		getter: Getter<string, Signals>,
	): this;
	html<Signals extends readonly Readable<any>[]>(
		htmlOrSignals: string | Readable<string> | readonly [...Signals],
		getter?: Getter<string, Signals>,
	): this {
		return this.bindProperty(
			(html) => {
				this.contentKind = "html";
				this.props.html = html;
				this.setHtml();
			},
			htmlOrSignals,
			getter,
		);
	}

	private setContent() {
		if (!this.element || this.contentKind !== "text") return;
		this.element.innerText = this.props.content ?? "";
	}

	private setHtml() {
		if (!this.element || this.contentKind !== "html") return;
		this.element.innerHTML = this.props.html ?? "";
	}

	protected applyProps() {
		this.setId();
		this.setClasses();
		this.setContent();
		this.setHtml();
	}

	on<E extends keyof HTMLElementEventMap>(
		event: E,
		handler: (ev: TypedEvent<E, ElementOf<T>>) => void,
	): this {
		this.handlers.push({ event, handler: handler as EventListener });
		return this;
	}

	protected bindSignals<Signals extends readonly Readable<any>[]>(
		signals: readonly [...Signals],
		callback: Getter<void, Signals>,
	) {
		this.pendingSubscriptions.push(() => subscribe(signals, callback));
	}

	protected bindProperty<V, Signals extends readonly Readable<any>[]>(
		apply: (value: V) => void,
		valueOrReadableOrSignals: V | Readable<V> | readonly [...Signals],
		getter?: Getter<V, Signals>,
	): this {
		if (Array.isArray(valueOrReadableOrSignals)) {
			this.bindSignals(valueOrReadableOrSignals as readonly [...Signals], (...values) => {
				apply(getter!(...values));
			});
			return this;
		}

		if (isReadable<V>(valueOrReadableOrSignals)) {
			this.bindSignals([valueOrReadableOrSignals], (value) => apply(value));
			return this;
		}

		apply(valueOrReadableOrSignals as V);
		return this;
	}

	protected bindTwoWay<V>(
		get: () => V,
		set: (value: V) => void,
		event: keyof HTMLElementEventMap,
		read: (el: ElementOf<T>) => V,
		apply: (value: V) => void,
	): this {
		this.pendingSubscriptions.push(() => subscribeTracked(get, apply));
		this.on(event, () => {
			if (!this.element) return;
			set(read(this.element));
		});
		return this;
	}

	protected connectSignals() {
		this.disconnectSignals();
		for (const create of this.pendingSubscriptions) {
			this.signalUnsubscribers.push(create());
		}
	}

	protected disconnectSignals() {
		this.signalUnsubscribers.forEach((unsubscribe) => unsubscribe());
		this.signalUnsubscribers = [];
	}

	create() {
		if (this.element) return this.element;

		this.element = document.createElement(this.tag);
		this.applyProps();
		this.connectSignals();

		for (const handler of this.handlers) {
			this.element.addEventListener(handler.event, handler.handler);
			this.eventUnsubscribers.push(() =>
				this.element?.removeEventListener(handler.event, handler.handler),
			);
		}

		for (const child of this.children) {
			child.mount(this.element);
		}

		return this.element;
	}

	mount(parent: HTMLElement) {
		this.parent = parent;
		const element = this.create();

		parent.insertBefore(element, this.getInsertBeforeNode());
	}

	unmount() {
		this.disconnectSignals();
		this.eventUnsubscribers.forEach((unsubscribe) => unsubscribe());
		this.eventUnsubscribers = [];

		super.unmount();

		this.element?.remove();
		this.element = null;
	}
}
