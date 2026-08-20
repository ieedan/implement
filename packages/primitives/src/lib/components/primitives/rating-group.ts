import {
	context,
	derived,
	Div,
	ref,
	signal,
	type Bindable,
	type Child,
	type ComponentProps,
	type Readable,
	type Ref,
	type Signal,
} from "@implementjs/core";
import { mergeProps } from "../../merge-props";
import { getId } from "../../utils";

export type RatingGroupRootProps = ComponentProps<typeof Div> & {
	value?: Signal<number> | number;
	min?: number;
	max?: number;
	/** Allow half-step values: pointer position picks the half, arrows move by 0.5. */
	allowHalf?: boolean;
	/** The value can be read but not changed. */
	readonly?: boolean;
	disabled?: Signal<boolean> | boolean;
	/** Preview the value under the pointer before clicking. */
	hoverPreview?: boolean;
	orientation?: "horizontal" | "vertical";
	required?: Bindable<boolean>;
};

type RatingGroupOpts = Required<
	Pick<
		RatingGroupRootProps,
		"min" | "max" | "allowHalf" | "readonly" | "hoverPreview" | "orientation"
	>
>;

const RatingGroupCtx = context<RatingGroupState>();

export type RatingGroupItemStateValue = "active" | "partial" | "inactive";

class RatingGroupState {
	value: Signal<number>;
	disabled: Signal<boolean>;
	hover = signal<number | null>(null);
	constructor(
		readonly opts: RatingGroupOpts,
		readonly ref: Ref<HTMLDivElement>,
		value: Signal<number> | number,
		disabled: Signal<boolean> | boolean,
	) {
		this.value = signal(value);
		this.disabled = signal(disabled);
	}

	/** The hover preview when there is one, the committed value otherwise. */
	get valueToUse(): Readable<number> {
		return derived([this.value, this.hover], (value, hover) => hover ?? value);
	}

	setValue(next: number) {
		if (this.opts.readonly || this.disabled.get()) return;
		this.value.set(Math.max(this.opts.min, Math.min(this.opts.max, next)));
	}

	setHover(next: number | null) {
		if (this.opts.readonly || this.disabled.get() || !this.opts.hoverPreview) return;
		this.hover.set(next === null ? null : Math.max(this.opts.min, Math.min(this.opts.max, next)));
	}

	itemState(index: number): Readable<RatingGroupItemStateValue> {
		return this.valueToUse.bind((value) => {
			const itemValue = index + 1;
			if (value >= itemValue) return "active";
			if (this.opts.allowHalf && value >= itemValue - 0.5) return "partial";
			return "inactive";
		});
	}

	/** The rating a pointer event on an item means, splitting the item in half when allowed. */
	fromPointer(index: number, e: MouseEvent): number {
		const itemValue = index + 1;
		if (!this.opts.allowHalf) return itemValue;

		const target = e.currentTarget;
		if (!(target instanceof HTMLElement)) return itemValue;
		const rect = target.getBoundingClientRect();
		const position =
			this.opts.orientation === "horizontal"
				? (e.clientX - rect.left) / rect.width
				: (e.clientY - rect.top) / rect.height;
		return position < 0.5 ? itemValue - 0.5 : itemValue;
	}

	onItemClick(index: number, e: MouseEvent) {
		if (this.opts.readonly || this.disabled.get()) return;
		const next = this.fromPointer(index, e);

		// clicking the already-chosen first step clears the rating when min is 0
		if (index === 0 && this.opts.min === 0 && this.value.get() > 0 && next === this.value.get()) {
			this.setValue(0);
		} else {
			this.setValue(next);
		}
		this.ref.get()?.focus();
	}

	onKeydown(e: KeyboardEvent) {
		if (this.opts.readonly || this.disabled.get()) return;

		const step = this.opts.allowHalf ? 0.5 : 1;
		const handlers: Record<string, () => void> = {
			ArrowUp: () => this.adjust(step),
			ArrowRight: () => this.adjust(step),
			ArrowDown: () => this.adjust(-step),
			ArrowLeft: () => this.adjust(-step),
			Home: () => this.setValue(this.opts.min),
			End: () => this.setValue(this.opts.max),
			PageUp: () => this.adjust(1),
			PageDown: () => this.adjust(-1),
		};

		const handler = handlers[e.key];
		if (handler) {
			e.preventDefault();
			this.hover.set(null);
			handler();
			return;
		}

		const num = Number.parseInt(e.key, 10);
		if (!Number.isNaN(num) && num >= this.opts.min && num <= this.opts.max) {
			e.preventDefault();
			this.hover.set(null);
			this.setValue(num);
		}
	}

	private adjust(delta: number) {
		this.setValue(this.value.get() + delta);
	}
}

export function RatingGroup(
	{
		id = getId(),
		value = 0,
		min = 0,
		max = 5,
		allowHalf = false,
		readonly = false,
		disabled = false,
		hoverPreview = true,
		orientation = "horizontal",
		required,
		...restProps
	}: RatingGroupRootProps,
	...children: Child[]
) {
	const root = ref<HTMLDivElement>();
	const state = new RatingGroupState(
		{ min, max, allowHalf, readonly, hoverPreview, orientation },
		root,
		value,
		disabled,
	);

	return RatingGroupCtx.Provide(state).To(
		Div(
			mergeProps(
				{
					id,
					this: root,
					role: "slider",
					"aria-label": "Rating",
					"aria-valuenow": state.value,
					"aria-valuemin": min,
					"aria-valuemax": max,
					"aria-valuetext": state.value.bind((value) => `${value} out of ${max}`),
					"aria-orientation": orientation,
					"aria-required": required,
					"aria-disabled": state.disabled.bind((disabled) => (disabled ? "true" : undefined)),
					"data-rating-group-root": "",
					"data-orientation": orientation,
					"data-disabled": state.disabled.bind((disabled) => (disabled ? "" : undefined)),
					"data-readonly": readonly ? "" : undefined,
					tabIndex: state.disabled.bind((disabled) => (disabled ? -1 : 0)),
					onKeydown: (e: KeyboardEvent) => state.onKeydown(e),
					onPointerleave: () => state.setHover(null),
				},
				restProps,
			),
			...children,
		),
	);
}

export type RatingGroupItemProps = ComponentProps<typeof Div> & {
	/** Zero-based position of the item; the item represents the rating `index + 1`. */
	index: number;
	disabled?: Signal<boolean> | boolean;
};

export function RatingGroupItem(
	{ id = getId(), index, disabled = false, ...restProps }: RatingGroupItemProps,
	...children: Child[]
) {
	return RatingGroupCtx.Use((root) => {
		const disabledSignal = signal(disabled);
		const isDisabled = derived([disabledSignal, root.disabled], (own, group) => own || group);
		const state = root.itemState(index);

		return Div(
			mergeProps(
				{
					id,
					// the root slider is the one control; items are visual steps
					role: "presentation",
					"data-rating-group-item": "",
					"data-value": index + 1,
					"data-orientation": root.opts.orientation,
					"data-state": state,
					"data-disabled": isDisabled.bind((disabled) => (disabled ? "" : undefined)),
					"data-readonly": root.opts.readonly ? "" : undefined,
					onClick: (e: MouseEvent) => {
						if (disabledSignal.get()) return;
						root.onItemClick(index, e);
					},
					onPointermove: (e: PointerEvent) => {
						if (disabledSignal.get() || e.pointerType === "touch") return;
						root.setHover(root.fromPointer(index, e));
					},
				},
				restProps,
			),
			...children,
		);
	});
}
