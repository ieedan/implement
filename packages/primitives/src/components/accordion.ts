import {
    Button,
    Context,
    Div,
    Implement,
    type Child,
    type ComponentProps,
} from "@implementjs/core";

export type AccordionRootProps = ComponentProps<typeof Div> & {
    type?: "single" | "multiple";
};

const AccordionCtx = Context<AccordionState>();

class AccordionState {
    open = Implement.Set<string>();
    constructor(readonly type: AccordionRootProps["type"]) { }

    toggle(value: string) {
        const isOpen = this.open.has(value);
        if (isOpen) {
            this.open.delete(value);
        } else {
            if (this.type === "single") {
                this.open.clear();
            }
            this.open.add(value);
        }
    }
}

export function Accordion(
    { type = "single", ...restProps }: AccordionRootProps,
    ...children: Child[]
) {
    const state = new AccordionState(type);

    return AccordionCtx.Provide(state).To(
        Div({ "data-accordion-root": "", ...restProps }, ...children),
    );
}

export type AccordionItemProps = ComponentProps<typeof Div> & {
    value: string;
};

class AccordionItemState {
    constructor(
        readonly rootState: AccordionState,
        readonly value: AccordionItemProps["value"],
    ) { }

    get isOpen() {
        return this.rootState.open.bind(() => this.rootState.open.has(this.value));
    }

    get state() {
        return this.isOpen.bind((open) => (open ? "open" : "closed"));
    }

    toggle() {
        this.rootState.toggle(this.value);
    }
}

const AccordionItemCtx = Context<AccordionItemState>();

export function AccordionItem({ value, ...restProps }: AccordionItemProps, ...children: Child[]) {
    return AccordionCtx.Use((rootState) => {
        const state = new AccordionItemState(rootState, value);
        return AccordionItemCtx.Provide(state).To(
            Div({ "data-accordion-item": "", "data-state": state.state, ...restProps }, ...children),
        );
    });
}

export function AccordionTrigger(
    { ...restProps }: ComponentProps<typeof Button>,
    ...children: Child[]
) {
    return AccordionItemCtx.Use((state) => {
        return Button(
            {
                "data-accordion-trigger": "",
                "data-state": state.state,
                onClick: state.toggle,
                ...restProps,
            },
            ...children,
        );
    });
}

export type AccordionContentProps = ComponentProps<typeof Div> & {
    hiddenUntilFound?: boolean;
};

export function AccordionContent(
    { hiddenUntilFound = false, ...restProps }: AccordionContentProps,
    ...children: Child[]
) {
    return AccordionItemCtx.Use((state) => {
        return Div(
            {
                "data-accordion-content": "",
                "data-state": state.state,
                hidden: state.isOpen.bind((open) => open ? undefined : (hiddenUntilFound ? "until-found" : "")),
                ...restProps,
            },
            ...children,
        );
    });
}

export type AccordionHeaderProps = ComponentProps<typeof Div> & {
    level?: 1 | 2 | 3 | 4 | 5 | 6;
};

export function AccordionHeader(
    { level = 3, ...restProps }: AccordionHeaderProps,
    ...children: Child[]
) {
    return AccordionItemCtx.Use((state) => {
        return Div(
            {
                "data-accordion-header": "",
                "data-state": state.state,
                "data-heading-level": level.toString(),
                "aria-level": level,
                role: "heading",
                ...restProps,
            },
            ...children,
        );
    });
}
