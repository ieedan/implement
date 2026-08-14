import { useSubscribe, type Signal } from "./signal";
import type { Unsubscribe } from "./types";

export const HTML_TAGS = ["div", "button", "p"] as const;

export type HTMLTag = keyof HTMLElementTagNameMap;

type Handler<E extends keyof HTMLElementEventMap> = {
    event: E;
    handler: (ev: HTMLElementEventMap[E]) => void
}

type PropertyGetter<T, Signals extends readonly Signal<any>[]> = {
    signals: Signals;
    value: (...signals: Signals) => T;
}

type ContentOptions = {
    dangerouslySetInnerHTML?: boolean
}

export class Component<T extends keyof HTMLElementTagNameMap> {
    #id: string | null;
    #class: string | null;
    #content: { content: string; options: ContentOptions } | null;

    handlers: Handler<any>[] = []
    unsubscribers: Unsubscribe[] = [];

    #element: HTMLElement | null = null;
    #children: Component<any>[]

    constructor(readonly tag: T, ...children: Component<any>[]) {
        this.#children = children
    }

    id(id: string): this {
        this.#id = id;
        return this;
    }

    classes(classes: string): this {
        this.#class = classes;
        return this;
    }

    on<E extends keyof HTMLElementEventMap>(event: E, handler: (ev: HTMLElementEventMap[E]) => void): this {
        this.handlers.push({ event, handler })
        return this;
    }

    content<Signals extends readonly Signal<any>[] = []>(content: string | PropertyGetter<string, Signals>, opts: ContentOptions = {}): this {
        if (typeof content === 'string') {
            this.#content = { content, options: opts }
        } else {
            const unsubscribe = useSubscribe(content.signals, (values) => {
                const strContent = content.value(values);

                this.#content = { content: strContent, options: opts }

                this.setContent();
            })
            this.unsubscribers.push(unsubscribe)
        }

        return this;
    }

    private setContent() {
        if (!this.#element) return;
        if (this.#content?.options.dangerouslySetInnerHTML) {
            this.#element.innerHTML = this.#content.content
        } else {
            this.#element.innerText = this.#content?.content ?? '';
        }
    }

    mount(parent: HTMLElement) {
        this.#element = document.createElement(this.tag)
        if (this.#id) {
            this.#element.id = this.#id;
        }
        if (this.#class) {
            this.#element.className = this.#class
        }
        this.setContent();
        for (const handler of this.handlers) {
            this.#element.addEventListener(handler.event, handler.handler);
            this.unsubscribers.push(() => this.#element?.removeEventListener(handler.event, handler.handler));
        }
        parent.appendChild(this.#element);

        for (const child of this.#children) {
            child.mount(this.#element)
        }
    }

    unmount() {
        this.unsubscribers.forEach((unsubsribe) => unsubsribe());

        this.#element?.remove();
    }
}
