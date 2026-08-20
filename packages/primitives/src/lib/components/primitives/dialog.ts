import {
	Button,
	context,
	derived,
	Div,
	H2,
	Implement,
	P,
	Portal,
	ref,
	Ref,
	signal,
	type Bindable,
	type Child,
	type ComponentProps,
	type PortalProps,
	type Readable,
	type Signal,
} from "@implementjs/core";
import { getId, noop, type MaybeReadable } from "../../utils";
import { tabbable, trapFocus } from "../../focus";
import { mergeProps } from "../../merge-props";
import {
	DismissableLayer,
	EscapeEvent,
	InteractOutsideEvent,
	type DismissBehavior,
} from "../helpers/dismissable-layer";

// TODO: scroll locking
// TODO: nested dialogs

export type DialogRootProps = {
	open?: Signal<boolean> | boolean;
};

class DialogState {
	open: Signal<boolean>;
	currentTriggerId = signal<string | null>(null);
	triggerRefs = Implement.Map<string, DialogTriggerState>();
	content = signal<DialogContentState | null>(null);
	titleId = signal<Bindable<string> | null>(null);
	descriptionId = signal<Bindable<string> | null>(null);
	/** First trigger that registered with `default: true`, if any. */
	private defaultTriggerId: string | null = null;

	constructor(readonly opts: DialogRootProps) {
		this.open = signal(this.opts.open ?? false);
	}

	registerTrigger(triggerId: string, trigger: DialogTriggerState, isDefault = false) {
		this.triggerRefs.set(triggerId, trigger);
		if (isDefault && this.defaultTriggerId == null) this.defaultTriggerId = triggerId;

		if (this.open.get()) this.currentTriggerId.set(this.pickTrigger());
	}

	registerContent(content: DialogContentState) {
		this.content.set(content);
	}

	registerTitle(id: Bindable<string>) {
		this.titleId.set(id);
	}

	registerDescription(id: Bindable<string>) {
		this.descriptionId.set(id);
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

	close() {
		const currentTrigger = this.triggerRefs.get(this.currentTriggerId.get() ?? "");
		if (currentTrigger) {
			currentTrigger.opts.ref.get()?.focus({ preventScroll: true });
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

const DialogContext = context<DialogState>();

export function Dialog(props: DialogRootProps, ...children: Child[]) {
	const state = new DialogState(props);
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
			onInteractOutside: state.content.bind((c) => (c === null ? noop : c.opts.onInteractOutside)),
			onInteractOutsideBehavior: state.content.bind((c) =>
				c === null ? "close" : c.opts.onInteractOutsideBehavior,
			),
		},
		DialogContext.Provide(state).To(
			Implement.Lifecycle(
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
				},
				...children,
			),
		),
	);
}

export type DialogTriggerProps = Omit<ComponentProps<typeof Button>, "id"> & {
	id?: string;
	/** When the dialog starts open, return focus to this trigger instead of the first one. */
	default?: boolean;
};

class DialogTriggerState {
	constructor(
		readonly rootState: DialogState,
		readonly opts: { id: string; ref: Ref<HTMLButtonElement> },
		isDefault = false,
	) {
		this.rootState.registerTrigger(opts.id, this, isDefault);
	}

	get state() {
		return this.open.bind((open) => (open ? "open" : "closed"));
	}

	get open() {
		return derived([this.rootState.open, this.rootState.currentTriggerId], (open, current) =>
			open && current === this.opts.id ? true : false,
		);
	}

	toggle() {
		this.rootState.toggle(this.opts.id);
	}
}

export function DialogTrigger(
	{ id = getId(), default: isDefault = false, ...restProps }: DialogTriggerProps,
	...children: Child[]
) {
	return DialogContext.Use((rootState) => {
		const triggerRef = ref<HTMLButtonElement>();
		const triggerState = new DialogTriggerState(rootState, { id, ref: triggerRef }, isDefault);

		return Button(
			mergeProps(
				{
					id,
					this: triggerRef,
					type: "button",
					"data-dialog-trigger": "",
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
}

type DialogContentOptions = {
	onInteractOutside: (e: InteractOutsideEvent) => void;
	onInteractOutsideBehavior: MaybeReadable<DismissBehavior>;
	onEscape: (e: EscapeEvent) => void;
	escapeKeydownBehavior: MaybeReadable<DismissBehavior>;
};

export type DialogContentProps = ComponentProps<typeof Div> & Partial<DialogContentOptions>;

class DialogContentState {
	constructor(
		readonly rootState: DialogState,
		readonly opts: DialogContentOptions & { id: Bindable<string>; ref: Ref<HTMLDivElement> },
	) {
		rootState.registerContent(this);
	}
}

export function DialogContent(
	{
		id = getId(),
		onInteractOutside = noop,
		onInteractOutsideBehavior = "close",
		onEscape = noop,
		escapeKeydownBehavior = "close",
		...restProps
	}: DialogContentProps,
	...children: Child[]
) {
	return DialogContext.Use((rootState) => {
		const contentRef = ref<HTMLDivElement>();
		new DialogContentState(rootState, {
			id,
			ref: contentRef,
			onInteractOutside,
			onInteractOutsideBehavior,
			onEscape,
			escapeKeydownBehavior,
		});

		return Div(
			mergeProps(
				{
					id,
					this: contentRef,
					role: "dialog",
					"aria-modal": true,
					"aria-labelledby": rootState.labelledBy,
					"aria-describedby": rootState.describedBy,
					"data-dialog-content": "",
					tabIndex: -1,
					"data-state": rootState.state,
					onKeydown: (e: KeyboardEvent) => rootState.contentKeydown(e),
				},
				restProps,
			),
			...children,
		);
	});
}

export type DialogOverlayProps = ComponentProps<typeof Div>;

export function DialogOverlay(
	{ id = getId(), ...restProps }: DialogOverlayProps,
	...children: Child[]
) {
	return DialogContext.Use((rootState) => {
		return Div(
			mergeProps(
				{
					id,
					"data-dialog-overlay": "",
					"data-state": rootState.state,
				},
				restProps,
			),
			...children,
		);
	});
}

export type DialogTitleProps = ComponentProps<typeof H2>;

export function DialogTitle(
	{ id = getId(), ...restProps }: DialogTitleProps,
	...children: Child[]
) {
	return DialogContext.Use((rootState) => {
		rootState.registerTitle(id);
		return H2(
			mergeProps(
				{
					id,
					"data-dialog-title": "",
				},
				restProps,
			),
			...children,
		);
	});
}

export type DialogDescriptionProps = ComponentProps<typeof P>;

export function DialogDescription(
	{ id = getId(), ...restProps }: DialogDescriptionProps,
	...children: Child[]
) {
	return DialogContext.Use((rootState) => {
		rootState.registerDescription(id);
		return P(
			mergeProps(
				{
					id,
					"data-dialog-description": "",
				},
				restProps,
			),
			...children,
		);
	});
}

export type DialogPortalProps = PortalProps;

export const DialogPortal = Portal;

export type DialogCloseProps = ComponentProps<typeof Button>;

export function DialogClose(
	{ id = getId(), ...restProps }: DialogCloseProps,
	...children: Child[]
) {
	return DialogContext.Use((state) => {
		return Button(
			mergeProps(
				{
					id,
					type: "button",
					onClick: () => state.close(),
				},
				restProps,
			),
			...children,
		);
	});
}
