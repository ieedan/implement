/**
 * Experimental function-based, lazily-constructed variant of the framework.
 * See FUNCTIONAL.md at the repo root for the full exploration. Not exported
 * from the package entry point — import from `@packages/ui/src/fn` (or wire an
 * export map entry) to try it.
 */

export { captureEnv, onCleanup, runInScope, withEnv, type ContextEnv } from "./scope";
export { computed, effect, increment, signal, toggle, type WritableSignal } from "./reactive";
export {
	mountRegion,
	realize,
	unmountRegion,
	watchProp,
	type ActiveRegion,
	type Child,
	type PropInput,
	type View,
} from "./view";
export * from "./element";
export { ForEach, Fragment, If, Key, lazy, type IfBuilder } from "./flow";
export { context, type Context } from "./context";
