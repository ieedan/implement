// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { App, Div, ForEach, If, Implement, Key, signal, Span, type Signal } from "../src/index";

/** A hook whose promise the test resolves by hand, with the abort it saw. */
function deferred() {
	let resolve!: () => void;
	const promise = new Promise<void>((r) => {
		resolve = r;
	});
	const aborted = vi.fn();
	const hook = (signal: AbortSignal) => {
		signal.addEventListener("abort", () => aborted());
		return promise;
	};
	return { hook, resolve, aborted };
}

function mount(...children: Parameters<ReturnType<typeof App>["render"]>) {
	const target = document.createElement("div");
	document.body.appendChild(target);
	const app = App({ target });
	const unmount = app.render(...children);
	return { target, app, unmount, text: () => target.textContent };
}

/** Lets queued microtasks and settled promises run. */
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe("exit hooks", () => {
	it("removes synchronously when nothing registers a hook", () => {
		const open = signal(true);
		const { target } = mount(Div(If(open).Then(Span({ id: "leaf" }, "hi"))));

		expect(target.querySelector("#leaf")).not.toBeNull();
		open.set(false);
		// no hook: the same synchronous removal as before exits existed
		expect(target.querySelector("#leaf")).toBeNull();
	});

	it("holds the node in the DOM until the hook settles", async () => {
		const exit = deferred();
		const open = signal(true);
		const { target } = mount(
			Div(If(open).Then(Span({ id: "leaf" }, "hi", Implement.Lifecycle({ onExit: exit.hook })))),
		);

		open.set(false);
		expect(target.querySelector("#leaf")).not.toBeNull();
		await flush();
		expect(target.querySelector("#leaf")).not.toBeNull();

		exit.resolve();
		await flush();
		expect(target.querySelector("#leaf")).toBeNull();
	});

	it("defers an ancestor's removal from a hook nested deep below it", async () => {
		const exit = deferred();
		const open = signal(true);
		const { target } = mount(
			Div(
				If(open).Then(Div({ id: "outer" }, Div(Span(Implement.Lifecycle({ onExit: exit.hook }))))),
			),
		);

		open.set(false);
		expect(target.querySelector("#outer")).not.toBeNull();
		exit.resolve();
		await flush();
		expect(target.querySelector("#outer")).toBeNull();
	});

	it("keeps the leaving branch on screen while the new one mounts", async () => {
		const exit = deferred();
		const open = signal(true);
		const { target } = mount(
			Div(
				{ id: "root" },
				If(open)
					.Then(Span({ id: "yes" }, "yes", Implement.Lifecycle({ onExit: exit.hook })))
					.Else(Span({ id: "no" }, "no")),
			),
		);

		open.set(false);
		// both are up: the leaving branch first, the incoming one after it
		expect(target.querySelector("#yes")).not.toBeNull();
		expect(target.querySelector("#no")).not.toBeNull();
		expect(target.querySelector("#root")!.textContent).toBe("yesno");

		exit.resolve();
		await flush();
		expect(target.querySelector("#yes")).toBeNull();
		expect(target.querySelector("#no")).not.toBeNull();
	});

	it("tears down an exit in flight when the tree goes away", async () => {
		const exit = deferred();
		const open = signal(true);
		const { target, unmount } = mount(
			Div(If(open).Then(Span({ id: "leaf" }, Implement.Lifecycle({ onExit: exit.hook })))),
		);

		open.set(false);
		expect(target.querySelector("#leaf")).not.toBeNull();

		unmount();
		expect(exit.aborted).toHaveBeenCalled();
		expect(target.querySelector("#leaf")).toBeNull();

		// the hook settling after teardown must not resurrect anything
		exit.resolve();
		await flush();
		expect(target.querySelector("#leaf")).toBeNull();
	});

	it("runs the hook on a Key remount and holds the old instance", async () => {
		const exit = deferred();
		const version = signal(1);
		const { target } = mount(
			Div(
				{ id: "root" },
				Key(version, Span(version.bind(String), Implement.Lifecycle({ onExit: exit.hook }))),
			),
		);

		expect(target.querySelectorAll("span")).toHaveLength(1);
		version.set(2);
		// the old instance is still up alongside the fresh one
		expect(target.querySelectorAll("span")).toHaveLength(2);

		exit.resolve();
		await flush();
		expect(target.querySelectorAll("span")).toHaveLength(1);
		expect(target.querySelector("#root")!.textContent).toBe("2");
	});

	it("leaves an exiting subtree live, so its bindings keep updating", async () => {
		const exit = deferred();
		const label = signal("before");
		const open = signal(true);
		const { target } = mount(
			Div(If(open).Then(Span({ id: "leaf" }, label, Implement.Lifecycle({ onExit: exit.hook })))),
		);

		open.set(false);
		label.set("after");
		// nothing was unmounted, so the subscription is still attached: an exit
		// animation reads live data, and anything that should freeze has to be
		// snapshotted by the caller
		expect(target.querySelector("#leaf")!.textContent).toBe("after");

		exit.resolve();
		await flush();
		expect(target.querySelector("#leaf")).toBeNull();
	});
});

describe("exit hooks in ForEach", () => {
	const row = (id: string, onExit?: (signal: AbortSignal) => PromiseLike<void> | void) =>
		Span({ id: `row-${id}` }, id, onExit ? Implement.Lifecycle({ onExit }) : null);

	it("holds a removed row in the slot it left from", async () => {
		const exit = deferred();
		const items: Signal<{ id: string }[]> = signal([{ id: "a" }, { id: "b" }, { id: "c" }]);
		const { target } = mount(
			Div(
				{ id: "root" },
				ForEach(
					items,
					(item) => item.id,
					(item) => row(item.get().id, item.get().id === "b" ? exit.hook : undefined),
				),
			),
		);

		expect(target.querySelector("#root")!.textContent).toBe("abc");
		items.set([{ id: "a" }, { id: "c" }]);
		// "b" keeps its slot rather than jumping while it animates out
		expect(target.querySelector("#root")!.textContent).toBe("abc");

		exit.resolve();
		await flush();
		expect(target.querySelector("#root")!.textContent).toBe("ac");
	});

	it("revives a row whose key comes back mid-exit", async () => {
		const exit = deferred();
		const items: Signal<{ id: string }[]> = signal([{ id: "a" }, { id: "b" }]);
		const { target } = mount(
			Div(
				{ id: "root" },
				ForEach(
					items,
					(item) => item.id,
					(item) => row(item.get().id, item.get().id === "b" ? exit.hook : undefined),
				),
			),
		);

		const before = target.querySelector("#row-b");
		items.set([{ id: "a" }]);
		items.set([{ id: "a" }, { id: "b" }]);

		expect(exit.aborted).toHaveBeenCalled();
		// same node, never unmounted — no duplicate row for the key
		expect(target.querySelector("#row-b")).toBe(before);
		expect(target.querySelectorAll("#row-b")).toHaveLength(1);

		exit.resolve();
		await flush();
		expect(target.querySelector("#row-b")).toBe(before);
		expect(target.querySelector("#root")!.textContent).toBe("ab");
	});

	it("does not let a cancelled exit finish the one that follows it", async () => {
		const first = deferred();
		const second = deferred();
		let run = 0;
		const hook = (signal: AbortSignal) => (run++ === 0 ? first.hook(signal) : second.hook(signal));
		const items: Signal<{ id: string }[]> = signal([{ id: "a" }, { id: "b" }]);
		const { target } = mount(
			Div(
				{ id: "root" },
				ForEach(
					items,
					(item) => item.id,
					(item) => row(item.get().id, item.get().id === "b" ? hook : undefined),
				),
			),
		);

		items.set([{ id: "a" }]); // leaves
		items.set([{ id: "a" }, { id: "b" }]); // comes back, first exit cancelled
		items.set([{ id: "a" }]); // leaves again, second exit running

		// the cancelled run settling late must not cut the live one short
		first.resolve();
		await flush();
		expect(target.querySelector("#row-b")).not.toBeNull();

		second.resolve();
		await flush();
		expect(target.querySelector("#row-b")).toBeNull();
	});

	it("exits every removed row independently", async () => {
		const first = deferred();
		const second = deferred();
		const hooks: Record<string, (signal: AbortSignal) => PromiseLike<void> | void> = {
			a: first.hook,
			b: second.hook,
		};
		const items: Signal<{ id: string }[]> = signal([{ id: "a" }, { id: "b" }, { id: "c" }]);
		const { target } = mount(
			Div(
				{ id: "root" },
				ForEach(
					items,
					(item) => item.id,
					(item) => row(item.get().id, hooks[item.get().id]),
				),
			),
		);

		items.set([{ id: "c" }]);
		expect(target.querySelector("#root")!.textContent).toBe("abc");

		first.resolve();
		await flush();
		expect(target.querySelector("#root")!.textContent).toBe("bc");

		second.resolve();
		await flush();
		expect(target.querySelector("#root")!.textContent).toBe("c");
	});
});
