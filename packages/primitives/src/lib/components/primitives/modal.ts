import {
	Button,
	context,
	derived,
	Div,
	H2,
	ImplementLifecycle,
	ImplementMap,
	P,
	ref,
	Ref,
	signal,
	type Bindable,
	type Child,
	type Readable,
	type Signal,
} from "@implementjs/core";
import { getId, LIB_PREFIX, noop, type MaybeReadable } from "../../utils";
import { tabbable, trapFocus } from "../../focus";
import { mergeProps } from "../../merge-props";
import {
	DismissableLayer,
	EscapeEvent,
	InteractOutsideEvent,
	type DismissBehavior,
} from "../helpers/dismissable-layer";
import { ScrollLock } from "../helpers/scroll-lock";
import { createComponent } from "../../create-component";
import type { RenderableProps } from "../../render";

const NESTED_COUNT_VAR = `--${LIB_PREFIX}-nested-count`;
const NESTED_LEVEL_VAR = `--${LIB_PREFIX}-nested-level`;

/** Present as an empty data attribute, or omitted. */
function presence(on: boolean): "" | undefined {
	return on ? "" : undefined;
}

/**
 * Shared modal base for Dialog and AlertDialog. The flavors differ only in
 * their data-attribute prefix, content role, and default dismiss behavior —
 * see MenuState/MenuRoot for the same pattern on the menu side.
 */
export type ModalConfig = {
	/** Data-attribute prefix, e.g. "dialog" renders `data-dialog-content`. */
	name: string;
	role: "dialog" | "alertdialog";
	/** Default for the content's `onInteractOutsideBehavior`. */
	interactOutsideBehavior: DismissBehavior;
	/**
	 * When false, nothing inside the modal closes it — Escape, the overlay, the
	 * close button, and a second click on the trigger all stop at `close()`.
	 * Writing the `open` signal from outside still does. Defaults to true, and
	 * a modal nested in one that is closing goes with it either way.
	 */
	dismissible?: boolean;
};

export type ModalRootOptions = {
	open?: Signal<boolean> | boolean;
	/** When true, the page behind cannot scroll while the modal is open. Defaults to true. */
	preventScroll?: boolean;
};

export class ModalState {
	open: Signal<boolean>;
	currentTriggerId = signal<string | null>(null);
	triggerRefs = ImplementMap<string, ModalTriggerState>();
	content = signal<ModalContentState | null>(null);
	titleId = signal<Bindable<string> | null>(null);
	descriptionId = signal<Bindable<string> | null>(null);
	/** Nearest modal this one was declared inside, if any. */
	parent: ModalState | null = null;
	/** True when this modal is nested inside another. */
	nested = signal(false);
	/** Depth in the modal stack. 0 is the outermost dialog. */
	nestedLevel = signal(0);
	/**
	 * How many open descendant modals sit above this one. Style against
	 * `data-nested-open` / `--ip-nested-count` to push this panel back in the stack.
	 */
	nestedOpenCount = signal(0);
	/** Element to focus when the modal opens, instead of the first tabbable. */
	private initialFocus: { get(): HTMLElement | null } | null = null;
	/** First trigger that registered with `default: true`, if any. */
	private defaultTriggerId: string | null = null;
	private readonly children = new Set<ModalState>();
	private openUnsub: (() => void) | null = null;

	constructor(
		readonly config: ModalConfig,
		readonly opts: ModalRootOptions,
	) {
		this.open = signal(this.opts.open ?? false);
	}

	/**
	 * Wire this modal into its parent (if any) for the lifetime of the root.
	 * Nested dialogs increment ancestors while open so parents can animate the stack.
	 */
	attach(parent: ModalState | null) {
		this.detach();
		this.parent = parent;
		this.nested.set(parent !== null);
		this.nestedLevel.set(parent ? parent.nestedLevel.get() + 1 : 0);
		parent?.children.add(this);

		if (this.open.get()) this.addToAncestors(1);

		this.openUnsub = this.open.onChange((open) => {
			if (open) {
				this.addToAncestors(1);
				return;
			}
			this.removeFromAncestors(1);
			this.closeNested();
		});
	}

	detach() {
		this.openUnsub?.();
		this.openUnsub = null;
		const n = (this.open.get() ? 1 : 0) + this.nestedOpenCount.get();
		this.removeFromAncestors(n);
		this.parent?.children.delete(this);
		this.parent = null;
		this.nested.set(false);
		this.nestedLevel.set(0);
	}

	get hasNestedOpen(): Readable<boolean> {
		return this.nestedOpenCount.bind((n) => n > 0);
	}

	/** Data attributes and CSS variable for stacking nested dialogs. */
	get nestedProps() {
		return {
			"data-nested": this.nested.bind((n) => presence(n)),
			"data-nested-open": this.hasNestedOpen.bind((on) => presence(on)),
			"data-nested-count": this.nestedOpenCount,
			"data-nested-level": this.nestedLevel,
			style: {
				[NESTED_COUNT_VAR]: this.nestedOpenCount.bind((n) => String(n)),
				[NESTED_LEVEL_VAR]: this.nestedLevel.bind((n) => String(n)),
			},
		};
	}

	private addToAncestors(n: number) {
		if (n === 0) return;
		for (let ancestor = this.parent; ancestor; ancestor = ancestor.parent) {
			ancestor.nestedOpenCount.update((count) => count + n);
		}
	}

	private removeFromAncestors(n: number) {
		if (n === 0) return;
		for (let ancestor = this.parent; ancestor; ancestor = ancestor.parent) {
			ancestor.nestedOpenCount.update((count) => Math.max(0, count - n));
		}
	}

	private closeNested() {
		for (const child of this.children) {
			// forced: a child that refuses to be dismissed still cannot outlive the
			// modal it was declared in, or its portaled panel is left on the page
			if (child.open.get()) child.forceClose(false);
		}
	}

	registerTrigger(triggerId: string, trigger: ModalTriggerState, isDefault = false) {
		this.triggerRefs.set(triggerId, trigger);
		if (isDefault && this.defaultTriggerId == null) this.defaultTriggerId = triggerId;

		if (this.open.get()) this.currentTriggerId.set(this.pickTrigger());
	}

	registerContent(content: ModalContentState) {
		this.content.set(content);
	}

	registerTitle(id: Bindable<string>) {
		this.titleId.set(id);
	}

	registerDescription(id: Bindable<string>) {
		this.descriptionId.set(id);
	}

	registerInitialFocus(el: { get(): HTMLElement | null }) {
		if (this.initialFocus === null) this.initialFocus = el;
	}

	get state() {
		return this.open.bind((open) => (open ? "open" : "closed"));
	}

	get contentEl() {
		return derived([this.content], (c) => (c === null ? null : c.opts.ref.get()));
	}

	get contentId(): Readable<Bindable<string> | undefined> {
		return this.content.bind((c) => (c === null ? undefined : c.opts.id));
	}

	get labelledBy(): Readable<Bindable<string> | undefined> {
		return this.titleId.bind((id) => id ?? undefined);
	}

	get describedBy(): Readable<Bindable<string> | undefined> {
		return this.descriptionId.bind((id) => id ?? undefined);
	}

	toggle(triggerId: string) {
		if (this.open.get() && this.currentTriggerId.get() === triggerId) {
			this.close();
			return;
		}

		this.currentTriggerId.set(triggerId);
		if (this.open.get()) return;
		this.open.set(true);
	}

	close(restoreFocus = true) {
		if (this.config.dismissible === false) return;
		this.forceClose(restoreFocus);
	}

	/** Closes regardless of `dismissible`. For the paths a modal does not get a say in. */
	forceClose(restoreFocus = true) {
		this.closeNested();
		if (restoreFocus) {
			const currentTrigger = this.triggerRefs.get(this.currentTriggerId.get() ?? "");
			currentTrigger?.opts.ref.get()?.focus({ preventScroll: true });
		}
		this.open.set(false);
		this.currentTriggerId.set(null);
	}

	/** If open with no click yet, pick the default (or first) trigger. */
	ensureTrigger() {
		if (!this.open.get()) return;
		let id = this.currentTriggerId.get();
		if (id == null || !this.triggerRefs.has(id)) {
			id = this.pickTrigger();
			this.currentTriggerId.set(id);
		}
	}

	focusContent() {
		const el = this.content.get()?.opts.ref.get();
		if (!el) return;
		const initial = this.initialFocus?.get();
		if (initial && el.contains(initial)) {
			initial.focus({ preventScroll: true });
			return;
		}
		const tabbableElements = tabbable(el);
		if (tabbableElements.length > 0) {
			tabbableElements[0]?.focus({ preventScroll: true });
			return;
		}
		el.focus({ preventScroll: true });
	}

	private pickTrigger(): string | null {
		if (this.defaultTriggerId != null && this.triggerRefs.has(this.defaultTriggerId)) {
			return this.defaultTriggerId;
		}
		return this.triggerRefs.keys().next().value ?? null;
	}

	contentKeydown(e: KeyboardEvent) {
		switch (e.key) {
			case "Tab":
				trapFocus(e, this.content.get()?.opts.ref.get());
				return;
		}
	}
}

export const ModalCtx = context<ModalState>("ModalCtx");

export function ModalRoot(state: ModalState, ...children: Child[]) {
	return ModalCtx.UseOr((parent) => {
		state.attach(parent);
		return DismissableLayer(
			{
				open: state.open,
				close: () => state.close(),
				anchors: state.triggerRefs.bind((refs) => [...refs.values()].map((t) => t.opts.ref.get())),
				content: state.contentEl,
				escapeKeydownBehavior: state.content.bind((c) =>
					c === null ? "close" : c.opts.escapeKeydownBehavior,
				),
				onEscape: state.content.bind((c) => (c === null ? noop : c.opts.onEscape)),
				onInteractOutside: state.content.bind((c) =>
					c === null ? noop : c.opts.onInteractOutside,
				),
				onInteractOutsideBehavior: state.content.bind((c) =>
					c === null ? state.config.interactOutsideBehavior : c.opts.onInteractOutsideBehavior,
				),
			},
			ScrollLock({ open: state.open, enabled: state.opts.preventScroll !== false }),
			ModalCtx.Provide(state).To(
				ImplementLifecycle(
					{
						onMount: () => {
							if (state.open.get()) {
								state.ensureTrigger();
								state.focusContent();
							}
							return state.open.onChange((open) => {
								if (open) {
									state.ensureTrigger();
									state.focusContent();
								}
							});
						},
						onUnmount: () => state.detach(),
					},
					...children,
				),
			),
		);
	}, null);
}

export type ModalTriggerProps = Omit<RenderableProps<typeof Button>, "id"> & {
	id?: string;
	/** When the modal starts open, return focus to this trigger instead of the first one. */
	default?: boolean;
};

export class ModalTriggerState {
	constructor(
		readonly rootState: ModalState,
		readonly opts: { id: string; ref: Ref<HTMLButtonElement> },
		isDefault = false,
	) {
		this.rootState.registerTrigger(opts.id, this, isDefault);
	}

	get state() {
		return this.open.bind((open) => (open ? "open" : "closed"));
	}

	get open() {
		return derived(
			[this.rootState.open, this.rootState.currentTriggerId],
			(open, current) => open && current === this.opts.id,
		);
	}

	toggle() {
		this.rootState.toggle(this.opts.id);
	}
}

export const ModalTrigger = createComponent(function ModalTrigger(
	{ id = getId(), default: isDefault = false, render = Button, ...restProps }: ModalTriggerProps,
	...children: Child[]
) {
	return ModalCtx.Use((rootState) => {
		const triggerRef = ref<HTMLButtonElement>();
		const triggerState = new ModalTriggerState(rootState, { id, ref: triggerRef }, isDefault);

		return render(
			mergeProps(
				{
					id,
					this: triggerRef,
					type: "button",
					[`data-${rootState.config.name}-trigger`]: "",
					"data-state": triggerState.state,
					"aria-haspopup": "dialog",
					"aria-expanded": triggerState.open,
					onClick: () => triggerState.toggle(),
				},
				restProps,
			),
			...children,
		);
	});
});

type ModalContentOptions = {
	onInteractOutside: (e: InteractOutsideEvent) => void;
	onInteractOutsideBehavior: MaybeReadable<DismissBehavior>;
	onEscape: (e: EscapeEvent) => void;
	escapeKeydownBehavior: MaybeReadable<DismissBehavior>;
};

export type ModalContentProps = RenderableProps<typeof Div> & Partial<ModalContentOptions>;

export class ModalContentState {
	constructor(
		readonly rootState: ModalState,
		readonly opts: ModalContentOptions & { id: Bindable<string>; ref: Ref<HTMLDivElement> },
	) {
		rootState.registerContent(this);
	}
}

export const ModalContent = createComponent(function ModalContent(
	{
		id = getId(),
		onInteractOutside = noop,
		onInteractOutsideBehavior,
		onEscape = noop,
		escapeKeydownBehavior = "close",
		render = Div,
		...restProps
	}: ModalContentProps,
	...children: Child[]
) {
	return ModalCtx.Use((rootState) => {
		const contentRef = ref<HTMLDivElement>();
		void new ModalContentState(rootState, {
			id,
			ref: contentRef,
			onInteractOutside,
			onInteractOutsideBehavior:
				onInteractOutsideBehavior ?? rootState.config.interactOutsideBehavior,
			onEscape,
			escapeKeydownBehavior,
		});

		return render(
			mergeProps(
				{
					id,
					this: contentRef,
					role: rootState.config.role,
					"aria-modal": true,
					"aria-labelledby": rootState.labelledBy,
					"aria-describedby": rootState.describedBy,
					[`data-${rootState.config.name}-content`]: "",
					tabIndex: -1,
					"data-state": rootState.state,
					onKeydown: (e: KeyboardEvent) => rootState.contentKeydown(e),
					...rootState.nestedProps,
				},
				restProps,
			),
			...children,
		);
	});
});

export type ModalOverlayProps = RenderableProps<typeof Div>;

export const ModalOverlay = createComponent(function ModalOverlay(
	{ id = getId(), render = Div, ...restProps }: ModalOverlayProps,
	...children: Child[]
) {
	return ModalCtx.Use((rootState) => {
		return render(
			mergeProps(
				{
					id,
					[`data-${rootState.config.name}-overlay`]: "",
					"data-state": rootState.state,
					...rootState.nestedProps,
				},
				restProps,
			),
			...children,
		);
	});
});

export type ModalTitleProps = RenderableProps<typeof H2>;

export const ModalTitle = createComponent(function ModalTitle(
	{ id = getId(), render = H2, ...restProps }: ModalTitleProps,
	...children: Child[]
) {
	return ModalCtx.Use((rootState) => {
		rootState.registerTitle(id);
		return render(
			mergeProps(
				{
					id,
					[`data-${rootState.config.name}-title`]: "",
				},
				restProps,
			),
			...children,
		);
	});
});

export type ModalDescriptionProps = RenderableProps<typeof P>;

export const ModalDescription = createComponent(function ModalDescription(
	{ id = getId(), render = P, ...restProps }: ModalDescriptionProps,
	...children: Child[]
) {
	return ModalCtx.Use((rootState) => {
		rootState.registerDescription(id);
		return render(
			mergeProps(
				{
					id,
					[`data-${rootState.config.name}-description`]: "",
				},
				restProps,
			),
			...children,
		);
	});
});

export type ModalCloseProps = RenderableProps<typeof Button>;

export type ModalCloseOptions = {
	/** Extra data attribute rendered on the button, e.g. "alert-dialog-cancel". */
	dataAttribute?: string;
	/** Focus this button when the modal opens instead of the first tabbable. */
	initialFocus?: boolean;
};

export function ModalClose(
	{ dataAttribute, initialFocus = false }: ModalCloseOptions,
	{ id = getId(), render = Button, ...restProps }: ModalCloseProps,
	...children: Child[]
) {
	return ModalCtx.Use((state) => {
		const closeRef = ref<HTMLButtonElement>();
		if (initialFocus) state.registerInitialFocus(closeRef);

		return render(
			mergeProps(
				{
					id,
					this: closeRef,
					type: "button",
					...(dataAttribute ? { [`data-${dataAttribute}`]: "" } : {}),
					onClick: () => state.close(),
				},
				restProps,
			),
			...children,
		);
	});
}
