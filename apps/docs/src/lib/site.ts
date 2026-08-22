/**
 * The site's canonical origin.
 *
 * Open Graph gives no meaning to a relative url — a crawler resolves
 * `og:image` against nothing — so the absolute form has to come from
 * somewhere, and a prerendered page has no request to take it from. A
 * constant is the whole answer at this size; the day the origin needs to
 * differ per deployment it becomes a `PUBLIC_SITE_URL` in `env.public.ts`.
 */
export const SITE_URL = "https://implement.dev";

/** An absolute url for `path`, which is what the social meta tags need. */
export function absolute(path: string): string {
	return new URL(path, SITE_URL).href;
}
