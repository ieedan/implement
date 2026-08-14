import { Component } from "../component";
import { isWritable, type Getter, type Readable, type Writable } from "../signal";

export type InputType =
	| "button"
	| "checkbox"
	| "color"
	| "date"
	| "datetime-local"
	| "email"
	| "file"
	| "hidden"
	| "image"
	| "month"
	| "number"
	| "password"
	| "radio"
	| "range"
	| "reset"
	| "search"
	| "submit"
	| "tel"
	| "text"
	| "time"
	| "url"
	| "week";

export class _input extends Component<"input"> {
	private typeValue: InputType | null = null;
	private valueProp: string | null = null;
	private checkedProp: boolean | null = null;

	constructor(...components: Component<any>[]) {
		super("input", ...components);
	}

	type(type: InputType): this;
	type(type: Readable<InputType>): this;
	type<Signals extends readonly Readable<any>[]>(
		signals: readonly [...Signals],
		getter: Getter<InputType, Signals>,
	): this;
	type<Signals extends readonly Readable<any>[]>(
		typeOrSignals: InputType | Readable<InputType> | readonly [...Signals],
		getter?: Getter<InputType, Signals>,
	): this {
		return this.bindProperty(
			(type) => {
				this.typeValue = type;
				this.setType();
			},
			typeOrSignals,
			getter,
		);
	}

	value(value: string): this;
	value(get: () => string, set: (value: string) => void): this;
	value(value: Writable<string>): this;
	value(value: Readable<string>): this;
	value<Signals extends readonly Readable<any>[]>(
		signals: readonly [...Signals],
		getter: Getter<string, Signals>,
	): this;
	value<Signals extends readonly Readable<any>[]>(
		valueOrGetOrSignals: string | Readable<string> | (() => string) | readonly [...Signals],
		setterOrGetter?: ((value: string) => void) | Getter<string, Signals>,
	): this {
		const apply = (value: string) => {
			this.valueProp = value;
			this.setValue();
		};

		if (typeof valueOrGetOrSignals === "function") {
			return this.bindTwoWay(
				valueOrGetOrSignals,
				setterOrGetter as (value: string) => void,
				"input",
				(el) => el.value,
				apply,
			);
		}

		if (isWritable<string>(valueOrGetOrSignals)) {
			return this.bindTwoWay(
				() => valueOrGetOrSignals.get(),
				(value) => valueOrGetOrSignals.set(value),
				"input",
				(el) => el.value,
				apply,
			);
		}

		return this.bindProperty(apply, valueOrGetOrSignals, setterOrGetter as Getter<string, Signals>);
	}

	checked(checked: boolean): this;
	checked(get: () => boolean, set: (value: boolean) => void): this;
	checked(checked: Writable<boolean>): this;
	checked(checked: Readable<boolean>): this;
	checked<Signals extends readonly Readable<any>[]>(
		signals: readonly [...Signals],
		getter: Getter<boolean, Signals>,
	): this;
	checked<Signals extends readonly Readable<any>[]>(
		checkedOrGetOrSignals: boolean | Readable<boolean> | (() => boolean) | readonly [...Signals],
		setterOrGetter?: ((value: boolean) => void) | Getter<boolean, Signals>,
	): this {
		const apply = (checked: boolean) => {
			this.checkedProp = checked;
			this.setChecked();
		};

		if (typeof checkedOrGetOrSignals === "function") {
			return this.bindTwoWay(
				checkedOrGetOrSignals,
				setterOrGetter as (value: boolean) => void,
				"change",
				(el) => el.checked,
				apply,
			);
		}

		if (isWritable<boolean>(checkedOrGetOrSignals)) {
			return this.bindTwoWay(
				() => checkedOrGetOrSignals.get(),
				(value) => checkedOrGetOrSignals.set(value),
				"change",
				(el) => el.checked,
				apply,
			);
		}

		return this.bindProperty(
			apply,
			checkedOrGetOrSignals,
			setterOrGetter as Getter<boolean, Signals>,
		);
	}

	protected override applyProps() {
		super.applyProps();
		this.setType();
		this.setValue();
		this.setChecked();
	}

	private setType() {
		if (!this.element || this.typeValue === null) return;
		this.element.type = this.typeValue;
	}

	private setValue() {
		if (!this.element || this.valueProp === null) return;
		if (this.element.value === this.valueProp) return;
		this.element.value = this.valueProp;
	}

	private setChecked() {
		if (!this.element || this.checkedProp === null) return;
		if (this.element.checked === this.checkedProp) return;
		this.element.checked = this.checkedProp;
	}
}

export function Input(...components: Component<any>[]) {
	return new _input(...components);
}
