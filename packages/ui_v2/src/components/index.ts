export interface IMountable {
    mount: (parent: HTMLElement) => void;
    unmount: () => void;
}

export type Mountable = () => IMountable;

export type Child = Mountable | string; // in the future we can also accept signals with .toString() available...

export type Props = {
    children?: Child[] | Child;
    [key: string]: unknown;
};

function isChild(value: unknown): value is Child {
    return typeof value === "function" || typeof value === "string";
}

function text(content: string): Mountable {
    return () => {
        let node: Text | null = null;
        return {
            mount(parent: HTMLElement) {
                node = document.createTextNode(content);
                parent.appendChild(node);
            },
            unmount() {
                node?.remove();
                node = null;
            },
        };
    };
}

function toMountable(child: Child): Mountable {
    return typeof child === "string" ? text(child) : child;
}

export function component<T extends keyof HTMLElementTagNameMap>(tag: T, props: Props = {}, ...children: Child[]): () => Component<T> {
    return () => new Component(tag, props, ...children);
}

function reconcileChildren(props: Props, ...children: Child[]): Mountable[] {
    const fromProps = props.children
        ? Array.isArray(props.children)
            ? props.children
            : [props.children]
        : [];
    return [...fromProps, ...children].map(toMountable);
}

class Component<T extends keyof HTMLElementTagNameMap> implements IMountable {
    #element: HTMLElement | null = null;
    #tag: T;
    #props: Omit<Props, "children">;
    #children: Mountable[];
    #mountedChildren: IMountable[] = [];

    constructor(tag: T, props: Props, ...children: Child[]) {
        this.#tag = tag;
        this.#props = props;
        this.#children = reconcileChildren(props, ...children);
    }

    mount(parent: HTMLElement): void {
        this.#element = document.createElement(this.#tag);
        this.#children.forEach(child => {
            const createdChild = child();
            this.#mountedChildren.push(createdChild);
            createdChild.mount(this.#element!);
        });
        parent.appendChild(this.#element!);
    }

    unmount(): void {
        this.#mountedChildren.forEach(child => child.unmount());
        this.#element?.remove();
        this.#element = null;
    }
}

export function Fragment(...children: Child[]): Child;
export function Fragment(props: Props, ...children: Child[]): Child;
export function Fragment(propsOrChild?: Props | Child, ...children: Child[]): Child {
    return () => {
        const props = isChild(propsOrChild) || propsOrChild === undefined ? {} : propsOrChild;
        const rest = isChild(propsOrChild) ? [propsOrChild, ...children] : children;
        const childrenArray = reconcileChildren(props, ...rest);
        const mountedChildren: IMountable[] = [];
        return {
            mount: (parent: HTMLElement) => {
                childrenArray.forEach(child => {
                    const createdChild = child();
                    mountedChildren.push(createdChild);
                    createdChild.mount(parent);
                });
            },
            unmount: () => {
                mountedChildren.forEach(child => child.unmount());
            }
        }
    }
}

export function Div(...children: Child[]): () => Component<"div">;
export function Div(props: Props, ...children: Child[]): () => Component<"div">;
export function Div(propsOrChild?: Props | Child, ...children: Child[]): () => Component<"div"> {
    if (isChild(propsOrChild)) {
        return component("div", {}, propsOrChild, ...children);
    }

    return component("div", propsOrChild ?? {}, ...children);
}

export function App(options: { target: HTMLElement }) {
    const { target } = options;

    return {
        render: (...children: Child[]) => {
            children.forEach(child => toMountable(child)().mount(target));
        }
    }
}
