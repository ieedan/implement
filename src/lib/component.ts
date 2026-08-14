import { subscribe, Signal, type Getter, type Readable } from "./signal";
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

type ContentOptions = {
	dangerouslySetInnerHTML?: boolean;
};

type Props = {
	id: string | null;
	class: string | null;
	content: string | null;
	contentOptions: ContentOptions;
	key: string | number | null;
};

export class Component<T extends keyof HTMLElementTagNameMap> {
	props: Props = {
		id: null,
		class: null,
		content: null,
		contentOptions: {},
		key: null,
	};

	protected handlers: Handler[] = [];
	protected pendingSubscriptions: Array<() => Unsubscribe> = [];
	protected signalUnsubscribers: Unsubscribe[] = [];
	protected eventUnsubscribers: Unsubscribe[] = [];

	/** The last parent this element was mounted to */
	protected parent: HTMLElement | null = null;
	protected parentComponent: Component<any> | null = null;
	element: HTMLElement | null = null;
	protected children: Component<any>[];

	constructor(
		readonly tag: T,
		...children: Component<any>[]
	) {
		this.children = children;
		for (const child of children) {
			this.adopt(child);
		}
	}

	protected adopt(child: Component<any>) {
		child.parentComponent = this;
	}

	getFirstDomNode(): Node | null {
		if (this.element) return this.element;
		for (const child of this.children) {
			const node = child.getFirstDomNode();
			if (node) return node;
		}
		return null;
	}

	protected getInsertBeforeNode(): Node | null {
		const parent = this.parentComponent;
		if (!parent) return null;

		const siblings = parent.children;
		const index = siblings.indexOf(this);
		if (index !== -1) {
			for (let i = index + 1; i < siblings.length; i++) {
				const node = siblings[i]!.getFirstDomNode();
				if (node) return node;
			}
		}

		if (parent.element) return null;
		return parent.getInsertBeforeNode();
	}

	id(id: string): this;
	id<Signals extends readonly Signal<any>[]>(
		signals: readonly [...Signals],
		getter: Getter<string, Signals>,
	): this;
	id<Signals extends readonly Signal<any>[]>(
		idOrSignals: string | readonly [...Signals],
		getter?: Getter<string, Signals>,
	): this {
		if (typeof idOrSignals === "string") {
			this.props.id = idOrSignals;
			return this;
		}

		this.bindSignals(idOrSignals, (...values) => {
			this.props.id = getter!(...values);
			this.setId();
		});
		return this;
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
	classes<Signals extends readonly Signal<any>[]>(
		signals: readonly [...Signals],
		getter: Getter<string, Signals>,
	): this;
	classes<Signals extends readonly Signal<any>[]>(
		classesOrSignals: string | readonly [...Signals],
		getter?: Getter<string, Signals>,
	): this {
		if (typeof classesOrSignals === "string") {
			this.props.class = classesOrSignals;
			return this;
		}

		this.bindSignals(classesOrSignals, (...values) => {
			this.props.class = getter!(...values);
			this.setClasses();
		});
		return this;
	}

	private setClasses() {
		if (!this.element || this.props.class === null) return;
		this.element.className = this.props.class;
	}

	content(content: string, opts?: ContentOptions): this;
	content(content: Readable<string>, opts?: ContentOptions): this;
	content<Signals extends readonly Readable<any>[]>(
		signals: readonly [...Signals],
		getter: Getter<string, Signals>,
		opts?: ContentOptions,
	): this;
	content<Signals extends readonly Readable<any>[]>(
		contentOrSignals: string | Readable<string> | readonly [...Signals],
		getterOrOpts?: Getter<string, Signals> | ContentOptions,
		opts: ContentOptions = {},
	): this {
		if (typeof contentOrSignals === "string") {
			this.props.content = contentOrSignals;
			this.props.contentOptions = (getterOrOpts as ContentOptions | undefined) ?? {};
			return this;
		}

		if (!Array.isArray(contentOrSignals)) {
			const readable = contentOrSignals as Readable<string>;
			const contentOpts = (getterOrOpts as ContentOptions | undefined) ?? {};
			this.bindSignals([readable], (value) => {
				this.props.content = value;
				this.props.contentOptions = contentOpts;
				this.setContent();
			});
			return this;
		}

		const signals = contentOrSignals as readonly [...Signals];
		const getter = getterOrOpts as Getter<string, Signals>;
		this.bindSignals(signals, (...values) => {
			this.props.content = getter(...values);
			this.props.contentOptions = opts;
			this.setContent();
		});
		return this;
	}

	private setContent() {
		if (!this.element) return;
		if (this.props.contentOptions.dangerouslySetInnerHTML) {
			this.element.innerHTML = this.props.content ?? "";
		} else {
			this.element.innerText = this.props.content ?? "";
		}
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
		this.setId();
		this.setClasses();
		this.setContent();
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

		for (const child of this.children) {
			child.unmount();
		}

		this.element?.remove();
		this.element = null;
	}
}
