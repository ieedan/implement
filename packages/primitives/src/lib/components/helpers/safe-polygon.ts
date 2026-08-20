import type { Side } from "./floating-ui";

type Point = [number, number];

export type SafePolygonOptions = {
	/** Runs when the pointer leaves every safe zone between the trigger and content. */
	onPointerExit: () => void;
	/** Extra padding in pixels around the safe zones. */
	buffer?: number;
	/**
	 * How long the pointer may sit still inside a safe zone (in ms) before it
	 * stops counting as "on the way" and the exit fires anyway.
	 */
	transitIntentTimeout?: number;
	/**
	 * Nodes that should not trigger an exit when the pointer leaves toward them,
	 * e.g. sibling triggers that will take over the tooltip instantly.
	 */
	ignoredTargets?: () => HTMLElement[];
};

/**
 * Tracks a safe polygon between a trigger and its floating content so the
 * pointer can travel from one to the other without closing it. Listens from
 * construction until `dispose()`; create one per open session.
 *
 * Ported from bits-ui's `SafePolygon`.
 */
export function trackSafePolygon(
	triggerNode: HTMLElement,
	contentNode: HTMLElement,
	opts: SafePolygonOptions,
): () => void {
	const buffer = opts.buffer ?? 1;
	const transitIntentTimeout =
		typeof opts.transitIntentTimeout === "number" && opts.transitIntentTimeout > 0
			? opts.transitIntentTimeout
			: null;

	// where the pointer was when it left the trigger or content
	let exitPoint: Point | null = null;
	// what it is moving toward: "content" when leaving trigger, "trigger" when leaving content
	let exitTarget: "trigger" | "content" | null = null;
	let transitTargets: HTMLElement[] = [];
	let leaveFallbackRafId: number | null = null;
	let transitIntentTimeoutId: number | null = null;

	const cancelLeaveFallback = () => {
		if (leaveFallbackRafId !== null) {
			cancelAnimationFrame(leaveFallbackRafId);
			leaveFallbackRafId = null;
		}
	};

	// if the pointer never moves again after leaving (e.g. it left the window),
	// don't leave the content stuck open
	const scheduleLeaveFallback = () => {
		cancelLeaveFallback();
		leaveFallbackRafId = requestAnimationFrame(() => {
			leaveFallbackRafId = null;
			if (exitPoint === null || exitTarget === null) return;
			clearTracking();
			opts.onPointerExit();
		});
	};

	const cancelTransitIntentTimeout = () => {
		if (transitIntentTimeoutId !== null) {
			clearTimeout(transitIntentTimeoutId);
			transitIntentTimeoutId = null;
		}
	};

	const scheduleTransitIntentTimeout = () => {
		if (transitIntentTimeout === null) return;
		cancelTransitIntentTimeout();
		transitIntentTimeoutId = window.setTimeout(() => {
			transitIntentTimeoutId = null;
			if (exitPoint === null || exitTarget === null) return;
			clearTracking();
			opts.onPointerExit();
		}, transitIntentTimeout);
	};

	const clearTracking = () => {
		exitPoint = null;
		exitTarget = null;
		transitTargets = [];
		cancelLeaveFallback();
		cancelTransitIntentTimeout();
	};

	const onPointerMove = (e: PointerEvent) => {
		if (exitPoint === null || exitTarget === null) return;
		cancelLeaveFallback();
		scheduleTransitIntentTimeout();

		const clientPoint: Point = [e.clientX, e.clientY];
		const triggerRect = triggerNode.getBoundingClientRect();
		const contentRect = contentNode.getBoundingClientRect();

		// reached the target — stop tracking
		if (exitTarget === "content" && isInsideRect(clientPoint, contentRect)) {
			clearTracking();
			return;
		}
		if (exitTarget === "trigger" && isInsideRect(clientPoint, triggerRect)) {
			clearTracking();
			return;
		}

		// heading toward an ignored target (a sibling trigger) is also safe
		if (exitTarget === "content" && transitTargets.length > 0) {
			for (const transitTarget of transitTargets) {
				const transitRect = transitTarget.getBoundingClientRect();
				if (isInsideRect(clientPoint, transitRect)) return;
				const transitSide = getSide(triggerRect, transitRect);
				const transitCorridor = getCorridorPolygon(triggerRect, transitRect, transitSide, buffer);
				if (isPointInPolygon(clientPoint, transitCorridor)) return;
			}
		}

		// the rectangular corridor between trigger and content
		const side = getSide(triggerRect, contentRect);
		const corridor = getCorridorPolygon(triggerRect, contentRect, side, buffer);
		if (isPointInPolygon(clientPoint, corridor)) return;

		// the triangular safe zone from the exit point to the target
		const targetRect = exitTarget === "content" ? contentRect : triggerRect;
		const safePoly = getSafePolygon(exitPoint, targetRect, side, exitTarget, buffer);
		if (isPointInPolygon(clientPoint, safePoly)) return;

		// outside every safe zone — close
		clearTracking();
		opts.onPointerExit();
	};

	const onTriggerLeave = (e: PointerEvent) => {
		const target = e.relatedTarget;
		// going directly to the content needs no polygon tracking
		if (target instanceof Element && contentNode.contains(target)) return;
		// moving onto an ignored target (a sibling trigger): its enter handler takes over
		const ignoredTargets = opts.ignoredTargets?.() ?? [];
		if (
			target instanceof Element &&
			ignoredTargets.some((n) => n === target || n.contains(target))
		) {
			return;
		}
		// for unrelated elements, defer the close decision to pointer geometry so
		// the cursor can pass through elements on the way to the content
		transitTargets =
			target instanceof Element && ignoredTargets.length > 0
				? ignoredTargets.filter((n) => target.contains(n))
				: [];
		exitPoint = [e.clientX, e.clientY];
		exitTarget = "content";
		scheduleLeaveFallback();
	};

	const onTriggerEnter = () => clearTracking();
	const onContentEnter = () => clearTracking();

	const onContentLeave = (e: PointerEvent) => {
		const target = e.relatedTarget;
		// going directly back to the trigger needs no polygon tracking
		if (target instanceof Element && triggerNode.contains(target)) return;
		exitPoint = [e.clientX, e.clientY];
		exitTarget = "trigger";
		scheduleLeaveFallback();
	};

	const doc = triggerNode.ownerDocument;
	doc.addEventListener("pointermove", onPointerMove);
	triggerNode.addEventListener("pointerleave", onTriggerLeave);
	triggerNode.addEventListener("pointerenter", onTriggerEnter);
	contentNode.addEventListener("pointerenter", onContentEnter);
	contentNode.addEventListener("pointerleave", onContentLeave);

	return () => {
		clearTracking();
		doc.removeEventListener("pointermove", onPointerMove);
		triggerNode.removeEventListener("pointerleave", onTriggerLeave);
		triggerNode.removeEventListener("pointerenter", onTriggerEnter);
		contentNode.removeEventListener("pointerenter", onContentEnter);
		contentNode.removeEventListener("pointerleave", onContentLeave);
	};
}

function isPointInPolygon(point: Point, polygon: Point[]): boolean {
	const [x, y] = point;
	let isInside = false;
	const length = polygon.length;
	for (let i = 0, j = length - 1; i < length; j = i++) {
		const [xi, yi] = polygon[i] ?? [0, 0];
		const [xj, yj] = polygon[j] ?? [0, 0];
		const intersect = yi >= y !== yj >= y && x <= ((xj - xi) * (y - yi)) / (yj - yi) + xi;
		if (intersect) isInside = !isInside;
	}
	return isInside;
}

function isInsideRect(point: Point, rect: DOMRect): boolean {
	return (
		point[0] >= rect.left &&
		point[0] <= rect.right &&
		point[1] >= rect.top &&
		point[1] <= rect.bottom
	);
}

/** Which side the content sits on relative to the trigger. */
function getSide(triggerRect: DOMRect, contentRect: DOMRect): Side {
	const deltaX =
		contentRect.left + contentRect.width / 2 - (triggerRect.left + triggerRect.width / 2);
	const deltaY =
		contentRect.top + contentRect.height / 2 - (triggerRect.top + triggerRect.height / 2);

	if (Math.abs(deltaX) > Math.abs(deltaY)) {
		return deltaX > 0 ? "right" : "left";
	}
	return deltaY > 0 ? "bottom" : "top";
}

/** The rectangular corridor spanning the gap between trigger and content. */
function getCorridorPolygon(
	triggerRect: DOMRect,
	contentRect: DOMRect,
	side: Side,
	buffer: number,
): Point[] {
	switch (side) {
		case "top":
			return [
				[Math.min(triggerRect.left, contentRect.left) - buffer, triggerRect.top],
				[Math.min(triggerRect.left, contentRect.left) - buffer, contentRect.bottom],
				[Math.max(triggerRect.right, contentRect.right) + buffer, contentRect.bottom],
				[Math.max(triggerRect.right, contentRect.right) + buffer, triggerRect.top],
			];
		case "bottom":
			return [
				[Math.min(triggerRect.left, contentRect.left) - buffer, triggerRect.bottom],
				[Math.min(triggerRect.left, contentRect.left) - buffer, contentRect.top],
				[Math.max(triggerRect.right, contentRect.right) + buffer, contentRect.top],
				[Math.max(triggerRect.right, contentRect.right) + buffer, triggerRect.bottom],
			];
		case "left":
			return [
				[triggerRect.left, Math.min(triggerRect.top, contentRect.top) - buffer],
				[contentRect.right, Math.min(triggerRect.top, contentRect.top) - buffer],
				[contentRect.right, Math.max(triggerRect.bottom, contentRect.bottom) + buffer],
				[triggerRect.left, Math.max(triggerRect.bottom, contentRect.bottom) + buffer],
			];
		case "right":
			return [
				[triggerRect.right, Math.min(triggerRect.top, contentRect.top) - buffer],
				[contentRect.left, Math.min(triggerRect.top, contentRect.top) - buffer],
				[contentRect.left, Math.max(triggerRect.bottom, contentRect.bottom) + buffer],
				[triggerRect.right, Math.max(triggerRect.bottom, contentRect.bottom) + buffer],
			];
	}
}

/** The triangular/trapezoidal safe zone from the exit point to the target. */
function getSafePolygon(
	exitPoint: Point,
	targetRect: DOMRect,
	side: Side,
	exitTarget: "trigger" | "content",
	baseBuffer: number,
): Point[] {
	const buffer = baseBuffer * 4;
	const [x, y] = exitPoint;

	// when going back to the trigger the travel direction is flipped
	const effectiveSide = exitTarget === "trigger" ? flipSide(side) : side;

	switch (effectiveSide) {
		case "top":
			return [
				[x - buffer, y + buffer],
				[x + buffer, y + buffer],
				[targetRect.right + buffer, targetRect.bottom],
				[targetRect.right + buffer, targetRect.top],
				[targetRect.left - buffer, targetRect.top],
				[targetRect.left - buffer, targetRect.bottom],
			];
		case "bottom":
			return [
				[x - buffer, y - buffer],
				[x + buffer, y - buffer],
				[targetRect.right + buffer, targetRect.top],
				[targetRect.right + buffer, targetRect.bottom],
				[targetRect.left - buffer, targetRect.bottom],
				[targetRect.left - buffer, targetRect.top],
			];
		case "left":
			return [
				[x + buffer, y - buffer],
				[x + buffer, y + buffer],
				[targetRect.right, targetRect.bottom + buffer],
				[targetRect.left, targetRect.bottom + buffer],
				[targetRect.left, targetRect.top - buffer],
				[targetRect.right, targetRect.top - buffer],
			];
		case "right":
			return [
				[x - buffer, y - buffer],
				[x - buffer, y + buffer],
				[targetRect.left, targetRect.bottom + buffer],
				[targetRect.right, targetRect.bottom + buffer],
				[targetRect.right, targetRect.top - buffer],
				[targetRect.left, targetRect.top - buffer],
			];
	}
}

function flipSide(side: Side): Side {
	switch (side) {
		case "top":
			return "bottom";
		case "bottom":
			return "top";
		case "left":
			return "right";
		case "right":
			return "left";
	}
}
