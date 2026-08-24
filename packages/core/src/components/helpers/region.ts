import { attachAtCursor, isHydrating } from "../../hydration";

/**
 * Put a region's end marker where the region actually ends, once its children
 * are mounted. A region is the span between a helper's children and the marker
 * that bounds them.
 *
 * A fresh mount has nothing to do here: the children were mounted against the
 * marker (see the insertion anchor in `dom`), so every node they own is
 * already ahead of it, in order.
 *
 * A hydration replay is the case this exists for. The marker goes in at the
 * claim cursor — the only position known at `mount`, before the children have
 * said how much of the serialized markup is theirs — which leaves it standing
 * ahead of the nodes they then claim. The cursor has since advanced past
 * exactly those nodes, so it is now the end of the region, and moving the
 * marker there is what makes the arrangement match a fresh mount.
 *
 * The marker moves rather than the content because a region only ever sees its
 * children through their first DOM node. Dragging that one node back would
 * take a `ForEach`'s first row and leave the others where they stood, and cut
 * an `Html` block off from the markup it delimits.
 */
export function placeRegionEnd(parent: HTMLElement, endMarker: Node | null): void {
	if (!isHydrating() || endMarker === null) return;
	attachAtCursor(parent, endMarker);
}
