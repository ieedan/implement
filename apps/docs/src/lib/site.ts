/**
 * The origin the docs are published under. Hardcoded rather than read off the
 * request: every page is prerendered, and the prerenderer dispatches against a
 * placeholder origin (`http://implement.internal`), so `event.url` would bake a
 * hostname that resolves nowhere into the built files.
 *
 * Read by the `.md` routes, which rewrite the pages' site-relative links to
 * absolute ones, and by `scripts/skills.ts`, which links the agent skills at
 * the same twins.
 */
export const SITE_ORIGIN = "https://implementjs.dev";
