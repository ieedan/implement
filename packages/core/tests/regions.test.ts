// @vitest-environment happy-dom
/**
 * A helper that swaps children bounds them with an end marker and only ever
 * moves each child's *first* DOM node into place. Anything a child owns past
 * that first node — a `ForEach`'s other rows, a nested branch's content — has
 * to be mounted inside the marker's span to begin with, or it is left outside
 * the region: not torn down with the branch, and in range of a sibling
 * helper's bulk removal.
 */
import { describe, expect, it } from "vitest";
import { App, Button, Div, ForEach, If, Li, Span, Switch, Ul, signal } from "../src/index";

function mount(...children: Parameters<ReturnType<typeof App>["render"]>) {
	const target = document.createElement("div");
	document.body.appendChild(target);
	const unmount = App({ target }).render(...children);
	return {
		target,
		dispose: () => {
			unmount();
			target.remove();
		},
	};
}

describe("If regions", () => {
	it("tears down every row of a ForEach in the branch it swaps away", () => {
		const open = signal(false);
		const dots = signal([1, 2, 3]);
		const { target, dispose } = mount(
			Div(
				{ id: "root" },
				If(open)
					.Then(Span({ id: "then" }, "then"))
					.Else(
						Button({ id: "trigger" }, "trigger"),
						ForEach(
							dots,
							(dot) => dot,
							(dot) => Span({ class: "dot" }, dot.bind(String)),
						),
					),
			),
		);

		expect(target.querySelectorAll(".dot")).toHaveLength(3);

		open.set(true);
		// the whole Else branch goes, not just its first node
		expect(target.querySelectorAll(".dot")).toHaveLength(0);
		expect(target.querySelector("#trigger")).toBeNull();
		expect(target.querySelector("#then")).not.toBeNull();

		open.set(false);
		expect(target.querySelectorAll(".dot")).toHaveLength(3);
		expect(target.querySelector("#then")).toBeNull();

		dispose();
	});

	it("keeps a branch's nodes together, ahead of what follows the If", () => {
		const dots = signal([1, 2]);
		const { target, dispose } = mount(
			Div(
				{ id: "root" },
				If(true).Then(
					ForEach(
						dots,
						(dot) => dot,
						(dot) => Span({ class: "dot" }, dot.bind(String)),
					),
				),
				Span({ id: "after" }, "after"),
			),
		);

		const root = target.querySelector("#root")!;
		const after = root.querySelector("#after")!;
		for (const dot of root.querySelectorAll(".dot")) {
			expect(dot.compareDocumentPosition(after) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
		}

		dots.set([1, 2, 3, 4]);
		expect(root.querySelectorAll(".dot")).toHaveLength(4);
		expect(root.lastElementChild).toBe(after);

		dispose();
	});

	it("survives a ForEach in the branch clearing its whole list", () => {
		const open = signal(false);
		const dots = signal([1, 2, 3]);
		const { target, dispose } = mount(
			Div(
				{ id: "root" },
				If(open)
					.Then(Span({ id: "then" }, "then"))
					.Else(
						ForEach(
							dots,
							(dot) => dot,
							(dot) => Span({ class: "dot" }, dot.bind(String)),
						),
					),
			),
		);

		// The bulk-clear path deletes the range from the first row to the
		// ForEach's end marker. The If's own marker must not be inside it.
		dots.set([]);
		expect(target.querySelectorAll(".dot")).toHaveLength(0);

		open.set(true);
		expect(target.querySelector("#then")).not.toBeNull();

		open.set(false);
		dots.set([7]);
		expect(target.querySelectorAll(".dot")).toHaveLength(1);
		expect(target.querySelector("#then")).toBeNull();

		dispose();
	});

	it("tears down a nested If's content with the branch that holds it", () => {
		const open = signal(true);
		const inner = signal(true);
		const { target, dispose } = mount(
			Div(
				{ id: "root" },
				If(open)
					.Then(If(inner, Span({ id: "inner" }, "inner")), Span({ id: "sibling" }, "sibling"))
					.Else(Span({ id: "else" }, "else")),
			),
		);

		expect(target.querySelector("#inner")).not.toBeNull();

		open.set(false);
		expect(target.querySelector("#inner")).toBeNull();
		expect(target.querySelector("#sibling")).toBeNull();

		open.set(true);
		expect(target.querySelector("#inner")).not.toBeNull();
		expect(target.querySelector("#sibling")).not.toBeNull();

		dispose();
	});
});

describe("ForEach rows", () => {
	it("keeps a row that owns more than one node in one piece", () => {
		const rows = signal(["a"]);
		const { target, dispose } = mount(
			Div(
				{ id: "root" },
				ForEach(
					rows,
					(row) => row,
					(row) => If(true, Span({ class: "label" }, row), Span({ class: "tail" }, "!")),
				),
			),
		);

		const root = target.querySelector("#root")!;
		const label = root.querySelector(".label")!;
		const tail = root.querySelector(".tail")!;
		// the row reports its first node; ordering the list must not walk off with
		// that node alone and leave the rest of the row behind
		expect(label.nextElementSibling).toBe(tail);

		dispose();
	});
});

describe("Switch regions", () => {
	it("tears down every row of a ForEach in the case it swaps away", () => {
		const which = signal("list");
		const rows = signal(["a", "b", "c"]);
		const { target, dispose } = mount(
			Ul(
				{ id: "root" },
				Switch(which)
					.Case(
						"list",
						ForEach(
							rows,
							(row) => row,
							(row) => Li({ class: "row" }, row),
						),
					)
					.Default(Li({ id: "empty" }, "empty")),
			),
		);

		expect(target.querySelectorAll(".row")).toHaveLength(3);

		which.set("other");
		expect(target.querySelectorAll(".row")).toHaveLength(0);
		expect(target.querySelector("#empty")).not.toBeNull();

		which.set("list");
		expect(target.querySelectorAll(".row")).toHaveLength(3);
		expect(target.querySelector("#empty")).toBeNull();

		dispose();
	});
});
