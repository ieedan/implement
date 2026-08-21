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
import {
	matchEndpoint,
	resolveLoads,
	type EndpointRoute,
	type LoadRoute,
	type RequestHandler,
	type RouteData,
	type ServerLoad,
} from "@implementjs/kit/runtime";
import type { LessonFile } from "./content";
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

async function endpointResponseBody(
	route: EndpointRoute,
	params: Record<string, string>,
	target: RouterLocation,
): Promise<string> {
	const handler = route.module.GET as RequestHandler | undefined;
	const url = new URL(target.path + target.search, "http://preview.local");
	if (handler === undefined) {
		return `405 Method Not Allowed — ${ROUTES_DIR}/${route.file} exports no GET handler.`;
	}
	const response = await handler({ request: new Request(url), params, url });
	const body = await response.text();
	return response.ok ? body : `HTTP ${response.status}\n\n${body}`;
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
		throw new Error(`No pages found — add a ${ROUTES_DIR}/index.ts file.`);
	}

	// Errors thrown by lesson code are the lesson's output — report them
	// through the preview frame's console (which the console panel captures),
	// not the page's devtools.
	const realmConsole = (realm as Window & typeof globalThis).console;

	const location = signal<RouterLocation>(
		parseHref(initialPath, { path: "/", search: "", hash: "" }),
	);

	// Lesson code calling navigateTo must move the virtual location, so the
	// shimmed core module carries an override.
	const coreOverride: ShimModule = {
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
		return exported as RouteComponent;
	};

	const loadFor = (file: string): ServerLoad => {
		const exported = modules.get(`${ROUTES_DIR}/${file}`)?.default;
		if (typeof exported !== "function") {
			throw new Error(`${ROUTES_DIR}/${file} must default-export a load function.`);
		}
		return exported as ServerLoad;
	};

	const loads: LoadRoute[] = loadRouteFiles(tree).map((route) => ({
		pattern: route.pattern,
		files: route.files.map((file) => ({ id: file, load: loadFor(file) })),
	}));

	const endpoints: EndpointRoute[] = endpointFiles(tree).map((route) => ({
		...route,
		module: modules.get(`${ROUTES_DIR}/${route.file}`) ?? {},
	}));

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
		derived(dataFiles.map(fileData), (...values) => Object.assign({}, ...values) as RouteData);

	/** Body of the endpoint response being viewed, `null` while a page shows. */
	const responseView = signal<string | null>(null);

	/** Resolves what the destination needs, returning the commit that shows it. */
	const resolveTarget = async (destination: RouterLocation): Promise<() => void> => {
		const match = matchEndpoint(endpoints, destination.path);
		if (match !== null) {
			const body = await endpointResponseBody(match.route, match.params, destination);
			return () => {
				responseView.set(body);
				location.set(destination);
			};
		}
		const data = await resolveLoads(loads, destination.path + destination.search);
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
	const initialData = await resolveLoads(loads, location.get().path + location.get().search);
	if (initialData !== null) seed(initialData);

	let app: ReturnType<Mountable>;
	try {
		const routes = buildRouterRoutes(tree, moduleFor, location, dataFor);
		const errorPage = tree.error !== null ? moduleFor(tree.error) : null;
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
