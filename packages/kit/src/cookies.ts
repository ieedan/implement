/**
 * `event.cookies`: the request's cookies read back by name, and cookies set on
 * the response from wherever the request is being served — a hook, a load, or
 * an endpoint. Kept dependency-free like `./match.ts`, since the event type it
 * hangs off is shared with the browser half.
 *
 * `Set-Cookie` is the one header kit does not route through `setHeaders`: it
 * is legitimately repeated, so a response may carry as many of them as the
 * request set, and `setHeaders` is one value per header by design.
 */

/**
 * The attributes a cookie carries, spelled the way `Set-Cookie` spells them.
 * Every one of them is optional; see {@link Cookies.set} for what kit fills in
 * when they are left out.
 */
export type CookieOptions = {
	/** Which paths the cookie is sent for. @default "/" */
	path?: string;
	/**
	 * Which host the cookie is sent to. Left out — the default — it is this
	 * host exactly, subdomains excluded.
	 */
	domain?: string;
	/** How long the cookie lives, in seconds. Without it the cookie lasts the browser session. */
	maxAge?: number;
	/** When the cookie dies, as a date. `maxAge` wins where a browser reads both. */
	expires?: Date;
	/** Kept out of `document.cookie`, so only the server ever sees it. @default true */
	httpOnly?: boolean;
	/** Sent over https only. Defaults to whether *this* request arrived over https. */
	secure?: boolean;
	/**
	 * When the cookie rides along on a cross-site request: `"strict"` never,
	 * `"lax"` on top-level navigations, `"none"` always (and only alongside
	 * `secure`).
	 * @default "lax"
	 */
	sameSite?: "lax" | "strict" | "none";
};

/** What a `delete` needs: the attributes that decide *which* cookie is being replaced. */
export type CookieScope = Pick<CookieOptions, "path" | "domain">;

/**
 * `event.cookies` — the request's cookies, and the response's.
 *
 * ```ts
 * export const handle: Handle = async ({ event, resolve }) => {
 * 	const session = event.cookies.get("session");
 * 	event.locals.user = session === undefined ? null : await getUser(session);
 * 	return await resolve(event);
 * };
 * ```
 *
 * Reads see what the request arrived with *and* what this request has set so
 * far, so a load reads back the cookie the hook above it just issued rather
 * than the one the browser sent.
 */
export type Cookies = {
	/** The cookie's value, decoded, or `undefined` when the request carries none by that name. */
	get(name: string): string | undefined;
	/** Every cookie in play: what the browser sent, with this request's own writes over it. */
	getAll(): { name: string; value: string }[];
	/**
	 * Set a cookie on the response. The value is encoded, so anything a string
	 * can hold survives the round trip.
	 *
	 * ```ts
	 * event.cookies.set("theme", "dark", { maxAge: 60 * 60 * 24 * 365 });
	 * ```
	 *
	 * Kit fills in the attributes worth having by default: `path: "/"` (the
	 * browser's own default is the *current directory*, which makes a cookie
	 * set from a deep route invisible to the rest of the app), `httpOnly` and
	 * `sameSite: "lax"`, and `secure` whenever the request itself arrived over
	 * https — so a cookie set in dev over `http://localhost` still reaches the
	 * browser. Pass any of them to say otherwise.
	 */
	set(name: string, value: string, options?: CookieOptions): void;
	/**
	 * Delete a cookie, by setting it to nothing with an expiry in the past.
	 *
	 * A cookie is identified by its name *and* its `path`/`domain`, so a
	 * cookie set with either of them must be deleted with the same ones —
	 * otherwise the browser keeps the cookie and stores a second, empty one
	 * beside it.
	 */
	delete(name: string, options?: CookieScope): void;
};

/** A cookie name is an HTTP token: no spaces, no separators, no control characters. */
const COOKIE_NAME = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

/**
 * Attribute values go into the header verbatim, so a `;` or a newline in one
 * would end the attribute and start another — a path built out of user input
 * turning into a `Domain=` nobody wrote.
 */
// oxlint-disable-next-line no-control-regex -- Control characters are exactly what this rejects.
const UNSAFE_ATTRIBUTE = /[;\s\u0000-\u001f\u007f]/;

/**
 * One `Set-Cookie` value. Applies the defaults kit chose for every attribute
 * that decides where a cookie goes, so the only one a caller has to think
 * about is how long it should live.
 */
export function serializeCookie(name: string, value: string, options: CookieOptions = {}): string {
	if (!COOKIE_NAME.test(name)) {
		throw new Error(
			`"${name}" is not a valid cookie name — a name is letters, digits, and "!#$%&'*+-.^_\`|~", with no spaces`,
		);
	}
	const parts = [`${name}=${encodeURIComponent(value)}`];
	parts.push(`Path=${attribute("path", options.path ?? "/")}`);
	if (options.domain !== undefined) parts.push(`Domain=${attribute("domain", options.domain)}`);
	// `Max-Age` is seconds from now, and a fractional one is not a duration any
	// browser will read — truncated rather than left to render as `1.5`
	if (options.maxAge !== undefined) parts.push(`Max-Age=${Math.trunc(options.maxAge)}`);
	if (options.expires !== undefined) parts.push(`Expires=${options.expires.toUTCString()}`);
	if (options.httpOnly ?? true) parts.push("HttpOnly");
	if (options.secure === true) parts.push("Secure");
	const sameSite = options.sameSite ?? "lax";
	parts.push(`SameSite=${sameSite[0]!.toUpperCase()}${sameSite.slice(1)}`);
	return parts.join("; ");
}

function attribute(name: string, value: string): string {
	if (UNSAFE_ATTRIBUTE.test(value)) {
		throw new Error(`cookie ${name} "${value}" contains a character that would end the attribute`);
	}
	return value;
}

/**
 * The cookies a `cookie` header carries, by name. Values arrive percent-encoded
 * and may be quoted — both are undone here, so what comes back out is what
 * {@link Cookies.set} was given.
 *
 * A browser sends the most specific cookie first when two share a name, so the
 * first of a repeated name is the one that wins.
 */
export function parseCookieHeader(header: string | null | undefined): Map<string, string> {
	const cookies = new Map<string, string>();
	if (header === null || header === undefined || header === "") return cookies;
	for (const pair of header.split(";")) {
		const equals = pair.indexOf("=");
		if (equals === -1) continue;
		const name = pair.slice(0, equals).trim();
		if (name === "" || cookies.has(name)) continue;
		cookies.set(name, decodeCookieValue(pair.slice(equals + 1).trim()));
	}
	return cookies;
}

function decodeCookieValue(raw: string): string {
	const unquoted =
		raw.length >= 2 && raw.startsWith('"') && raw.endsWith('"') ? raw.slice(1, -1) : raw;
	try {
		return decodeURIComponent(unquoted);
	} catch {
		// a value that is not percent-encoded at all ("100%") is still a value;
		// handing back what the browser sent beats throwing out of a `get`
		return unquoted;
	}
}

/** The request's cookies plus the ones it is answering with, as the pipeline holds them. */
export type CookieJar = {
	/** What the event exposes. */
	cookies: Cookies;
	/**
	 * The `Set-Cookie` values written since the last flush, emptying the
	 * pending list — so a cookie lands on exactly one response however many
	 * times the pipeline applies its headers.
	 */
	flush(): string[];
	/**
	 * The `cookie` header as it now stands: what the request arrived with, with
	 * this request's own writes over it. What `event.fetch` forwards on a
	 * same-origin call, so an endpoint reached from a load sees the session a
	 * hook just issued rather than the one before it. `null` when nothing is
	 * left to send.
	 */
	header(): string | null;
};

/**
 * The cookie jar for one request. `url` is the event's, which is what decides
 * the `secure` default — the node adapter resolves `x-forwarded-proto` into
 * it, so an app behind a TLS-terminating proxy still sets secure cookies.
 */
export function createCookieJar(request: Request, url: URL): CookieJar {
	const incoming = parseCookieHeader(request.headers.get("cookie"));
	/** Cookies this request has set or deleted, by name — a delete is `null`. */
	const written = new Map<string, string | null>();
	let pending: string[] = [];

	const value = (name: string): string | undefined => {
		const change = written.get(name);
		if (change !== undefined) return change ?? undefined;
		return incoming.get(name);
	};

	const cookies: Cookies = {
		get: value,
		getAll: () => {
			const names = new Set([...incoming.keys(), ...written.keys()]);
			return [...names].flatMap((name) => {
				const current = value(name);
				return current === undefined ? [] : [{ name, value: current }];
			});
		},
		set: (name, cookieValue, options = {}) => {
			pending.push(
				serializeCookie(name, cookieValue, {
					...options,
					secure: options.secure ?? url.protocol === "https:",
				}),
			);
			written.set(name, cookieValue);
		},
		delete: (name, options = {}) => {
			// a delete is the same cookie with nothing in it and an expiry the
			// browser has already passed; both forms go out, since a browser old
			// enough to ignore `Max-Age` still honours `Expires`. `secure` follows
			// the request like it does on the way in — a plain cookie cannot
			// overwrite a secure one of the same name
			pending.push(
				serializeCookie(name, "", {
					...options,
					maxAge: 0,
					expires: new Date(0),
					secure: url.protocol === "https:",
				}),
			);
			written.set(name, null);
		},
	};

	return {
		cookies,
		flush: () => {
			const flushed = pending;
			pending = [];
			return flushed;
		},
		header: () => {
			const parts = cookies
				.getAll()
				.map(({ name, value: current }) => `${name}=${encodeURIComponent(current)}`);
			return parts.length === 0 ? null : parts.join("; ");
		},
	};
}
