import { context, If, Implement, type Child, type Signal } from "@implementjs/core";
import { getId } from "../../utils";

type DismissableLayerProps = {
	open: Signal<boolean>;
	onDismiss: () => void;
};

class DismissableLayerState {
	private dismissCallbacks = new Map<string, () => void>();
	openUnsubscribe: () => void;
	constructor(
		readonly parent: DismissableLayerState | null,
		readonly opts: DismissableLayerProps & { id: string },
	) {
		this.openUnsubscribe = this.opts.open.subscribe((open) => {
			if (open) {
				this.parent?.addDismissListener(this.opts.id, () => this.dismiss());
			} else {
				this.parent?.removeDismissListener(this.opts.id);
			}
		});
	}

	addDismissListener(id: string, callback: () => void) {
		this.dismissCallbacks.set(id, callback);
	}

	removeDismissListener(id: string) {
		this.dismissCallbacks.delete(id);
	}

	private dismiss() {
		// can't dismiss if we aren't open
		if (!this.opts.open.get()) return;
		if (this.dismissCallbacks.size > 0) {
			for (const callback of this.dismissCallbacks.values()) {
				callback();
			}
			return;
		}
		this.opts.onDismiss();
	}

	onKeydown(e: KeyboardEvent) {
		if (e.key !== "Escape") return;

		this.dismiss();
	}

	dispose() {
		this.openUnsubscribe();
	}
}

const DismissableLayerCtx = context<DismissableLayerState>();

export function DismissableLayer(props: DismissableLayerProps, ...children: Child[]) {
	return DismissableLayerCtx.UseOr((parent) => {
		const state = new DismissableLayerState(parent, { ...props, id: getId() });
		return DismissableLayerCtx.Provide(state).To(
			// only register listener for the big boss
			If(parent === null).Then(
				Implement.Document({
					onKeydown: (e) => state.onKeydown(e),
				}),
			),
			...children,
		);
	}, null);
}
