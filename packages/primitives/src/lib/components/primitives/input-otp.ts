import {
	context,
	derived,
	Div,
	Input,
	ref,
	signal,
	Span,
	type Child,
	type ComponentProps,
	type ElementProps,
	type Readable,
	type Ref,
	type Signal,
} from "@implementjs/core";
import { mergeProps } from "../../merge-props";
import { changeEffect, type ChangeHandler } from "../../on-change";
import { getId, toReadable } from "../../utils";
import { createComponent } from "../../create-component";

/** Matches a value made only of digits. Pass as `pattern`. */
export const REGEXP_ONLY_DIGITS = "^\\d*$";
/** Matches a value made only of letters. Pass as `pattern`. */
export const REGEXP_ONLY_CHARS = "^[a-zA-Z]*$";
/** Matches a value made only of letters and digits. Pass as `pattern`. */
export const REGEXP_ONLY_DIGITS_AND_CHARS = "^[a-zA-Z0-9]*$";

export type InputOTPRootProps = ComponentProps<typeof Div> & {
	/** The code typed so far. Pass a signal to control it from outside. */
	value?: Signal<string> | string;
	/** Runs whenever the code changes. */
	onValueChange?: ChangeHandler<string>;
	/** Runs once, when the last slot has been filled. */
	onComplete?: (value: string) => void;
	/** How many characters the code has. */
	maxLength?: number;
	/**
	 * What the whole value must match, as a RegExp or its source. A change that
	 * would break it is refused. See `REGEXP_ONLY_DIGITS` and friends.
	 */
	pattern?: RegExp | string;
	disabled?: Readable<boolean> | boolean;
	/** Submits the code with a form under this name. */
	name?: string;
	required?: boolean;
	/** Which keyboard a touch device shows. */
	inputMode?: "numeric" | "text" | "decimal" | "tel" | "search" | "email" | "url" | "none";
	/** Props for the one real `input` the slots draw. */
	inputProps?: ElementProps<"input">;
};

const InputOTPCtx = context<InputOTPState>("InputOTPCtx");

class InputOTPState {
	value: Signal<string>;
	focused = signal(false);
	disabled: Readable<boolean>;
	private regexp: RegExp | null;
	constructor(
		readonly maxLength: number,
		readonly input: Ref<HTMLInputElement>,
		value: Signal<string> | string,
		disabled: Readable<boolean> | boolean,
		pattern: RegExp | string | undefined,
		private onComplete: ((value: string) => void) | undefined,
	) {
		this.value = signal(value);
		this.disabled = toReadable(disabled);
		this.regexp = pattern === undefined ? null : new RegExp(pattern);
	}

	/** The slot the next character lands in; the last one once the code is full. */
	get activeIndex(): Readable<number> {
		return this.value.bind((value) => Math.min(value.length, this.maxLength - 1));
	}

	/** The one slot's worth of the input that is selected, so typing replaces it. */
	syncSelection() {
		const el = this.input.get();
		if (!el) return;
		const length = this.value.get().length;
		// a selection cannot reach past what the input holds
		const start = Math.min(length, this.maxLength - 1, el.value.length);
		const end = Math.min(length + 1, this.maxLength, el.value.length);
		if (el.selectionStart !== start || el.selectionEnd !== end) {
			el.setSelectionRange(start, end);
		}
	}

	onInput(el: HTMLInputElement) {
		const next = el.value.slice(0, this.maxLength);
		const previous = this.value.get();
		if (next !== previous && this.regexp && !this.regexp.test(next)) {
			el.value = previous;
			this.syncSelection();
			return;
		}
		el.value = next;
		this.value.set(next);
		this.syncSelection();
		if (next !== previous && next.length === this.maxLength) this.onComplete?.(next);
	}
}

export const InputOTP = createComponent(function InputOTP(
	{
		id = getId(),
		value = "",
		onValueChange,
		onComplete,
		maxLength = 6,
		pattern,
		disabled = false,
		name,
		required,
		inputMode = "numeric",
		inputProps,
		...restProps
	}: InputOTPRootProps,
	...children: Child[]
) {
	const input = ref<HTMLInputElement>();
	const state = new InputOTPState(maxLength, input, value, disabled, pattern, onComplete);

	return InputOTPCtx.Provide(state).To(
		...changeEffect(state.value, onValueChange),
		Div(
			mergeProps(
				{
					"data-input-otp-root": "",
					"data-disabled": state.disabled.bind((disabled) => (disabled ? "" : undefined)),
					"data-focused": state.focused.bind((focused) => (focused ? "" : undefined)),
					style: { position: "relative" },
				},
				restProps,
			),
			...children,
			Input(
				mergeProps(
					{
						id,
						this: input,
						type: "text" as const,
						name,
						required,
						inputmode: inputMode,
						autocomplete: "one-time-code" as const,
						spellcheck: false,
						maxlength: maxLength,
						pattern: typeof pattern === "string" ? undefined : pattern?.source,
						disabled: state.disabled,
						"aria-label": "One-time code",
						"data-input-otp": "",
						// one-way: the state owns what the input shows
						value: derived([state.value], (value) => value),
						// the real control sits invisibly over the slots, so taps and
						// pastes land in it and the browser does the editing
						style: {
							position: "absolute",
							inset: "0",
							width: "100%",
							height: "100%",
							opacity: "0",
							margin: "0",
							padding: "0",
							border: "0",
							background: "transparent",
							cursor: "text",
							caretColor: "transparent",
						},
						onInput: (e: Event) => {
							if (e.currentTarget instanceof HTMLInputElement) state.onInput(e.currentTarget);
						},
						onFocus: () => {
							state.focused.set(true);
							state.syncSelection();
						},
						onBlur: () => state.focused.set(false),
						onSelect: () => state.syncSelection(),
						onMouseup: () => state.syncSelection(),
						onKeyup: () => state.syncSelection(),
					},
					inputProps ?? {},
				),
			),
		),
	);
});

export type InputOTPGroupProps = ComponentProps<typeof Div>;

/** Holds a run of slots. Put a separator between groups to split the code. */
export const InputOTPGroup = createComponent(function InputOTPGroup(
	props: InputOTPGroupProps,
	...children: Child[]
) {
	return Div(mergeProps({ role: "group", "data-input-otp-group": "" }, props), ...children);
});

export type InputOTPSlotProps = ComponentProps<typeof Div> & {
	/** Zero-based position of the character this slot shows. */
	index: number;
};

/**
 * One character of the code. Anything you pass as children draws after the
 * character, inside the slot.
 */
export const InputOTPSlot = createComponent(function InputOTPSlot(
	{ index, ...restProps }: InputOTPSlotProps,
	...children: Child[]
) {
	return InputOTPCtx.Use((root) => {
		const char = root.value.bind((value) => value.charAt(index));
		const active = derived(
			[root.focused, root.activeIndex],
			(focused, activeIndex) => focused && activeIndex === index,
		);
		const caretVisible = derived([active, char], (active, char) => active && char === "");

		return Div(
			mergeProps(
				{
					"aria-hidden": true,
					"data-input-otp-slot": "",
					"data-index": index,
					"data-active": active.bind((active) => (active ? "" : undefined)),
					"data-filled": char.bind((char) => (char === "" ? undefined : "")),
					"data-disabled": root.disabled.bind((disabled) => (disabled ? "" : undefined)),
				},
				restProps,
			),
			Span({ "data-input-otp-char": "" }, char),
			Span({
				"aria-hidden": true,
				"data-input-otp-caret": "",
				"data-state": caretVisible.bind((visible) => (visible ? "visible" : "hidden")),
			}),
			...children,
		);
	});
});

export type InputOTPSeparatorProps = ComponentProps<typeof Div>;

/** A divider between groups of slots. */
export const InputOTPSeparator = createComponent(function InputOTPSeparator(
	props: InputOTPSeparatorProps,
	...children: Child[]
) {
	return Div(mergeProps({ role: "separator", "data-input-otp-separator": "" }, props), ...children);
});
