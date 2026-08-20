import { router } from "$implement/router";

export { router };

type LinkFn = (typeof router)["Link"];

/**
 * Deferred (not `.bind`) so this module can sit inside the route-module
 * import cycle: views import `Link` here while `$implement/router` is still
 * evaluating them.
 */
export const Link: LinkFn = (props, ...children) => router.Link(props, ...children);
