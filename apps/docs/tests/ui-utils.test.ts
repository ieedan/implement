import { isReadable, signal } from "@implementjs/core";
import { expect, it } from "vitest";
import { buttonVariants } from "../src/lib/components/ui/button";
import { cn } from "../src/lib/utils";

/** `cn` only hands back a readable when a signal is in the list, which every test here relies on. */
function readable(value: unknown) {
	if (!isReadable(value)) throw new Error("expected a readable");
	return value;
}

it("lets a later class win over a conflicting earlier one", () => {
	expect(cn("rounded-xl border p-6", "p-2")).toBe("rounded-xl border p-2");
	expect(cn("flex flex-col gap-6", "bg-red-500")).toBe("flex flex-col gap-6 bg-red-500");
	expect(cn("p-6", undefined)).toBe("p-6");
	expect(cn("p-6", { "p-2": true, "p-8": false })).toBe("p-2");

	const hidden: boolean = false;
	expect(cn(["p-6", ["m-2", hidden && "hidden"]], "p-2")).toBe("m-2 p-2");
});

it("makes a variant table overridable", () => {
	const merged = cn(buttonVariants({ variant: "outline", size: "icon" }), "size-20");

	expect(merged).toContain("size-20");
	expect(merged).not.toContain("size-9");
});

it("stays a plain string when nothing reactive was passed", () => {
	expect(typeof cn("p-6", "m-2")).toBe("string");
	expect(isReadable(cn("p-6", signal("m-2")))).toBe(true);
});

it("re-merges when a signal changes", () => {
	const extra = signal("p-2");
	const merged = readable(cn("rounded-xl p-6", extra));
	const seen: unknown[] = [];
	merged.subscribe((value) => seen.push(value));

	expect(merged.get()).toBe("rounded-xl p-2");
	extra.set("p-10");
	expect(merged.get()).toBe("rounded-xl p-10");
	expect(seen).toEqual(["rounded-xl p-10"]);
});

it("reads a signal used as an object condition", () => {
	const open = signal(false);
	const merged = readable(cn("p-6", { "ring-2": open }));

	expect(merged.get()).toBe("p-6");
	open.set(true);
	expect(merged.get()).toBe("p-6 ring-2");
});

// The dependencies can't be settled once and kept: `class` re-walks its value on every change
// precisely because a signal can appear or disappear inside another one's value, and merging has
// to keep doing the same or it silently stops following the list it was given.
it("picks up a signal that joins the list later", () => {
	const list = signal<unknown>(["m-1"]);
	const merged = readable(cn("p-6", list));
	const seen: unknown[] = [];
	merged.subscribe((value) => seen.push(value));

	const late = signal("p-2");
	list.set(["m-1", late]);
	expect(merged.get()).toBe("m-1 p-2");

	late.set("p-10");
	expect(merged.get()).toBe("m-1 p-10");
	expect(seen.at(-1)).toBe("m-1 p-10");
});

it("drops a signal that leaves the list", () => {
	const nested = signal("p-2");
	const list = signal<unknown>(["m-1", nested]);
	const merged = readable(cn("p-6", list));
	const seen: unknown[] = [];
	merged.subscribe((value) => seen.push(value));

	expect(merged.get()).toBe("m-1 p-2");
	list.set(["m-4"]);
	expect(merged.get()).toBe("p-6 m-4");

	const before = seen.length;
	nested.set("p-99");
	expect(seen.length).toBe(before);
	expect(merged.get()).toBe("p-6 m-4");
});

it("keeps a stable signal subscribed across its own updates", () => {
	const extra = signal("p-2");
	const merged = readable(cn("p-6", extra));
	const seen: unknown[] = [];
	merged.subscribe((value) => seen.push(value));

	extra.set("p-10");
	extra.set("p-20");
	extra.set("p-30");
	expect(seen).toEqual(["p-10", "p-20", "p-30"]);
});

it("says nothing when the merged result is unchanged", () => {
	const extra = signal("p-2");
	const merged = readable(cn("p-6", extra));
	const seen: unknown[] = [];
	merged.subscribe((value) => seen.push(value));

	// a different value that merges away to the same result
	extra.set("p-2");
	expect(seen).toEqual([]);
});

it("serves more than one subscriber, and detaches on unsubscribe", () => {
	const extra = signal("p-2");
	const merged = readable(cn("p-6", extra));
	const one: unknown[] = [];
	const two: unknown[] = [];
	const off = merged.subscribe((value) => one.push(value));
	merged.subscribe((value) => two.push(value));

	extra.set("p-10");
	off();
	extra.set("p-20");

	expect(one).toEqual(["p-10"]);
	expect(two).toEqual(["p-10", "p-20"]);
});
