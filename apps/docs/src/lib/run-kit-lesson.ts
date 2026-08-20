import * as implement from "@implementjs/core";
import {
	Div,
	H1,
	normalizePath,
	P,
	Router,
	signal,
	withLocationSignal,
	type Child,
	type Mountable,
	type Readable,
	type RouterError,
	type RouterLocation,
} from "@implementjs/core";
import type { LessonFile } from "./content";
import {
	buildRouterRoutes,
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
	navigate: (href: string) => void;
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

/**
 * Boots a kit lesson inside the preview frame: scans the virtual `src/routes`
 * tree, links the files into modules executing in the frame's realm, and
 * mounts the assembled router against a virtual location — link clicks and
 * `navigateTo` calls in the lesson move that location, never the page URL.
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

	const location = signal<RouterLocation>(
		parseHref(initialPath, { path: "/", search: "", hash: "" }),
	);

	const navigate = (href: string) => {
		location.set(parseHref(href, location.get()));
	};

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

	let router: ReturnType<Mountable>;
	try {
		const routes = buildRouterRoutes(tree, moduleFor, location);
		const errorPage = tree.error !== null ? moduleFor(tree.error) : null;
		router = Router(routes as never, {
			fallback: (error) =>
				errorPage !== null ? errorPage({ error, url: location }) : DefaultErrorPage(error),
		})();
		// Mounting subscribes the router to the location signal in scope, so the
		// preview routes against the virtual location instead of the page URL.
		withLocationSignal(location, () => router.mount(target));
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
		navigate(href);
	};
	doc.addEventListener("click", onClick, true);

	return {
		location,
		navigate,
		stop: () => {
			doc.removeEventListener("click", onClick, true);
			router.unmount();
			revoke();
		},
	};
}
