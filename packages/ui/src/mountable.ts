export interface Mountable {
	mount(parent: HTMLElement): void;
	unmount(): void;
	getFirstDomNode(): Node | null;
}

/**
 * Shared parent/child bookkeeping for real components and fragment helpers.
 * Does not create DOM nodes.
 */
export abstract class MountNode implements Mountable {
	/** The last parent this node was mounted to */
	protected parent: HTMLElement | null = null;
	protected parentNode: MountNode | null = null;
	protected children: Mountable[];

	constructor(...children: Mountable[]) {
		this.children = children;
		for (const child of children) {
			this.adopt(child);
		}
	}

	protected adopt(child: Mountable) {
		if (child instanceof MountNode) {
			child.parentNode = this;
		}
	}

	/** True when this node provides a value for `key`. */
	protected hasContext(_key: symbol): boolean {
		return false;
	}

	protected getProvidedContext(_key: symbol): unknown {
		return undefined;
	}

	/** Walk ancestors for a matching `Provide`. Does not include this node. */
	protected lookupProvided(key: symbol): { found: true; value: unknown } | { found: false } {
		let node: MountNode | null = this.parentNode;
		while (node) {
			if (node.hasContext(key)) {
				return { found: true, value: node.getProvidedContext(key) };
			}
			node = node.parentNode;
		}
		return { found: false };
	}

	/** Real DOM element owned by this node, if any. Fragments leave this null. */
	protected getHostElement(): HTMLElement | null {
		return null;
	}

	getFirstDomNode(): Node | null {
		const host = this.getHostElement();
		if (host) return host;
		for (const child of this.children) {
			const node = child.getFirstDomNode();
			if (node) return node;
		}
		return null;
	}

	protected getInsertBeforeNode(): Node | null {
		const parent = this.parentNode;
		if (!parent) return null;

		const siblings = parent.children;
		const index = siblings.indexOf(this);
		if (index !== -1) {
			for (let i = index + 1; i < siblings.length; i++) {
				const node = siblings[i]!.getFirstDomNode();
				if (node) return node;
			}
		}

		if (parent.getHostElement()) return null;
		return parent.getInsertBeforeNode();
	}

	abstract mount(parent: HTMLElement): void;

	unmount() {
		for (const child of this.children) {
			child.unmount();
		}
		this.parent = null;
	}
}
