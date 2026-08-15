import { Component } from "../component";
import type { Mountable } from "../mountable";
import { isWritable, type Getter, type Readable, type Writable } from "../signal";

export class _textarea extends Component<"textarea"> {
	private valueProp: string | null = null;
	private placeholderValue: string | null = null;
	private rowsValue: number | null = null;

	constructor(...components: Mountable[]) {
		super("textarea", ...components);
	}

	placeholder(placeholder: string): this;
	placeholder(placeholder: Readable<string>): this;
	placeholder<Signals extends readonly Readable<any>[]>(
		signals: readonly [...Signals],
		getter: Getter<string, Signals>,
	): this;
	placeholder<Signals extends readonly Readable<any>[]>(
		placeholderOrSignals: string | Readable<string> | readonly [...Signals],
		getter?: Getter<string, Signals>,
	): this {
		return this.bindProperty(
			(placeholder) => {
				this.placeholderValue = placeholder;
				this.setPlaceholder();
			},
			placeholderOrSignals,
			getter,
		);
	}

	rows(rows: number): this;
	rows(rows: Readable<number>): this;
	rows<Signals extends readonly Readable<any>[]>(
		signals: readonly [...Signals],
		getter: Getter<number, Signals>,
	): this;
	rows<Signals extends readonly Readable<any>[]>(
		rowsOrSignals: number | Readable<number> | readonly [...Signals],
		getter?: Getter<number, Signals>,
	): this {
		return this.bindProperty(
			(rows) => {
				this.rowsValue = rows;
				this.setRows();
			},
			rowsOrSignals,
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

	protected override applyProps() {
		super.applyProps();
		this.setValue();
		this.setPlaceholder();
		this.setRows();
	}

	private setValue() {
		if (!this.element || this.valueProp === null) return;
		if (this.element.value === this.valueProp) return;
		this.element.value = this.valueProp;
	}

	private setPlaceholder() {
		if (!this.element || this.placeholderValue === null) return;
		this.element.placeholder = this.placeholderValue;
	}

	private setRows() {
		if (!this.element || this.rowsValue === null) return;
		this.element.rows = this.rowsValue;
	}
}

export function Textarea(...components: Mountable[]) {
	return new _textarea(...components);
}
