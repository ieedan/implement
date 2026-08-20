import {
	Implement,
	normalizePath,
	registerNavigationGuard,
	type Mountable,
	type Readable,
} from "@implementjs/core";

const DEFAULT_MESSAGE = "You have unsaved edits — leave this page anyway?";

let bypass = false;

/**
 * Runs `navigate` with the unsaved-changes prompt suppressed — for controls
 * that are themselves a deliberate way onward (the tutorial's Previous/Next
 * lesson links), where a confirm would second-guess an intentional click.
 * Only skips the in-app prompt; a refresh or close still warns.
 */
export function withoutUnsavedChangesPrompt(navigate: () => void): void {
	bypass = true;
	try {
		navigate();
	} finally {
		bypass = false;
	}
}

/**
 * Renders nothing; while mounted with `dirty` true, leaving the page needs
 * confirmation. In-app navigation to another path asks through `confirm()`
 * (same-path navigations — query or hash changes — pass through), and a
 * refresh, tab close, or external link gets the browser's native
 * beforeunload prompt. Everything unregisters on unmount.
 */
export function UnsavedChangesGuard(
	dirty: Readable<boolean>,
	message = DEFAULT_MESSAGE,
): Mountable {
	return Implement.Lifecycle({
		onMount() {
			const onBeforeUnload = (event: BeforeUnloadEvent) => {
				if (!dirty.get()) return;
				event.preventDefault();
				// legacy engines only show the prompt when returnValue is set
				event.returnValue = "";
			};
			window.addEventListener("beforeunload", onBeforeUnload);
			const unregister = registerNavigationGuard((to) => {
				if (bypass || !dirty.get()) return true;
				if (to.path === normalizePath(window.location.pathname)) return true;
				return window.confirm(message);
			});
			return () => {
				window.removeEventListener("beforeunload", onBeforeUnload);
				unregister();
			};
		},
	});
}
