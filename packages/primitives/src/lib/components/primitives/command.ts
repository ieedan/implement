import {
	A,
	context,
	derived,
	Div,
	Implement,
	Input,
	ref,
	signal,
	Span,
	type Child,
	type ComponentProps,
	type Signal,
	type Styles,
} from "@implementjs/core";
import { getId, getReadableValue, type MaybeReadable } from "../../utils";
import { mergeProps } from "../../merge-props";
import { computeCommandScore } from "../helpers/command-score";
import { createComponent } from "../../create-component";

const ITEM_SELECTOR = "[data-command-item]";
const VISIBLE_ITEM_SELECTOR = `${ITEM_SELECTOR}:not([hidden])`;
const VALID_ITEM_SELECTOR = `${VISIBLE_ITEM_SELECTOR}:not([aria-disabled="true"])`;
const GROUP_SELECTOR = "[data-command-group]";
const GROUP_ITEMS_SELECTOR = "[data-command-group-items]";
const GROUP_HEADING_SELECTOR = "[data-command-group-heading]";
const LIST_HEIGHT_VAR = "--ip-command-list-height";

/** Present as an empty data attribute, or omitted. */
function presence(on: boolean): "" | undefined {
	return on ? "" : undefined;
}

/** Immediate value from a sole string child, so items register before mount. */
function textChild(children: Child[]): string | undefined {
	if (children.length === 1 && typeof children[0] === "string") {
		const text = children[0].trim();
		if (text !== "") return text;
	}
	return undefined;
}

function itemIsDisabled(item: HTMLElement): boolean {
	return item.getAttribute("aria-disabled") === "true";
}

function findNextSibling(el: Element, selector: string): Element | undefined {
	let sibling = el.nextElementSibling;
	while (sibling) {
		if (sibling.matches(selector)) return sibling;
		sibling = sibling.nextElementSibling;
	}
	return undefined;
}

function findPreviousSibling(el: Element, selector: string): Element | undefined {
	let sibling = el.previousElementSibling;
	while (sibling) {
		if (sibling.matches(selector)) return sibling;
		sibling = sibling.previousElementSibling;
	}
	return undefined;
}

const srOnlyStyle: Styles = {
	position: "absolute",
	width: "1px",
	height: "1px",
	padding: "0",
	margin: "-1px",
	overflow: "hidden",
	clipPath: "inset(50%)",
	whiteSpace: "nowrap",
	borderWidth: "0",
};

/**
 * Scores how well an item matches the search. Return a number between 0 and
 * 1: 1 is a perfect match, 0 hides the item entirely.
 */
export type CommandFilter = (value: string, search: string, keywords?: string[]) => number;

export type CommandRootProps = ComponentProps<typeof Div> & {
	/** An accessible label for the menu. Not visible; read to screen readers. */
	label?: string;
	/** The value of the highlighted item. Pass a signal to control it from outside. */
	value?: Signal<string> | string;
	/** The search query. Pass a signal to control or observe it from outside. */
	search?: Signal<string> | string;
	/**
	 * Set to false to turn off the automatic filtering and sorting, and
	 * conditionally render valid items yourself. Defaults to true.
	 */
	shouldFilter?: boolean;
	/** Replaces the default scoring ({@link computeCommandScore}). */
	filter?: CommandFilter;
	/** When true, keyboard navigation wraps around at both ends. Defaults to false. */
	loop?: boolean;
	/** When true, moving the pointer over an item does not highlight it. Defaults to false. */
	disablePointerSelection?: boolean;
	/** Ctrl+n/j/p/k (and ctrl+h/l in a grid) move the highlight. Defaults to true. */
	vimBindings?: boolean;
	/**
	 * The number of columns the items are laid out in. Turns on grid
	 * navigation: left/right move within a row, up/down move between rows.
	 * The primitive does not lay the grid out for you; match this to your CSS.
	 */
	columns?: MaybeReadable<number | null>;
	/** When true, the initial highlight is not scrolled into view. Defaults to false. */
	disableInitialScroll?: boolean;
};

type GridCell = { index: number; firstRowOfGroup: boolean; ref: HTMLElement };

const CommandCtx = context<CommandState>();

class CommandState {
	search: Signal<string>;
	value: Signal<string>;
	/** How many items the current search leaves visible. */
	filteredCount = signal(0);
	/** Score per item value for the current search. Only meaningful while filtering. */
	scores = Implement.Map<string, number>();
	/** Groups with at least one visible item under the current search. */
	visibleGroups = Implement.Set<string>();
	labelId: string | null = null;
	root = ref<HTMLDivElement>();
	input = ref<HTMLInputElement>();
	list = ref<HTMLDivElement>();
	viewport = ref<HTMLDivElement>();
	private readonly allItems = new Set<string>();
	private readonly allGroups = new Map<string, Set<string>>();
	private readonly keywords = new Map<string, string[] | undefined>();
	private syncScheduled = false;
	private searchDirty = false;
	private initialMount = true;
	/** Child order per container before the first sort, restored when the search clears. */
	private sortSnapshot: Map<Element, Element[]> | null = null;

	constructor(
		readonly opts: Pick<
			CommandRootProps,
			| "value"
			| "search"
			| "shouldFilter"
			| "filter"
			| "loop"
			| "disablePointerSelection"
			| "vimBindings"
			| "columns"
			| "disableInitialScroll"
		>,
	) {
		this.search = signal(this.opts.search ?? "");
		this.value = signal(this.opts.value ?? "");
	}

	filterActive(search: string): boolean {
		return search !== "" && this.opts.shouldFilter !== false;
	}

	private score(value: string, keywords?: string[]): number {
		const filter = this.opts.filter ?? computeCommandScore;
		return value ? filter(value, this.search.get(), keywords) : 0;
	}

	registerItem(value: string, groupValue?: string, keywords?: string[]) {
		this.allItems.add(value);
		this.keywords.set(value, keywords);
		if (groupValue !== undefined) {
			let members = this.allGroups.get(groupValue);
			if (!members) {
				members = new Set();
				this.allGroups.set(groupValue, members);
			}
			members.add(value);
		}
		// score now so an item arriving mid-search starts with the right visibility
		if (this.filterActive(this.search.get())) {
			this.scores.set(value, this.score(value, keywords));
		}
		this.scheduleSync();
	}

	unregisterItem(value: string, groupValue?: string) {
		this.allItems.delete(value);
		this.keywords.delete(value);
		this.scores.delete(value);
		if (groupValue !== undefined) this.allGroups.get(groupValue)?.delete(value);
		this.scheduleSync();
	}

	registerGroup(value: string) {
		if (!this.allGroups.has(value)) this.allGroups.set(value, new Set());
	}

	unregisterGroup(value: string) {
		this.allGroups.delete(value);
		this.visibleGroups.delete(value);
	}

	/**
	 * Batches registrations and search changes into one pass per microtask:
	 * recompute scores, re-order the DOM, and fix up the highlight.
	 */
	scheduleSync(searchChanged = false) {
		if (searchChanged) this.searchDirty = true;
		if (this.syncScheduled) return;
		this.syncScheduled = true;
		queueMicrotask(() => {
			this.syncScheduled = false;
			this.sync();
		});
	}

	private sync() {
		// the server DOM has no querySelectorAll; hydration re-runs this on the client
		if (typeof document === "undefined") return;
		this.filterItems();
		if (this.filterActive(this.search.get())) this.sortDom();
		else this.restoreDomOrder();
		const searchChanged = this.searchDirty;
		this.searchDirty = false;

		if (this.initialMount) {
			this.initialMount = false;
			if (this.value.get() !== "") {
				// keep a provided initial value; just bring it into view
				if (this.opts.disableInitialScroll !== true) this.scrollSelectedIntoView();
				return;
			}
			this.selectFirstItem(this.opts.disableInitialScroll === true);
			return;
		}

		if (searchChanged) {
			this.selectFirstItem();
			return;
		}

		// items came or went: keep the highlight if it still points at a valid item
		const current = this.value.get();
		const stillValid =
			current !== "" &&
			this.getValidItems().some((item) => item.getAttribute("data-value") === current);
		if (!stillValid) this.selectFirstItem();
	}

	/** Recomputes every item's score and which groups still have matches. */
	private filterItems() {
		if (!this.filterActive(this.search.get())) {
			this.filteredCount.set(this.allItems.size);
			return;
		}
		this.visibleGroups.clear();
		let count = 0;
		for (const value of this.allItems) {
			const score = this.score(value, this.keywords.get(value));
			this.scores.set(value, score);
			if (score > 0) count++;
		}
		for (const [groupValue, members] of this.allGroups) {
			for (const value of members) {
				if ((this.scores.get(value) ?? 0) > 0) {
					this.visibleGroups.add(groupValue);
					break;
				}
			}
		}
		this.filteredCount.set(count);
	}

	/**
	 * Re-orders the DOM by score: items within their group (or the viewport
	 * when ungrouped), then whole groups by their best item. Groups sink below
	 * ungrouped items, matching bits-ui.
	 */
	private snapshotContainer(container: Element) {
		this.sortSnapshot ??= new Map();
		if (!this.sortSnapshot.has(container)) {
			this.sortSnapshot.set(container, Array.from(container.children));
		}
	}

	/** Puts every sorted container's children back in their pre-search order. */
	private restoreDomOrder() {
		if (!this.sortSnapshot) return;
		for (const [container, children] of this.sortSnapshot) {
			for (const child of children) {
				if (child.parentElement === container) container.appendChild(child);
			}
		}
		this.sortSnapshot = null;
	}

	private sortDom() {
		const rootEl = this.root.get();
		if (!rootEl || !this.filterActive(this.search.get())) return;
		const insertionEl = this.viewport.get() ?? this.list.get();

		const sorted = this.getValidItems().toSorted((a, b) => {
			const scoreA = this.scores.get(a.getAttribute("data-value") ?? "") ?? 0;
			const scoreB = this.scores.get(b.getAttribute("data-value") ?? "") ?? 0;
			return scoreB - scoreA;
		});

		for (const item of sorted) {
			const groupItems = item.closest(GROUP_ITEMS_SELECTOR);
			if (groupItems) {
				const node =
					item.parentElement === groupItems ? item : item.closest(`${GROUP_ITEMS_SELECTOR} > *`);
				if (node) {
					this.snapshotContainer(groupItems);
					groupItems.appendChild(node);
				}
			} else if (insertionEl) {
				const node =
					item.parentElement === insertionEl ? item : item.closest(`${GROUP_ITEMS_SELECTOR} > *`);
				if (node) {
					this.snapshotContainer(insertionEl);
					insertionEl.appendChild(node);
				}
			}
		}

		const groups = Array.from(rootEl.querySelectorAll(GROUP_SELECTOR))
			.map((el) => {
				const members = this.allGroups.get(el.getAttribute("data-value") ?? "");
				let max = 0;
				if (members) {
					for (const member of members) max = Math.max(max, this.scores.get(member) ?? 0);
				}
				return { el, max };
			})
			.toSorted((a, b) => b.max - a.max);
		for (const group of groups) {
			const parent = group.el.parentElement;
			if (!parent) continue;
			this.snapshotContainer(parent);
			parent.appendChild(group.el);
		}
	}

	getValidItems(): HTMLElement[] {
		const rootEl = this.root.get();
		if (!rootEl) return [];
		return Array.from(rootEl.querySelectorAll<HTMLElement>(VALID_ITEM_SELECTOR));
	}

	getVisibleItems(): HTMLElement[] {
		const rootEl = this.root.get();
		if (!rootEl) return [];
		return Array.from(rootEl.querySelectorAll<HTMLElement>(VISIBLE_ITEM_SELECTOR));
	}

	getSelectedItem(): HTMLElement | undefined {
		const value = this.value.get();
		if (value === "") return undefined;
		return this.getValidItems().find((item) => item.getAttribute("data-value") === value);
	}

	setValue(value: string, preventScroll = false) {
		this.value.set(value);
		if (!preventScroll) this.scrollSelectedIntoView();
	}

	private selectFirstItem(preventScroll = false) {
		const first = this.getValidItems()[0];
		this.setValue(first?.getAttribute("data-value") ?? "", preventScroll);
	}

	private scrollSelectedIntoView() {
		const item = this.getSelectedItem();
		if (!item || typeof item.scrollIntoView !== "function") return;

		const scrollHeadingIntoView = () => {
			const heading = item
				.closest(GROUP_SELECTOR)
				?.querySelector<HTMLElement>(GROUP_HEADING_SELECTOR);
			if (heading && typeof heading.scrollIntoView === "function") {
				heading.scrollIntoView({ block: "nearest" });
				return true;
			}
			return false;
		};

		if (this.isGrid()) {
			item.scrollIntoView({ block: "nearest" });
			if (this.itemIsFirstRowOfGroup(item)) scrollHeadingIntoView();
			return;
		}

		// the first item in its container drags its group heading into view too
		const container = item.parentElement;
		if (container?.firstElementChild === item && scrollHeadingIntoView()) return;
		item.scrollIntoView({ block: "nearest" });
	}

	private columns(): number | null {
		return getReadableValue(this.opts.columns ?? null);
	}

	isGrid(): boolean {
		return this.columns() != null;
	}

	/**
	 * The visible items as rows. Each group starts a new row; within a group
	 * (or the ungrouped run) rows wrap every `columns` items.
	 */
	private itemsGrid(): GridCell[][] {
		if (!this.isGrid()) return [];
		const columns = this.columns() ?? 1;
		const items = this.getVisibleItems();
		const grid: GridCell[][] = [[]];
		let currentGroup = items[0]?.getAttribute("data-group") ?? null;
		let column = 0;
		let row = 0;
		for (let i = 0; i < items.length; i++) {
			const item = items[i]!;
			const itemGroup = item.getAttribute("data-group");
			if (currentGroup !== itemGroup) {
				currentGroup = itemGroup;
				column = 1;
				row++;
				grid.push([{ index: i, firstRowOfGroup: true, ref: item }]);
			} else {
				column++;
				if (column > columns) {
					row++;
					column = 1;
					grid.push([]);
				}
				grid[row]!.push({
					index: i,
					firstRowOfGroup: grid[row]?.[0]?.firstRowOfGroup ?? i === 0,
					ref: item,
				});
			}
		}
		return grid;
	}

	private itemIsFirstRowOfGroup(item: HTMLElement): boolean {
		for (const row of this.itemsGrid()) {
			for (const cell of row) {
				if (cell.ref === item) return cell.firstRowOfGroup;
			}
		}
		return false;
	}

	private gridPosition(
		item: HTMLElement,
		grid: GridCell[][],
	): { rowIndex: number; columnIndex: number } | null {
		for (let r = 0; r < grid.length; r++) {
			const row = grid[r]!;
			for (let c = 0; c < row.length; c++) {
				if (row[c]!.ref === item) return { rowIndex: r, columnIndex: c };
			}
		}
		return null;
	}

	/**
	 * Walks rows `start` up to (excluding) `end` for the item in the expected
	 * column, skipping disabled items; a shorter row falls back to its last
	 * non-disabled item.
	 */
	private findRowItem(opts: {
		start: number;
		end: number;
		grid: GridCell[][];
		expectedColumnIndex: number;
		direction: 1 | -1;
	}): HTMLElement | null {
		const { start, end, grid, expectedColumnIndex, direction } = opts;
		for (let r = start; direction === 1 ? r < end : r >= end; r += direction) {
			const row = grid[r];
			if (row === undefined) continue;
			let newItem = row[expectedColumnIndex]?.ref ?? null;
			if (newItem !== null && itemIsDisabled(newItem)) continue;
			if (newItem === null) {
				for (let i = row.length - 1; i >= 0; i--) {
					const cell = row[i];
					if (cell === undefined || itemIsDisabled(cell.ref)) continue;
					newItem = cell.ref;
					break;
				}
			}
			return newItem;
		}
		return null;
	}

	/** How far the highlight moves through the valid items to land on `next`. */
	private offsetTo(selected: HTMLElement, next: HTMLElement | null): number {
		if (next === null) return 0;
		const items = this.getValidItems();
		return items.indexOf(next) - items.indexOf(selected);
	}

	private nextRowOffset(e: KeyboardEvent): number {
		const grid = this.itemsGrid();
		const selected = this.getSelectedItem();
		if (!selected) return 0;
		const position = this.gridPosition(selected, grid);
		if (!position) return 0;
		const loop = this.opts.loop === true;
		const skipRows = e.altKey ? 1 : 0;
		let newItem: HTMLElement | null = null;
		if (e.altKey && position.rowIndex === grid.length - 2 && !loop) {
			// skipping from the second-to-last row lands on the last row
			newItem = this.findRowItem({
				start: grid.length - 1,
				end: grid.length,
				expectedColumnIndex: position.columnIndex,
				grid,
				direction: 1,
			});
		} else if (position.rowIndex === grid.length - 1) {
			if (!loop) return 0;
			newItem = this.findRowItem({
				start: 0 + skipRows,
				end: position.rowIndex,
				expectedColumnIndex: position.columnIndex,
				grid,
				direction: 1,
			});
		} else {
			newItem = this.findRowItem({
				start: position.rowIndex + 1 + skipRows,
				end: grid.length,
				expectedColumnIndex: position.columnIndex,
				grid,
				direction: 1,
			});
			if (newItem === null && loop) {
				newItem = this.findRowItem({
					start: 0,
					end: position.rowIndex,
					expectedColumnIndex: position.columnIndex,
					grid,
					direction: 1,
				});
			}
		}
		return this.offsetTo(selected, newItem);
	}

	private previousRowOffset(e: KeyboardEvent): number {
		const grid = this.itemsGrid();
		const selected = this.getSelectedItem();
		if (!selected) return 0;
		const position = this.gridPosition(selected, grid);
		if (!position) return 0;
		const loop = this.opts.loop === true;
		const skipRows = e.altKey ? 1 : 0;
		let newItem: HTMLElement | null = null;
		if (e.altKey && position.rowIndex === 1 && !loop) {
			// skipping from the second row lands on the first row
			newItem = this.findRowItem({
				start: 0,
				end: 0,
				expectedColumnIndex: position.columnIndex,
				grid,
				direction: -1,
			});
		} else if (position.rowIndex === 0) {
			if (!loop) return 0;
			newItem = this.findRowItem({
				start: grid.length - 1 - skipRows,
				end: position.rowIndex + 1,
				expectedColumnIndex: position.columnIndex,
				grid,
				direction: -1,
			});
		} else {
			newItem = this.findRowItem({
				start: position.rowIndex - 1 - skipRows,
				end: 0,
				expectedColumnIndex: position.columnIndex,
				grid,
				direction: -1,
			});
			if (newItem === null && loop) {
				newItem = this.findRowItem({
					start: grid.length - 1,
					end: position.rowIndex + 1,
					expectedColumnIndex: position.columnIndex,
					grid,
					direction: -1,
				});
			}
		}
		return this.offsetTo(selected, newItem);
	}

	private updateSelectedToIndex(index: number) {
		const item = this.getValidItems()[index];
		if (item) this.setValue(item.getAttribute("data-value") ?? "");
	}

	private updateSelectedByItem(change: number) {
		const selected = this.getSelectedItem();
		const items = this.getValidItems();
		const index = selected ? items.indexOf(selected) : -1;
		let newSelected = items[index + change];
		if (this.opts.loop === true) {
			newSelected =
				index + change < 0
					? items[items.length - 1]
					: index + change === items.length
						? items[0]
						: items[index + change];
		}
		if (newSelected) this.setValue(newSelected.getAttribute("data-value") ?? "");
	}

	/** Moves to the first valid item of the next/previous group, falling back to the next item. */
	private updateSelectedByGroup(change: 1 | -1) {
		const selected = this.getSelectedItem();
		let group = selected?.closest(GROUP_SELECTOR);
		let item: HTMLElement | null | undefined;
		while (group && !item) {
			group =
				change > 0
					? findNextSibling(group, GROUP_SELECTOR)
					: findPreviousSibling(group, GROUP_SELECTOR);
			item = group?.querySelector<HTMLElement>(VALID_ITEM_SELECTOR);
		}
		if (item) {
			this.setValue(item.getAttribute("data-value") ?? "");
		} else {
			this.updateSelectedByItem(change);
		}
	}

	private last() {
		this.updateSelectedToIndex(this.getValidItems().length - 1);
	}

	/** Meta jumps to the last item, alt to the next group, plain to the next item. */
	private next(e: KeyboardEvent) {
		e.preventDefault();
		if (e.metaKey) this.last();
		else if (e.altKey) this.updateSelectedByGroup(1);
		else this.updateSelectedByItem(1);
	}

	/** Meta jumps to the first item, alt to the previous group, plain to the previous item. */
	private prev(e: KeyboardEvent) {
		e.preventDefault();
		if (e.metaKey) this.updateSelectedToIndex(0);
		else if (e.altKey) this.updateSelectedByGroup(-1);
		else this.updateSelectedByItem(-1);
	}

	/** Grid only: meta jumps a group down, alt skips a row, plain moves a row down. */
	private down(e: KeyboardEvent) {
		if (!this.isGrid()) return;
		e.preventDefault();
		if (e.metaKey) this.updateSelectedByGroup(1);
		else this.updateSelectedByItem(this.nextRowOffset(e));
	}

	/** Grid only: meta jumps a group up, alt skips a row, plain moves a row up. */
	private up(e: KeyboardEvent) {
		if (!this.isGrid()) return;
		e.preventDefault();
		if (e.metaKey) this.updateSelectedByGroup(-1);
		else this.updateSelectedByItem(this.previousRowOffset(e));
	}

	onKeydown(e: KeyboardEvent) {
		// something inside the list already claimed this key (a menu moving its
		// own highlight, say); moving ours too would fire both at once
		if (e.defaultPrevented) return;
		const isVim = this.opts.vimBindings !== false && e.ctrlKey;
		switch (e.key) {
			case "n":
			case "j":
				if (isVim) {
					if (this.isGrid()) this.down(e);
					else this.next(e);
				}
				break;
			case "l":
				if (isVim && this.isGrid()) this.next(e);
				break;
			case "ArrowDown":
				if (this.isGrid()) this.down(e);
				else this.next(e);
				break;
			case "ArrowRight":
				if (this.isGrid()) this.next(e);
				break;
			case "p":
			case "k":
				if (isVim) {
					if (this.isGrid()) this.up(e);
					else this.prev(e);
				}
				break;
			case "h":
				if (isVim && this.isGrid()) this.prev(e);
				break;
			case "ArrowUp":
				if (this.isGrid()) this.up(e);
				else this.prev(e);
				break;
			case "ArrowLeft":
				if (this.isGrid()) this.prev(e);
				break;
			case "Home":
				e.preventDefault();
				this.updateSelectedToIndex(0);
				break;
			case "End":
				e.preventDefault();
				this.last();
				break;
			case "Enter":
				// keyCode 229 = an IME is still composing (Safari misses isComposing)
				if (!e.isComposing && e.keyCode !== 229) {
					e.preventDefault();
					this.getSelectedItem()?.click();
				}
				break;
		}
	}
}

/**
 * A filterable command menu: an input scores every item against the search,
 * hides the misses, sorts the rest, and moves a highlight with the keyboard.
 * Composable inside a Dialog for a command palette.
 */
export const Command = createComponent(function Command(
	{
		id = getId(),
		label,
		value,
		search,
		shouldFilter,
		filter,
		loop,
		disablePointerSelection,
		vimBindings,
		columns,
		disableInitialScroll,
		...restProps
	}: CommandRootProps,
	...children: Child[]
) {
	const state = new CommandState({
		value,
		search,
		shouldFilter,
		filter,
		loop,
		disablePointerSelection,
		vimBindings,
		columns,
		disableInitialScroll,
	});
	if (label !== undefined) state.labelId = getId();
	return CommandCtx.Provide(state).To(
		Implement.Lifecycle(
			{
				onMount: () => state.search.onChange(() => state.scheduleSync(true)),
			},
			Div(
				mergeProps(
					{
						id,
						this: state.root,
						role: "application" as const,
						tabIndex: -1,
						"data-command-root": "",
						onKeydown: (e: KeyboardEvent) => state.onKeydown(e),
					},
					restProps,
				),
				label !== undefined && state.labelId !== null
					? Span({ id: state.labelId, style: srOnlyStyle, "data-command-label": "" }, label)
					: null,
				...children,
			),
		),
	);
});

export type CommandInputProps = ComponentProps<typeof Input>;

/**
 * The search box. Typing filters and re-sorts the items. Focus can stay here:
 * arrows, enter, and the vim bindings all work from the input.
 */
export const CommandInput = createComponent(function CommandInput({
	id = getId(),
	...restProps
}: CommandInputProps) {
	return CommandCtx.Use((state) => {
		const activeDescendant = derived([state.value], (value) => {
			if (value === "") return undefined;
			const item = state.getVisibleItems().find((el) => el.getAttribute("data-value") === value);
			return item?.id || undefined;
		});
		return Input(
			mergeProps(
				{
					id,
					this: state.input,
					type: "text" as const,
					"data-command-input": "",
					autocomplete: "off" as const,
					spellcheck: false,
					role: "combobox" as const,
					"aria-autocomplete": "list",
					"aria-expanded": true,
					"aria-controls": derived([state.viewport], (el) => el?.id || undefined),
					"aria-labelledby": state.labelId ?? undefined,
					"aria-activedescendant": activeDescendant,
					value: state.search,
				},
				restProps,
			),
		);
	});
});

export type CommandListProps = ComponentProps<typeof Div> & {
	/** Accessible name for the listbox. Defaults to "Suggestions". */
	label?: string;
};

/**
 * The scrollable results region. Put a {@link CommandViewport} directly
 * inside it to get `--ip-command-list-height` for height animations.
 */
export const CommandList = createComponent(function CommandList(
	{ id = getId(), label = "Suggestions", ...restProps }: CommandListProps,
	...children: Child[]
) {
	return CommandCtx.Use((state) =>
		Div(
			mergeProps(
				{
					id,
					this: state.list,
					role: "listbox" as const,
					"aria-label": label,
					"data-command-list": "",
				},
				restProps,
			),
			...children,
		),
	);
});

export type CommandViewportProps = ComponentProps<typeof Div>;

/**
 * The list's sole child, wrapping all groups and items. Its measured height
 * is written to `--ip-command-list-height` on the list.
 */
export const CommandViewport = createComponent(function CommandViewport(
	{ id = getId(), ...restProps }: CommandViewportProps,
	...children: Child[]
) {
	return CommandCtx.Use((state) =>
		Implement.Lifecycle(
			{
				onMount: () => {
					const node = state.viewport.get();
					const listEl = state.list.get();
					if (!node || !listEl || typeof ResizeObserver === "undefined") return undefined;
					let frame = 0;
					const observer = new ResizeObserver(() => {
						cancelAnimationFrame(frame);
						frame = requestAnimationFrame(() => {
							listEl.style.setProperty(LIST_HEIGHT_VAR, `${node.offsetHeight.toFixed(1)}px`);
						});
					});
					observer.observe(node);
					return () => {
						cancelAnimationFrame(frame);
						observer.disconnect();
					};
				},
			},
			Div(
				mergeProps({ id, this: state.viewport, "data-command-viewport": "" }, restProps),
				...children,
			),
		),
	);
});

export type CommandEmptyProps = ComponentProps<typeof Div> & {
	/** Render even while items match. */
	forceMount?: boolean;
};

/** Shown only when the search leaves no items visible. */
export const CommandEmpty = createComponent(function CommandEmpty(
	{ id = getId(), forceMount = false, ...restProps }: CommandEmptyProps,
	...children: Child[]
) {
	return CommandCtx.Use((state) => {
		// items register after this renders; without the ready gate the empty
		// state would flash on mount
		const ready = signal(false);
		const visible = derived(
			[state.filteredCount, ready],
			(count, isReady) => forceMount || (isReady && count === 0),
		);
		return Implement.Lifecycle(
			{ onMount: () => ready.set(true) },
			Div(
				mergeProps(
					{
						id,
						role: "presentation" as const,
						"data-command-empty": "",
						hidden: visible.bind((v) => (v ? undefined : true)),
					},
					restProps,
				),
				...children,
			),
		);
	});
});

export type CommandLoadingProps = ComponentProps<typeof Div> & {
	/** Progress between 0 and 100. */
	progress?: MaybeReadable<number>;
};

/** A progress region for async items. */
export const CommandLoading = createComponent(function CommandLoading(
	{ id = getId(), progress = 0, ...restProps }: CommandLoadingProps,
	...children: Child[]
) {
	return CommandCtx.Use(() =>
		Div(
			mergeProps(
				{
					id,
					role: "progressbar" as const,
					"aria-valuenow": progress,
					"aria-valuemin": 0,
					"aria-valuemax": 100,
					"aria-label": "Loading...",
					"data-command-loading": "",
				},
				restProps,
			),
			...children,
		),
	);
});

export type CommandSeparatorProps = ComponentProps<typeof Div> & {
	/** Keep the separator while searching. */
	forceMount?: boolean;
};

/** A divider between groups. Hidden while a search is active. */
export const CommandSeparator = createComponent(function CommandSeparator(
	{ id = getId(), forceMount = false, ...restProps }: CommandSeparatorProps,
	...children: Child[]
) {
	return CommandCtx.Use((state) => {
		const visible = derived([state.search], (search) => forceMount || search === "");
		return Div(
			mergeProps(
				{
					id,
					// role="separator" cannot belong to a role="listbox"
					"aria-hidden": true,
					"data-command-separator": "",
					hidden: visible.bind((v) => (v ? undefined : true)),
				},
				restProps,
			),
			...children,
		);
	});
});

class CommandGroupState {
	headingId = signal<string | null>(null);
	constructor(readonly value: string) {}
}

const CommandGroupCtx = context<CommandGroupState>();

export type CommandGroupProps = ComponentProps<typeof Div> & {
	/** A unique value naming the group. Defaults to the group's id. */
	value?: string;
	/** Keep the group while every item in it is filtered out. */
	forceMount?: boolean;
};

/**
 * Wraps a {@link CommandGroupHeading} and a {@link CommandGroupItems}.
 * Hidden once the search filters out every item inside it. In a grid, each
 * group starts a new row.
 */
export const CommandGroup = createComponent(function CommandGroup(
	{ id = getId(), value, forceMount = false, ...restProps }: CommandGroupProps,
	...children: Child[]
) {
	return CommandCtx.Use((state) => {
		const groupValue = value ?? getReadableValue(id);
		const group = new CommandGroupState(groupValue);
		state.registerGroup(groupValue);
		const visible = forceMount
			? null
			: derived(
					[state.search, state.visibleGroups],
					(search, groups) => !state.filterActive(search) || groups.has(groupValue),
				);
		return CommandGroupCtx.Provide(group).To(
			Implement.Lifecycle(
				{ onMount: () => () => state.unregisterGroup(groupValue) },
				Div(
					mergeProps(
						{
							id,
							role: "presentation" as const,
							"data-command-group": "",
							"data-value": groupValue,
							hidden: visible === null ? undefined : visible.bind((v) => (v ? undefined : true)),
						},
						restProps,
					),
					...children,
				),
			),
		);
	});
});

export type CommandGroupHeadingProps = ComponentProps<typeof Div>;

/** The group's visible name; the group's items point `aria-labelledby` at it. */
export const CommandGroupHeading = createComponent(function CommandGroupHeading(
	{ id = getId(), ...restProps }: CommandGroupHeadingProps,
	...children: Child[]
) {
	return CommandGroupCtx.Use((group) => {
		group.headingId.set(getReadableValue(id));
		return Div(mergeProps({ id, "data-command-group-heading": "" }, restProps), ...children);
	});
});

export type CommandGroupItemsProps = ComponentProps<typeof Div>;

/** The container for a group's items. Sets `role="group"`. */
export const CommandGroupItems = createComponent(function CommandGroupItems(
	{ id = getId(), ...restProps }: CommandGroupItemsProps,
	...children: Child[]
) {
	return CommandGroupCtx.Use((group) =>
		Div(
			mergeProps(
				{
					id,
					role: "group" as const,
					"data-command-group-items": "",
					"aria-labelledby": group.headingId.bind((headingId) => headingId ?? undefined),
				},
				restProps,
			),
			...children,
		),
	);
});

type CommandItemOptions = {
	/**
	 * A unique value used to filter and rank the item. Defaults to the item's
	 * text content; dynamic children need an explicit stable value.
	 */
	value?: string;
	/** Extra terms the filter also scores. */
	keywords?: string[];
	disabled?: Signal<boolean> | boolean;
	/** Runs when the item is chosen, by click or by Enter. */
	onSelect?: () => void;
	/** Keep the item mounted and visible regardless of the search. */
	forceMount?: boolean;
};

export type CommandItemProps = ComponentProps<typeof Div> & CommandItemOptions;

export type CommandLinkItemProps = ComponentProps<typeof A> & CommandItemOptions;

function commandItem(
	render: (props: Record<string, unknown>, ...children: Child[]) => Child,
	{
		id,
		value,
		keywords,
		disabled = false,
		onSelect,
		forceMount = false,
	}: CommandItemOptions & {
		id: string;
	},
	restProps: Record<string, unknown>,
	children: Child[],
) {
	return CommandCtx.Use((state) =>
		CommandGroupCtx.UseOr((group) => {
			const itemRef = ref<HTMLElement>();
			const disabledSignal = signal(disabled);
			const itemValue = signal(value ?? textChild(children) ?? "");
			let registered = false;

			const register = () => {
				if (forceMount || registered) return;
				const current = itemValue.get();
				if (current === "") return;
				state.registerItem(current, group?.value, keywords);
				registered = true;
			};
			register();

			const visible = forceMount
				? null
				: derived(
						[state.search, state.scores, itemValue],
						(search, scores, current) =>
							!state.filterActive(search) || (scores.get(current) ?? 0) > 0,
					);
			const selected = derived(
				[state.value, itemValue],
				(selectedValue, current) => current !== "" && selectedValue === current,
			);

			return Implement.Lifecycle(
				{
					onMount: () => {
						if (itemValue.get() === "") {
							const text = itemRef.get()?.textContent?.trim();
							if (text) {
								itemValue.set(text);
								register();
							}
						}
						return () => {
							if (registered) state.unregisterItem(itemValue.get(), group?.value);
						};
					},
				},
				render(
					mergeProps(
						{
							id,
							this: itemRef,
							role: "option" as const,
							"data-command-item": "",
							"data-value": itemValue,
							"data-group": group?.value,
							"aria-disabled": disabledSignal,
							"aria-selected": selected,
							"data-selected": selected.bind(presence),
							"data-disabled": disabledSignal.bind(presence),
							hidden: visible === null ? undefined : visible.bind((v) => (v ? undefined : true)),
							onClick: () => {
								if (disabledSignal.get()) return;
								state.setValue(itemValue.get(), true);
								onSelect?.();
							},
							onPointermove: () => {
								if (disabledSignal.get() || state.opts.disablePointerSelection === true) return;
								state.setValue(itemValue.get(), true);
							},
						},
						restProps,
					),
					...children,
				),
			);
		}, null),
	);
}

/**
 * One choice. Filtered and ranked against its `value` (or text content) plus
 * `keywords`. The highlighted item sets `data-selected`; Enter clicks it.
 */
export const CommandItem = createComponent(function CommandItem(
	{ id = getId(), value, keywords, disabled, onSelect, forceMount, ...restProps }: CommandItemProps,
	...children: Child[]
) {
	return commandItem(
		(props, ...c) => Div(props as ComponentProps<typeof Div>, ...c),
		{ id: getReadableValue(id), value, keywords, disabled, onSelect, forceMount },
		restProps,
		children,
	);
});

/** A {@link CommandItem} that renders an anchor, for items that navigate. */
export const CommandLinkItem = createComponent(function CommandLinkItem(
	{
		id = getId(),
		value,
		keywords,
		disabled,
		onSelect,
		forceMount,
		...restProps
	}: CommandLinkItemProps,
	...children: Child[]
) {
	return commandItem(
		(props, ...c) => A(props as ComponentProps<typeof A>, ...c),
		{ id: getReadableValue(id), value, keywords, disabled, onSelect, forceMount },
		restProps,
		children,
	);
});

export { computeCommandScore };
