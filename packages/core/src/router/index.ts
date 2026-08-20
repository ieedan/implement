import { reconcileChildren, type Child, type IMountable, type Mountable } from "../components";
import { A } from "../components/elements";
import type { ElementProps } from "../components/props";
import { dom } from "../dom";
import { derived, isReadable, signal, subscribe, type Readable, type Signal } from "../signal";
import { asParent, mountChild } from "../tree";
import type { Unsubscribe } from "../types";
import { syncDomOrder } from "../utils";
import {
	locationSignal,
	navigateTo,
	normalizePath,
	searchParam,
	type NavigateOptions,
	type RouterLocation,
} from "./location";

export {
	navigateTo,
	normalizePath,
	registerNavigationGuard,
	searchParam,
	setNavigationResolver,
	withLocationSignal,
	type NavigateOptions,
	type NavigationGuard,
	type NavigationResolver,
	type RouterLocation,
	type SearchParam,
} from "./location";

type Prettify<T> = { [K in keyof T]: T[K] } & {};

type SegmentParam<S extends string> = S extends `:...${infer Name}`
	? { [K in Name]: Readable<string> }
	: S extends `:${infer Name}`
		? { [K in Name]: Readable<string> }
		: {};

type PathParams<Path extends string> = Path extends `/${infer Rest}`
	? PathParams<Rest>
	: Path extends `${infer Head}/${infer Tail}`
		? SegmentParam<Head> & PathParams<Tail>
		: SegmentParam<Path>;

type ParamName<S extends string> = S extends `:...${infer Name}`
	? Name
	: S extends `:${infer Name}`
		? Name
		: never;

type PathParamNames<Path extends string> = Path extends `/${infer Rest}`
	? PathParamNames<Rest>
	: Path extends `${infer Head}/${infer Tail}`
		? ParamName<Head> | PathParamNames<Tail>
		: ParamName<Path>;

type RouteHandler<Params> = (params: Params) => Child;

type LayoutHandler<Params> = (child: Mountable, params: Params) => Child;

/**
 * Function keys (`"/"` and `layout`) must not depend on `T[K]`, or TypeScript
 * will not contextually type the callbacks. Other path keys are nested tables,
 * or a bare handler as shorthand for `{ "/": handler }`.
 */
type Routes<T, Params extends object = {}> = {
	[K in keyof T]: K extends "layout"
		? LayoutHandler<Params>
		: K extends "/"
			? RouteHandler<Params>
			: K extends `/${string}` | `:${string}` | `(${string})`
				? T[K] extends (...args: never) => unknown
					? RouteHandler<Prettify<Params & PathParams<K & string>>>
					: Routes<T[K], Prettify<Params & PathParams<K & string>>>
				: never;
};

/** `(group)` keys nest layouts without contributing a path segment. */
type NormalizeKey<K extends string> = K extends `(${string})`
	? ""
	: K extends `/${string}`
		? K
		: `/${K}`;

/** Union of every full path in the tree that has a render (`"/"` or bare handler). */
type RoutePaths<T, Prefix extends string = ""> = {
	[K in keyof T & string]: K extends "layout"
		? never
		: K extends "/"
			? Prefix extends ""
				? "/"
				: Prefix
			: T[K] extends (...args: never) => unknown
				? `${Prefix}${NormalizeKey<K>}`
				: RoutePaths<T[K], `${Prefix}${NormalizeKey<K>}`>;
}[keyof T & string];

type HrefParams<P extends string> = { [K in PathParamNames<P>]: string | number };

type LinkParamValue = string | number | Readable<string | number>;

type LinkParams<P extends string> = { [K in PathParamNames<P>]: LinkParamValue };

type HrefArgs<P extends string> = [PathParamNames<P>] extends [never]
	? []
	: [params: HrefParams<P>];

type NavigateArgs<P extends string> = [PathParamNames<P>] extends [never]
	? [options?: NavigateOptions]
	: [params: HrefParams<P>, options?: NavigateOptions];

export type LinkProps<P extends string> = Omit<ElementProps<"a">, "href"> & {
	to: P;
	/** Replace the current history entry instead of pushing a new one. */
	replace?: boolean;
} & ([PathParamNames<P>] extends [never] ? { params?: undefined } : { params: LinkParams<P> });

export type RouterError = {
	/** HTTP-style status — `404` for unmatched paths, `500` for render errors. */
	code: number;
	message: string;
};

export type RouterOptions = {
	/**
	 * Rendered when no route matches the current path (`code` 404) or a route
	 * render throws (`code` 500, or the thrown `{ code, message }` as-is).
	 */
	fallback?: (error: RouterError) => Child;
	/**
	 * Receives whatever a route render threw, before the fallback renders —
	 * integrators embedding a router (previews, sandboxes) route it to their
	 * own console. @default console.error
	 */
	onError?: (thrown: unknown) => void;
};

export type RouterHelper<T> = Mountable & {
	/** Reactive current location, shared by every router. */
	location: Readable<RouterLocation>;
	/** Build a URL for a route, filling `:param` segments. */
	href<P extends RoutePaths<T> & string>(path: P, ...args: HrefArgs<P>): string;
	/** Navigate programmatically. */
	navigate<P extends RoutePaths<T> & string>(path: P, ...args: NavigateArgs<P>): void;
	/**
	 * An `A` that navigates through the router. Modifier keys, non-left
	 * clicks, and `target` are respected. Sets `aria-current="page"` while
	 * the link's path is the current one (style with `aria-[current=page]:`).
	 */
	Link<P extends RoutePaths<T> & string>(props: LinkProps<P>, ...children: Child[]): Mountable;
	/** URL-synced query-string value. See {@link searchParam}. */
	searchParam: typeof searchParam;
};

// ---------------------------------------------------------------------------
// Runtime
// ---------------------------------------------------------------------------

type Segment = { param: false; value: string } | { param: true; name: string; rest: boolean };

type RuntimeParams = Record<string, Readable<string>>;

type LayoutEntry = { handler: (child: Mountable, params: RuntimeParams) => Child };

type LeafRoute = {
	/** Full path pattern, root first. */
	segments: Segment[];
	/** Enclosing layouts, outermost first. Entry identity drives layout reuse. */
	layouts: LayoutEntry[];
	render: (params: RuntimeParams) => Child;
};

function parseKey(key: string): Segment[] {
	const raw = key.startsWith("/") ? key : `/${key}`;
	return (
		raw
			.split("/")
			.filter(Boolean)
			// `(group)` segments scope layouts without matching any part of the path
			.filter((part) => !(part.startsWith("(") && part.endsWith(")")))
			.map((part) => {
				if (part.startsWith(":...")) return { param: true, rest: true, name: part.slice(4) };
				if (part.startsWith(":")) return { param: true, rest: false, name: part.slice(1) };
				return { param: false, value: part };
			})
	);
}

function compileNode(
	node: Record<string, unknown>,
	prefix: Segment[],
	layouts: LayoutEntry[],
	out: LeafRoute[],
): void {
	const layout = node.layout as LayoutEntry["handler"] | undefined;
	const scope = layout ? [...layouts, { handler: layout }] : layouts;
	for (const [key, value] of Object.entries(node)) {
		if (key === "layout") continue;
		if (key === "/") {
			assertRestIsLast(prefix);
			out.push({ segments: prefix, layouts: scope, render: value as LeafRoute["render"] });
			continue;
		}
		// A bare handler at a path key is shorthand for `{ "/": handler }`.
		if (typeof value === "function") {
			const segments = [...prefix, ...parseKey(key)];
			assertRestIsLast(segments);
			out.push({ segments, layouts: scope, render: value as LeafRoute["render"] });
			continue;
		}
		compileNode(value as Record<string, unknown>, [...prefix, ...parseKey(key)], scope, out);
	}
}

/** A `:...rest` segment swallows the remainder of the path, so nothing may follow it. */
function assertRestIsLast(segments: Segment[]): void {
	for (let i = 0; i < segments.length - 1; i++) {
		const segment = segments[i]!;
		if (segment.param && segment.rest) {
			throw new Error(`Catch-all segment ":...${segment.name}" must be the last path segment`);
		}
	}
}

/** Static segments outrank params, and params outrank catch-alls, position by position. */
function compareRoutes(a: LeafRoute, b: LeafRoute): number {
	const rank = (segment: Segment) => (segment.param ? (segment.rest ? 2 : 1) : 0);
	const length = Math.min(a.segments.length, b.segments.length);
	for (let i = 0; i < length; i++) {
		const difference = rank(a.segments[i]!) - rank(b.segments[i]!);
		if (difference !== 0) return difference;
	}
	return a.segments.length - b.segments.length;
}

function matchRoute(
	routes: readonly LeafRoute[],
	path: string,
): { route: LeafRoute; params: Record<string, string> } | null {
	const parts = path.split("/").filter(Boolean).map(decodeURIComponent);
	for (const route of routes) {
		const last = route.segments[route.segments.length - 1];
		const hasRest = last !== undefined && last.param && last.rest;
		// a catch-all consumes one or more trailing segments; everything else is exact
		if (hasRest ? parts.length < route.segments.length : route.segments.length !== parts.length) {
			continue;
		}
		const params: Record<string, string> = {};
		let matched = true;
		for (let i = 0; i < route.segments.length; i++) {
			const segment = route.segments[i]!;
			if (segment.param) {
				params[segment.name] = segment.rest ? parts.slice(i).join("/") : parts[i]!;
			} else if (segment.value !== parts[i]) {
				matched = false;
				break;
			}
		}
		if (matched) return { route, params };
	}
	return null;
}

function buildHref(path: string, params: Record<string, string | number> = {}): string {
	const built = path
		.split("/")
		.map((part) => {
			if (!part.startsWith(":")) return part;
			const rest = part.startsWith(":...");
			const name = part.slice(rest ? 4 : 1);
			const value = params[name];
			if (value === undefined) {
				throw new Error(`Missing param "${name}" building href for "${path}"`);
			}
			if (!rest) return encodeURIComponent(`${value}`);
			// a catch-all value spans segments: encode each, keep the slashes
			return `${value}`.split("/").filter(Boolean).map(encodeURIComponent).join("/");
		})
		.join("/");
	return built === "" ? "/" : built;
}

/**
 * A swappable mount region. Layouts receive `outlet.mountable` as their child;
 * the router calls `set` to swap what renders inside it without touching the
 * layout itself.
 */
class Outlet {
	#parent: HTMLElement | null = null;
	#mounted: IMountable[] = [];
	#children: Child[] = [];
	#endMarker = dom.createComment("");
	#node: IMountable;

	constructor() {
		this.#node = {
			mount: (parent: HTMLElement) => {
				this.#parent = parent;
				dom.attach(parent, this.#endMarker);
				this.#render();
			},
			unmount: () => {
				this.#clear();
				this.#endMarker.remove();
				this.#parent = null;
			},
			getFirstDomNode: () => {
				for (const child of this.#mounted) {
					const first = child.getFirstDomNode();
					if (first) return first;
				}
				return this.#endMarker.isConnected ? this.#endMarker : null;
			},
		};
	}

	mountable: Mountable = () => this.#node;

	set(...children: Child[]) {
		this.#children = children;
		if (this.#parent) this.#render();
	}

	#clear() {
		for (const child of this.#mounted) child.unmount();
		this.#mounted = [];
	}

	#render() {
		this.#clear();
		asParent(this.#node, () => {
			for (const factory of reconcileChildren({}, ...this.#children)) {
				const instance = factory();
				this.#mounted.push(instance);
				mountChild(instance, this.#parent!);
			}
		});
		syncDomOrder(
			this.#parent!,
			this.#mounted.map((child) => child.getFirstDomNode()).filter((n): n is Node => n !== null),
			this.#endMarker,
		);
	}
}

const FALLBACK = Symbol("router.fallback");

const NOT_FOUND: RouterError = { code: 404, message: "Not Found" };

/** A thrown `{ code, message }` passes through; anything else is a 500. */
function toRouterError(thrown: unknown): RouterError {
	if (
		typeof thrown === "object" &&
		thrown !== null &&
		"code" in thrown &&
		typeof thrown.code === "number" &&
		"message" in thrown &&
		typeof thrown.message === "string"
	) {
		return { code: thrown.code, message: thrown.message };
	}
	return { code: 500, message: thrown instanceof Error ? thrown.message : String(thrown) };
}

/**
 * Defers to the active location signal per call. `Router(...)` commonly runs at
 * module scope, which must not touch `window` (server) or eagerly create the
 * browser singleton.
 */
const lazyLocation: Readable<RouterLocation> = {
	get: () => locationSignal().get(),
	subscribe: (callback) => locationSignal().subscribe(callback),
	onChange: (callback) => locationSignal().onChange(callback),
	bind: (keyOrSelector: never) => locationSignal().bind(keyOrSelector),
};

/**
 * A route-tree router. One nested object describes the whole app: keys are
 * path segments, `:param` segments surface as `Readable<string>`s at every
 * render below them, `"/"` renders a level, and `layout` wraps everything
 * beneath it (receiving the matched child). A path key may also map straight
 * to a handler — `"/about": () => About()` — shorthand for `{ "/": handler }`.
 * A trailing `:...rest` segment catches one or more remaining segments,
 * surfacing them joined with `/` (`/docs/:...slug` matches `/docs/a/b` with
 * `slug` = `"a/b"`); static segments outrank `:param`s, which outrank
 * catch-alls. A `"(group)"` key nests a subtree (and its `layout`) without
 * contributing a path segment, so siblings can share a layout that the URL
 * never shows.
 *
 * The router is a `Mountable` — `app.render(router)` works, and so does
 * mounting one deep inside a layout. Navigating between children of a shared
 * layout swaps only the child; navigating between params of the same route
 * patches the param signals in place without remounting.
 *
 * ```ts
 * const router = Router({
 * 	"/": () => Home(),
 * 	"/about": () => About(),
 * 	"/issues": {
 * 		layout: (child) => Shell(child),
 * 		"/": () => Issues(),
 * 		"/:id": ({ id }) => Issue({ id }),
 * 	},
 * });
 * app.render(router);
 * router.Link({ to: "/issues/:id", params: { id: "42" } }, "Open #42");
 * ```
 */
export function Router<T extends Routes<T>>(
	routes: T,
	options: RouterOptions = {},
): RouterHelper<T> {
	const compiled: LeafRoute[] = [];
	compileNode(routes, [], [], compiled);
	compiled.sort(compareRoutes);

	const mountable = (): IMountable => {
		const root = new Outlet();
		const rootNode = root.mountable();
		const paramSignals = new Map<string, Signal<string>>();
		const outlets: Outlet[] = [root];
		let chain: unknown[] = [];
		let unsubscribe: Unsubscribe | null = null;

		const paramsFor = (route: LeafRoute): RuntimeParams => {
			const params: RuntimeParams = {};
			for (const segment of route.segments) {
				if (segment.param) params[segment.name] = paramSignals.get(segment.name)!;
			}
			return params;
		};

		/** Content for chain position `index`, creating the outlets below it. */
		const build = (route: LeafRoute, index: number): Child => {
			const params = paramsFor(route);
			if (index < route.layouts.length) {
				const child = new Outlet();
				outlets[index + 1] = child;
				const content = route.layouts[index]!.handler(child.mountable, params);
				child.set(build(route, index + 1));
				return content;
			}
			return route.render(params);
		};

		let shownError: RouterError | null = null;

		const showFallback = (error: RouterError) => {
			if (
				chain.length === 1 &&
				chain[0] === FALLBACK &&
				shownError !== null &&
				shownError.code === error.code &&
				shownError.message === error.message
			) {
				return;
			}
			chain = [FALLBACK];
			shownError = error;
			outlets.length = 1;
			root.set(options.fallback ? options.fallback(error) : null);
		};

		const onLocation = ({ path }: RouterLocation) => {
			const match = matchRoute(compiled, path);
			if (!match) {
				showFallback(NOT_FOUND);
				return;
			}

			for (const [name, value] of Object.entries(match.params)) {
				const existing = paramSignals.get(name);
				if (existing) {
					existing.set(value);
				} else {
					paramSignals.set(name, signal(value));
				}
			}
			for (const name of paramSignals.keys()) {
				if (!(name in match.params)) paramSignals.delete(name);
			}

			const next: unknown[] = [...match.route.layouts, match.route];
			let diverged = 0;
			while (
				diverged < chain.length &&
				diverged < next.length &&
				chain[diverged] === next[diverged]
			) {
				diverged++;
			}
			if (diverged === chain.length && diverged === next.length) return;

			chain = next;
			shownError = null;
			try {
				outlets[diverged]!.set(build(match.route, diverged));
				outlets.length = next.length;
			} catch (thrown) {
				(options.onError ?? console.error)(thrown);
				showFallback(toRouterError(thrown));
			}
		};

		return {
			mount(parent: HTMLElement) {
				mountChild(rootNode, parent);
				unsubscribe = subscribe([locationSignal()], onLocation);
			},
			unmount() {
				unsubscribe?.();
				unsubscribe = null;
				rootNode.unmount();
				chain = [];
				outlets.length = 1;
				paramSignals.clear();
			},
			getFirstDomNode() {
				return rootNode.getFirstDomNode();
			},
		};
	};

	const href = (path: string, params?: Record<string, string | number>) => buildHref(path, params);

	const navigate = (path: string, ...rest: unknown[]) => {
		const takesParams = path.includes(":");
		const params = takesParams ? (rest[0] as Record<string, string | number>) : undefined;
		const navOptions = (takesParams ? rest[1] : rest[0]) as NavigateOptions | undefined;
		navigateTo(buildHref(path, params), navOptions);
	};

	const Link = (props: LinkProps<string>, ...children: Child[]): Mountable => {
		const { to, params, replace, onClick, ...rest } = props;

		const record: Record<string, LinkParamValue> = params ?? {};
		const entries = Object.entries(record);
		const reactive = entries
			.map(([, value]) => value)
			.filter((value): value is Readable<string | number> => isReadable(value));
		const resolveParams = (): Record<string, string | number> =>
			Object.fromEntries(
				entries.map(([name, value]) => [name, isReadable(value) ? value.get() : value]),
			);
		const linkHref: string | Readable<string> =
			reactive.length === 0
				? buildHref(to, resolveParams())
				: derived(reactive, () => buildHref(to, resolveParams()));

		const currentHref = () => (typeof linkHref === "string" ? linkHref : linkHref.get());
		const hrefSignals = typeof linkHref === "string" ? [] : [linkHref];
		const ariaCurrent = derived([locationSignal(), ...hrefSignals], (location) =>
			location.path === normalizePath(currentHref()) ? "page" : undefined,
		);

		return A(
			{
				...rest,
				href: linkHref,
				"aria-current": ariaCurrent,
				onClick(event) {
					if (typeof onClick === "function") {
						onClick.call(this, event);
					}
					if (event.defaultPrevented) return;
					if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
					if (event.button !== 0) return;
					const target = isReadable(rest.target) ? rest.target.get() : rest.target;
					if (target && target !== "_self") return;
					event.preventDefault();
					navigateTo(currentHref(), { replace });
				},
			},
			...children,
		);
	};

	return Object.assign(mountable, {
		location: lazyLocation,
		href,
		navigate,
		Link,
		searchParam,
	}) as unknown as RouterHelper<T>;
}
