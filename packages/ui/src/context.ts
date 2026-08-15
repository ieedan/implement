import { MountNode, type Mountable } from "./mountable";

class _contextProvide extends MountNode {
	constructor(
		private readonly key: symbol,
		private readonly value: unknown,
		...children: Mountable[]
	) {
		super(...children);
	}

	protected override hasContext(key: symbol): boolean {
		return key === this.key;
	}

	protected override getProvidedContext(key: symbol): unknown {
		if (key !== this.key) return undefined;
		return this.value;
	}

	mount(parent: HTMLElement) {
		this.parent = parent;
		for (const child of this.children) {
			child.mount(parent);
		}
	}
}

class _contextProvideBuilder<T> {
	constructor(
		private readonly context: Context<T>,
		private readonly value: T,
	) {}

	To(...children: Mountable[]): _contextProvide {
		return new _contextProvide(this.context.key, this.value, ...children);
	}
}

class _contextUse<T> extends MountNode {
	private child: Mountable | null = null;
	private mounted = false;

	constructor(
		private readonly context: Context<T>,
		private readonly render: (value: T) => Mountable,
		private readonly fallback?: { value: T },
	) {
		super();
	}

	mount(parent: HTMLElement) {
		this.parent = parent;
		this.mounted = true;
		this.sync();
	}

	override unmount() {
		this.mounted = false;
		super.unmount();
		this.child = null;
		this.children = [];
	}

	private sync() {
		if (!this.mounted || !this.parent) return;

		if (!this.child) {
			this.child = this.render(this.read());
			this.children = [this.child];
			this.adopt(this.child);
		}

		this.child.mount(this.parent);
	}

	private read(): T {
		const result = this.lookupProvided(this.context.key);
		if (result.found) return result.value as T;
		if (this.fallback) return this.fallback.value;
		throw new Error("Context.Use() was called without a matching Context.Provide()");
	}
}

export class Context<T> {
	readonly key = Symbol();

	Provide(value: T): _contextProvideBuilder<T> {
		return new _contextProvideBuilder(this, value);
	}

	Use(render: (value: T) => Mountable): _contextUse<T> {
		return new _contextUse(this, render);
	}

	UseOr(render: (value: T) => Mountable, fallback: T): _contextUse<T> {
		return new _contextUse(this, render, { value: fallback });
	}
}
