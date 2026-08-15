import { Component } from "../component";
import type { Mountable } from "../mountable";
import { isWritable, type Getter, type Readable, type Writable } from "../signal";

export class _select extends Component<"select"> {
	private valueProp: string | null = null;

	constructor(...components: Mountable[]) {
		super("select", ...components);
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
				"change",
				(el) => el.value,
				apply,
			);
		}

		if (isWritable<string>(valueOrGetOrSignals)) {
			return this.bindTwoWay(
				() => valueOrGetOrSignals.get(),
				(value) => valueOrGetOrSignals.set(value),
				"change",
				(el) => el.value,
				apply,
			);
		}

		return this.bindProperty(apply, valueOrGetOrSignals, setterOrGetter as Getter<string, Signals>);
	}

	protected override applyProps() {
		super.applyProps();
		this.setValue();
	}

	override mount(parent: HTMLElement) {
		super.mount(parent);
		// the bound value can't stick until the option children exist, and those
		// mount after the host element — re-apply it once they are in place
		this.setValue();
	}

	private setValue() {
		if (!this.element || this.valueProp === null) return;
		if (this.element.value === this.valueProp) return;
		this.element.value = this.valueProp;
	}
}

export function Select(...components: Mountable[]) {
	return new _select(...components);
}
