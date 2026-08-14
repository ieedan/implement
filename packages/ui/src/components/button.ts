import { Component } from "../component";
import type { Mountable } from "../mountable";
import type { Getter, Readable } from "../signal";

export type ButtonType = "submit" | "reset" | "button";

export class _button extends Component<"button"> {
	private typeValue: ButtonType | null = null;

	constructor(...components: Mountable[]) {
		super("button", ...components);
	}

	type(type: ButtonType): this;
	type(type: Readable<ButtonType>): this;
	type<Signals extends readonly Readable<any>[]>(
		signals: readonly [...Signals],
		getter: Getter<ButtonType, Signals>,
	): this;
	type<Signals extends readonly Readable<any>[]>(
		typeOrSignals: ButtonType | Readable<ButtonType> | readonly [...Signals],
		getter?: Getter<ButtonType, Signals>,
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

	protected override applyProps() {
		super.applyProps();
		this.setType();
	}

	private setType() {
		if (!this.element || this.typeValue === null) return;
		this.element.type = this.typeValue;
	}
}

export function Button(...components: Mountable[]) {
	return new _button(...components);
}
