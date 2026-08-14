import equal from "fast-deep-equal";
import { Component } from "./component";
import { subscribe, type Getter, type Signal } from "./signal";
import type { Unsubscribe } from "./types";

class _forEach<T> extends Component<"div"> {
    private signal: Signal<T[]>;
    private render: Getter<Component<any>, [Signal<[T, number]>]>;
    private unsubscribe: Unsubscribe | null = null;
    private rendered: Map<string, { component: Component<any>, value: T, index: number }> = new Map();
    constructor(signal: Signal<T[]>, render: Getter<Component<any>, [Signal<[T, number]>]>) {
        super("div");
        this.signal = signal;
        this.render = render;
    }

    // we override mount so that we don't render anything. This is essentially a fragment
    override mount(parent: HTMLElement) {
        this.unsubscribe?.();
        this.unsubscribe = subscribe([this.signal], (value) => {
            for (let i = 0; i < value.length; i++) {
                const currentVal = value[i]!;
                const child = this.render([currentVal, i]);

                const updateRendered = () =>
                    this.rendered.set(key, { component: child, index: i, value: currentVal })


                const key = (child.props.key ?? i).toString();
                const existing = this.rendered.get(key);
                if (existing) {
                    // if the position and data has not changed then we know the component doesn't need to re-render
                    if (existing.index === i && equal(existing.value, currentVal)) {
                        continue;
                    }

                    // otherwise we are going to replace the old
                    existing.component.create().replaceWith(child.create())
                    updateRendered()
                    continue;
                }

                // mount brand new it doesn't exist yet
                // however we do need to maintain order so this is will interesting

                child.mount(parent);
                updateRendered()
            }
        })
    }
}

export function ForEach<T>(signal: Signal<T[]>, render: Getter<Component<any>, [Signal<[T, number]>]>) {
    return new _forEach(signal, render);
}

class _fragment extends Component<"div"> {
    constructor(...children: Component<any>[]) {
        super("div", ...children)
    }

    // we override mount here so that we don't actually create a component and we don't do any binding
    override mount(parent: HTMLElement) {
        for (const child of this.children) {
            child.mount(parent);
        }
    }
}

export function Fragment(...children: Component<any>[]) {
    return new _fragment(...children);
}
