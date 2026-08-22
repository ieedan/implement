import * as implement from "@implementjs/core";
import {
	derived,
	Div,
	H1,
	If,
	normalizePath,
	P,
	Pre,
	Router,
	signal,
	withLocationSignal,
	type Child,
	type Mountable,
	type Readable,
	type RouterError,
	type RouterLocation,
	type Signal,
} from "@implementjs/core";
import { createClient } from "@implementjs/kit/client";
import {
	matchEndpoint,
	matchPage,
	routeId,
	runLoads,
	type EndpointRoute,
	type PageRoute,
	type RequestEvent,
	type RequestHandler,
	type RouteData,
	type ServerLoad,
} from "@implementjs/kit/runtime";
import type { LessonFile } from "./tutorials";
import {
	buildRouterRoutes,
	endpointFiles,
	loadRouteFiles,
	pageCount,
	ROUTES_DIR,
	routeFiles,
	scanVirtualRoutes,
	type RouteComponent,
} from "./kit-routes";
import { importLessonProject, type ShimModule } from "./run-lesson";

/** Whether a lesson is a kit app (routes under `src/routes/`) rather than a single file. */
export function isKitLesson(files: readonly { path: string }[]): boolean {
	return files.some((file) => file.path.startsWith(`${ROUTES_DIR}/`));
}

/** Pages the lesson's current files declare; `0` when the tree doesn't scan. */
export function countLessonRoutes(files: readonly { path: string }[]): number {
	try {
		return pageCount(scanVirtualRoutes(files.map((file) => file.path)));
	} catch {
		return 0;
	}
}

export type KitApp = {
	/** The preview's virtual location — drives and reflects the URL bar. */
	location: Readable<RouterLocation>;
	/** Resolves once the destination (its loads, or its raw response) is showing. */
	navigate: (href: string) => Promise<void>;
	stop: () => void;
};

function parseHref(href: string, base: RouterLocation): RouterLocation {
	const url = new URL(href, `http://preview.local${base.path}${base.search}${base.hash}`);
	return { path: normalizePath(url.pathname), search: url.search, hash: url.hash };
}

function DefaultErrorPage(error: RouterError): Child {
	return Div(
		{ style: { paddingTop: "1.5rem", textAlign: "center" } },
		H1(String(error.code)),
		P(error.message),
	);
}

/** The raw body of an endpoint response, shown the way a browser shows a `.md` URL. */
function RawResponse(text: Readable<string | null>): Mountable {
	return Pre(
		{
			style: {
				margin: "0",
				padding: "1rem",
				whiteSpace: "pre-wrap",
				wordBreak: "break-word",
				fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
				fontSize: "0.8125rem",
				lineHeight: "1.6",
			},
		},
		text.bind((value) => value ?? ""),
	);
}

/** Where the preview's virtual requests come from — nothing serves it, but a `Request` needs an origin. */
const PREVIEW_ORIGIN = "http://preview.local";

/** Stand-in request event for kit lesson previews (no hooks.server.ts). */
function previewEvent(
	url: URL,
	params: Record<string, string>,
	id: string | null,
	fetch: typeof globalThis.fetch,
	request = new Request(url),
): RequestEvent {
	return {
		request,
		url,
		params,
		route: { id },
		locals: {},
		fetch,
		// the lesson's own endpoints, not the docs site's, so the app's `App.Api`
		// is the wrong shape here — `createClient` takes the client type from its
		// call site, which is what makes this honest rather than a cast
		api: createClient<App.Api>({ fetch, baseUrl: PREVIEW_ORIGIN }),
		isDataRequest: false,
		platform: undefined,
		setHeaders: () => {},
		getClientAddress: () => "127.0.0.1",
	};
}

function previewUrl(target: RouterLocation): URL {
	return new URL(target.path + target.search, PREVIEW_ORIGIN);
}

/**
 * Boots a kit lesson inside the preview frame: scans the virtual `src/routes`
 * tree, links the files into modules executing in the frame's realm, and
 * mounts the assembled router against a virtual location — link clicks and
 * `navigateTo` calls in the lesson move that location, never the page URL.
 *
 * Server files run right in the preview (there is no server here): loads
 * resolve before a navigation commits and feed the routes' `data` readables,
 * and navigating to a `server.ts` endpoint path renders the raw response the
 * way a browser would.
 */
export async function runKitApp(
	files: LessonFile[],
	target: HTMLElement,
	realm: Window,
	initialPath = "/",
): Promise<KitApp> {
	const tree = scanVirtualRoutes(files.map((file) => file.path));
	if (pageCount(tree) === 0) {
		throw new Error(`No pages found — add a ${ROUTES_DIR}/page.ts file.`);
	}

	// Errors thrown by lesson code are the lesson's output — report them
	// through the preview frame's console (which the console panel captures),
	// not the page's devtools.
	// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Preview iframe console is captured for the lesson output panel.
	const realmConsole = (realm as Window & typeof globalThis).console;

	const location = signal<RouterLocation>(
		parseHref(initialPath, { path: "/", search: "", hash: "" }),
	);

	// Lesson code calling navigateTo must move the virtual location, so the
	// shimmed core module carries an override.
	const coreOverride: ShimModule = {
		// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Core module is re-exported into the preview realm with navigateTo overridden.
		...(implement as unknown as ShimModule),
		navigateTo: (href: string) => navigate(href),
	};

	const entries = routeFiles(tree).map((file) => `${ROUTES_DIR}/${file}`);
	const { modules, revoke } = await importLessonProject(
		files,
		entries,
		{ "@implementjs/core": coreOverride },
		realm,
	);

	const moduleFor = (file: string): RouteComponent => {
		const exported = modules.get(`${ROUTES_DIR}/${file}`)?.default;
		if (typeof exported !== "function") {
			throw new Error(`${ROUTES_DIR}/${file} must default-export a component function.`);
		}
		// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Default export validated as a function before use as RouteComponent.
		return exported as RouteComponent;
	};

	const loadFor = (file: string): ServerLoad => {
		const exported = modules.get(`${ROUTES_DIR}/${file}`)?.default;
		if (typeof exported !== "function") {
			throw new Error(`${ROUTES_DIR}/${file} must default-export a load function.`);
		}
		// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Default export validated as a function before use as ServerLoad.
		return exported as ServerLoad;
	};

	const pages: PageRoute[] = loadRouteFiles(tree).map((route) => ({
		pattern: route.pattern,
		id: routeId(route.pattern),
		files: route.files.map((file) => ({ id: file, load: loadFor(file) })),
	}));

	const endpoints: EndpointRoute[] = endpointFiles(tree).map((route) => ({
		...route,
		id: routeId(route.pattern),
		module: modules.get(`${ROUTES_DIR}/${route.file}`) ?? {},
	}));

	/**
	 * The preview has no server, so loads and endpoints get a stand-in event:
	 * a real URL and params, empty locals, and the no-op response controls a
	 * `hooks.server.ts` would otherwise drive.
	 */

	/**
	 * `event.fetch` for the preview. A same-origin request is answered by the
	 * lesson's own `server.ts` files, right here in the frame — the preview's
	 * version of kit dispatching in-process — and anything else goes out over
	 * the network as usual.
	 */
	const previewFetch: typeof fetch = async (input, init) => {
		const request =
			input instanceof Request
				? new Request(input, init)
				: new Request(new URL(String(input), PREVIEW_ORIGIN), init);
		const target = new URL(request.url);
		if (target.origin !== new URL(PREVIEW_ORIGIN).origin) return await fetch(request);
		const match = matchEndpoint(endpoints, normalizePath(target.pathname));
		if (match === null) return new Response("Not Found", { status: 404 });
		// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Endpoint module handlers are keyed by HTTP method name.
		const handler = match.route.module[request.method] as RequestHandler | undefined;
		if (handler === undefined) return new Response(null, { status: 405 });
		return await handler(previewEvent(target, match.params, match.route.id, previewFetch, request));
	};

	/** Runs the loads of the route serving `target`, or `null` when it has none. */
	const loadData = (target: RouterLocation): Promise<RouteData | null> => {
		const match = matchPage(pages, target.path);
		if (match === null) return Promise.resolve(null);
		const url = previewUrl(target);
		return runLoads(match.route, previewEvent(url, match.params, match.route.id, previewFetch));
	};

	// The preview's stand-in for kit's runtime data store, scoped per app.
	const store = new Map<string, Signal<unknown>>();
	const fileData = (id: string): Signal<unknown> => {
		let entry = store.get(id);
		if (entry === undefined) {
			entry = signal<unknown>({});
			store.set(id, entry);
		}
		return entry;
	};
	const seed = (data: RouteData) => {
		for (const [id, value] of Object.entries(data)) fileData(id).set(value ?? {});
	};
	const dataFor = (dataFiles: string[]): Readable<RouteData> =>
		// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Per-file load signals merge into one route data object.
		derived(dataFiles.map(fileData), (...values) => Object.assign({}, ...values) as RouteData);

	/** Body of the endpoint response being viewed, `null` while a page shows. */
	const responseView = signal<string | null>(null);

	const endpointBody = async (
		route: EndpointRoute,
		params: Record<string, string>,
		target: RouterLocation,
	): Promise<string> => {
		// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Endpoint GET handler is optional on the dynamically imported module.
		const handler = route.module.GET as RequestHandler | undefined;
		const url = previewUrl(target);
		if (handler === undefined) {
			return `405 Method Not Allowed — ${ROUTES_DIR}/${route.file} exports no GET handler.`;
		}
		const response = await handler(previewEvent(url, params, route.id, previewFetch));
		const body = await response.text();
		return response.ok ? body : `HTTP ${response.status}\n\n${body}`;
	};

	/** Resolves what the destination needs, returning the commit that shows it. */
	const resolveTarget = async (destination: RouterLocation): Promise<() => void> => {
		const match = matchEndpoint(endpoints, destination.path);
		if (match !== null) {
			const body = await endpointBody(match.route, match.params, destination);
			return () => {
				responseView.set(body);
				location.set(destination);
			};
		}
		const data = await loadData(destination);
		return () => {
			if (data !== null) seed(data);
			responseView.set(null);
			location.set(destination);
		};
	};

	let navigationToken = 0;
	const navigate = (href: string): Promise<void> => {
		const destination = parseHref(href, location.get());
		const token = ++navigationToken;
		return resolveTarget(destination).then(
			(commit) => {
				if (token === navigationToken) commit();
			},
			(error) => realmConsole.error(error),
		);
	};

	// the initial location's loads must resolve before the first render
	const initialData = await loadData(location.get());
	if (initialData !== null) seed(initialData);

	let app: ReturnType<Mountable>;
	try {
		const routes = buildRouterRoutes(tree, moduleFor, location, dataFor);
		const errorPage = tree.error !== null ? moduleFor(tree.error) : null;
		// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Virtual kit routes compile to the router's route table type.
		const router = Router(routes as never, {
			fallback: (error) =>
				errorPage !== null ? errorPage({ error, url: location }) : DefaultErrorPage(error),
			onError: (thrown) => realmConsole.error(thrown),
		});
		app = If(responseView.bind((value) => value !== null))
			.Then(RawResponse(responseView))
			.Else(router)();
		// Mounting subscribes the router to the location signal in scope, so the
		// preview routes against the virtual location instead of the page URL.
		withLocationSignal(location, () => app.mount(target));
	} catch (error) {
		revoke();
		throw error;
	}

	// Links inside the preview navigate the virtual location, never the page.
	// Capture-phase on the frame document, so this outruns the anchor's own
	// default handling regardless of what the lesson rendered.
	const doc = target.ownerDocument;
	const onClick = (event: MouseEvent) => {
		if (event.defaultPrevented || event.button !== 0) return;
		if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
		// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Click target is narrowed to an anchor for in-preview navigation.
		const anchor = (event.target as Element | null)?.closest?.("a[href]");
		if (anchor == null) return;
		event.preventDefault();
		event.stopPropagation();
		const href = anchor.getAttribute("href");
		// external links are inert inside the preview frame
		if (href == null || /^[a-z][a-z0-9+.-]*:/i.test(href)) return;
		void navigate(href);
	};
	doc.addEventListener("click", onClick, true);

	return {
		location,
		navigate,
		stop: () => {
			doc.removeEventListener("click", onClick, true);
			app.unmount();
			revoke();
		},
	};
}
