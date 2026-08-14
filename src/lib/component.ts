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
};

export class Component<T extends keyof HTMLElementTagNameMap> {
	#props: Props = {
		id: null,
		class: null,
		content: null,
		contentOptions: {},
	};

	handlers: Handler[] = [];
	signalUnsubscribers: Unsubscribe[] = [];
	eventUnsubscribers: Unsubscribe[] = [];

	renderConditions: boolean[] = [];

	/** The last parent this element was mounted to */
	#parent: HTMLElement | null = null;
	#element: HTMLElement | null = null;
	#children: Component<any>[];

	constructor(
		readonly tag: T,
		...children: Component<any>[]
	) {
		this.#children = children;
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
			this.#props.id = idOrSignals;
			return this;
		}

		this.signalUnsubscribers.push(
			subscribe(idOrSignals, (...values) => {
				this.#props.id = getter!(...values);
				this.setId();
			}),
		);
		return this;
	}

	private setId() {
		if (!this.#element || this.#props.id === null) return;
		this.#element.id = this.#props.id;
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
			this.#props.class = classesOrSignals;
			return this;
		}

		this.signalUnsubscribers.push(
			subscribe(classesOrSignals, (...values) => {
				this.#props.class = getter!(...values);
				this.setClasses();
			}),
		);
		return this;
	}

	private setClasses() {
		if (!this.#element || this.#props.class === null) return;
		this.#element.className = this.#props.class;
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
			this.#props.content = contentOrSignals;
			this.#props.contentOptions = (getterOrOpts as ContentOptions | undefined) ?? {};
			return this;
		}

		if (!Array.isArray(contentOrSignals)) {
			const readable = contentOrSignals as Readable<string>;
			const contentOpts = (getterOrOpts as ContentOptions | undefined) ?? {};
			this.signalUnsubscribers.push(
				subscribe([readable], (value) => {
					this.#props.content = value;
					this.#props.contentOptions = contentOpts;
					this.setContent();
				}),
			);
			return this;
		}

		const signals = contentOrSignals as readonly [...Signals];
		const getter = getterOrOpts as Getter<string, Signals>;
		this.signalUnsubscribers.push(
			subscribe(signals, (...values) => {
				this.#props.content = getter(...values);
				this.#props.contentOptions = opts;
				this.setContent();
			}),
		);
		return this;
	}

	private setContent() {
		if (!this.#element) return;
		if (this.#props.contentOptions.dangerouslySetInnerHTML) {
			this.#element.innerHTML = this.#props.content ?? "";
		} else {
			this.#element.innerText = this.#props.content ?? "";
		}
	}

	on<E extends keyof HTMLElementEventMap>(
		event: E,
		handler: (ev: TypedEvent<E, ElementOf<T>>) => void,
	): this {
		this.handlers.push({ event, handler: handler as EventListener });
		return this;
	}

	renderIf(signal: Signal<boolean>): this;
	renderIf<Signals extends readonly Signal<any>[]>(
		signals: readonly [...Signals],
		getter: Getter<boolean, Signals>,
	): this;
	renderIf<Signals extends readonly Signal<any>[]>(
		signalOrSignals: Signal<boolean> | readonly [...Signals],
		getter?: Getter<boolean, Signals>,
	): this {
		if (signalOrSignals instanceof Signal) {
			return this.renderIf([signalOrSignals], (value) => value);
		}

		const index = this.renderConditions.length;
		this.renderConditions.push(false);
		this.signalUnsubscribers.push(
			subscribe(signalOrSignals, (...values) => {
				this.renderConditions[index] = getter!(...values);

				if (this.shouldRender && this.isNotRendered) {
					if (this.#parent) this.mount(this.#parent);
				} else if (this.isRendered && this.shouldNotRender) {
					this.unmount({ disconnectSignals: false });
				}
			}),
		);

		return this;
	}

	private get shouldRender() {
		return this.renderConditions.reduce((prev, curr) => prev && curr, true);
	}

	private get shouldNotRender() {
		return !this.shouldRender;
	}

	private get isRendered() {
		return this.#element !== null;
	}

	private get isNotRendered() {
		return !this.isRendered;
	}

	mount(parent: HTMLElement) {
		this.#parent = parent;
		if (this.shouldNotRender) return;
		this.#element = document.createElement(this.tag);
		this.setId();
		this.setClasses();
		this.setContent();

		for (const handler of this.handlers) {
			this.#element.addEventListener(handler.event, handler.handler);
			this.eventUnsubscribers.push(() =>
				this.#element?.removeEventListener(handler.event, handler.handler),
			);
		}

		this.#parent.appendChild(this.#element);

		for (const child of this.#children) {
			child.mount(this.#element);
		}
	}

	unmount({ disconnectSignals = true }: { disconnectSignals?: boolean } = {}) {
		this.eventUnsubscribers.forEach((unsubscribe) => unsubscribe());

		if (disconnectSignals) this.signalUnsubscribers.forEach((unsubscribe) => unsubscribe());

		this.#element?.remove();

		this.#element = null;
	}
}
