/**
 * Vendored from svelte-toolbelt `mergeProps` and adapted for this library.
 *
 * @see https://github.com/huntabyte/svelte-toolbelt/blob/main/src/lib/utils/merge-props.ts
 * @see https://github.com/adobe/react-spectrum/blob/main/packages/%40react-aria/utils/src/mergeProps.ts
 */
import { isReadable } from "@implementjs/core";

type Props = Record<string, unknown>;

type PropsArg = Props | null | undefined;

type TupleTypes<T> = { [P in keyof T]: T[P] } extends { [key: number]: infer V }
	? NullToObject<V>
	: never;

type NullToObject<T> = T extends null | undefined ? {} : T;

type UnionToIntersection<U> = (U extends U ? (k: U) => void : never) extends (k: infer I) => void
	? I
	: never;

/**
 * Matches core's event prop shape: `onClick`, `onKeydown`, `onClickCapture`.
 * Custom callbacks like `onDismiss` also match, which is what we want so they compose.
 */
function isEventHandler(key: string): boolean {
	if (key.length < 3 || !key.startsWith("on")) return false;
	const third = key[2];
	return third !== undefined && third === third.toUpperCase() && third !== third.toLowerCase();
}

function isStyleObject(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value) && !isReadable(value);
}

function isCallable(value: unknown): boolean {
	if (typeof value === "function") return true;
	if (isReadable(value)) {
		const current = value.get();
		return current == null || typeof current === "function";
	}
	return false;
}

function resolveCallback(handler: unknown): ((...args: unknown[]) => unknown) | undefined {
	if (typeof handler === "function") return handler as (...args: unknown[]) => unknown;
	if (isReadable(handler)) {
		const current = handler.get();
		if (typeof current === "function") return current as (...args: unknown[]) => unknown;
	}
	return undefined;
}

function isPrevented(event: unknown): boolean {
	return (
		typeof event === "object" &&
		event !== null &&
		"defaultPrevented" in event &&
		event.defaultPrevented === true
	);
}

/**
 * Composes event handlers into a single function. If an earlier handler calls
 * `event.preventDefault()`, later handlers are skipped. Readables are resolved
 * at call time so a `Bindable` handler still sees its current value.
 */
function composeHandlers(
	...handlers: unknown[]
): (this: unknown, event: Event, ...rest: unknown[]) => void {
	return function (this: unknown, event: Event, ...rest: unknown[]) {
		for (const handler of handlers) {
			if (!handler) continue;
			if (isPrevented(event)) return;
			resolveCallback(handler)?.call(this, event, ...rest);
		}
	};
}

function executeCallbacks(...callbacks: unknown[]): (this: unknown, ...args: unknown[]) => void {
	return function (this: unknown, ...args: unknown[]) {
		for (const callback of callbacks) {
			resolveCallback(callback)?.apply(this, args);
		}
	};
}

function toStyleKey(name: string): string {
	if (name.startsWith("--")) return name;
	return name.replace(/-([a-z])/g, (_, char: string) => char.toUpperCase());
}

function cssToStyleObj(css: string): Record<string, string> {
	const style: Record<string, string> = {};
	for (const declaration of css.split(";")) {
		const idx = declaration.indexOf(":");
		if (idx === -1) continue;
		const name = declaration.slice(0, idx).trim();
		const value = declaration.slice(idx + 1).trim();
		if (!name) continue;
		style[toStyleKey(name)] = value;
	}
	return style;
}

function toStyleRecord(value: unknown): Record<string, unknown> | null {
	if (typeof value === "string") return cssToStyleObj(value);
	if (isStyleObject(value)) return value;
	return null;
}

function mergeStyle(a: unknown, b: unknown): unknown {
	if (b === undefined) return a;
	if (a === undefined) return b;
	// a live cssText signal can't be merged with an object without dropping reactivity
	if (isReadable(a) || isReadable(b)) return b;

	const aObj = toStyleRecord(a);
	const bObj = toStyleRecord(b);
	if (aObj && bObj) return { ...aObj, ...bObj };
	return b;
}

function mergeClass(a: unknown, b: unknown): unknown {
	if (b == null || b === false) return a;
	if (a == null || a === false) return b;
	return [a, b];
}

/**
 * Merges prop objects into one.
 * - Composes `onClick` / `onKeydown` / `on*Capture` handlers (stops after `preventDefault()`)
 * - Chains other functions with the same name so they all run
 * - Merges `class` and `className` into a `ClassValue` array
 * - Merges `style` objects and CSS strings, keeping the result as an object
 * - Later values override earlier ones; `undefined` does not override
 */
export function mergeProps<T extends PropsArg[]>(...args: T): UnionToIntersection<TupleTypes<T>> {
	const result: Props = {};

	for (const props of args) {
		if (!props) continue;

		for (const key of Object.keys(props)) {
			const k = key === "className" ? "class" : key;
			const a = result[k];
			const b = props[key];

			if (k === "class") {
				result[k] = mergeClass(a, b);
				continue;
			}

			if (k === "style") {
				result[k] = mergeStyle(a, b);
				continue;
			}

			const aIsCallable = isCallable(a);
			const bIsCallable = isCallable(b);

			if (aIsCallable && bIsCallable && isEventHandler(k)) {
				result[k] = composeHandlers(a, b);
			} else if (typeof a === "function" && typeof b === "function") {
				result[k] = executeCallbacks(a, b);
			} else {
				result[k] = b !== undefined ? b : a;
			}
		}
	}

	return result as UnionToIntersection<TupleTypes<T>>;
}
