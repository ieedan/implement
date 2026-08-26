import { describe, expect, it } from "vitest";
import { createCookieJar, parseCookieHeader, serializeCookie } from "../src/cookies.ts";

/** A jar for a request carrying `cookie`, served over `origin`. */
function jar(cookie?: string, origin = "https://example.com") {
	const url = new URL(`${origin}/app/acme/issue/9`);
	const request = new Request(url, cookie === undefined ? {} : { headers: { cookie } });
	return createCookieJar(request, url);
}

describe("parseCookieHeader", () => {
	it("reads pairs, trimming the spaces browsers put between them", () => {
		expect([...parseCookieHeader("session=abc; theme=dark")]).toEqual([
			["session", "abc"],
			["theme", "dark"],
		]);
	});

	it("unquotes and decodes values", () => {
		expect(parseCookieHeader('greeting="hello%20world"').get("greeting")).toBe("hello world");
		expect(parseCookieHeader("path=%2Fapp%2Facme").get("path")).toBe("/app/acme");
	});

	it("hands back a value that was never encoded rather than throwing", () => {
		expect(parseCookieHeader("discount=100%").get("discount")).toBe("100%");
	});

	it("keeps the first of a repeated name, which is the most specific one", () => {
		expect(parseCookieHeader("id=deep; id=root").get("id")).toBe("deep");
	});

	it("skips what is not a pair, and an absent header", () => {
		expect([...parseCookieHeader("broken; =nameless; ok=1")]).toEqual([["ok", "1"]]);
		expect(parseCookieHeader(null).size).toBe(0);
		expect(parseCookieHeader("").size).toBe(0);
	});
});

describe("serializeCookie", () => {
	it("fills in the defaults a server cookie wants", () => {
		expect(serializeCookie("session", "abc")).toBe("session=abc; Path=/; HttpOnly; SameSite=Lax");
	});

	it("encodes the value, so anything a string holds survives the round trip", () => {
		const value = "a b;c=d";
		const header = serializeCookie("state", value);
		expect(header.startsWith("state=a%20b%3Bc%3Dd;")).toBe(true);
		expect(parseCookieHeader(header.split(";")[0]).get("state")).toBe(value);
	});

	it("writes every attribute the way Set-Cookie spells it", () => {
		expect(
			serializeCookie("session", "abc", {
				path: "/app",
				domain: "example.com",
				maxAge: 60,
				expires: new Date(0),
				httpOnly: false,
				secure: true,
				sameSite: "none",
			}),
		).toBe(
			"session=abc; Path=/app; Domain=example.com; Max-Age=60; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure; SameSite=None",
		);
	});

	it("truncates a fractional Max-Age, which no browser reads as a duration", () => {
		expect(serializeCookie("a", "b", { maxAge: 1.5 })).toContain("Max-Age=1");
	});

	it("refuses a name or an attribute that would rewrite the header", () => {
		expect(() => serializeCookie("bad name", "x")).toThrow(/not a valid cookie name/);
		expect(() => serializeCookie("a", "b", { path: "/x; Domain=evil.com" })).toThrow(
			/would end the attribute/,
		);
	});
});

describe("the cookie jar", () => {
	it("reads what the request arrived with", () => {
		const { cookies } = jar("session=abc; theme=dark");
		expect(cookies.get("session")).toBe("abc");
		expect(cookies.getAll()).toEqual([
			{ name: "session", value: "abc" },
			{ name: "theme", value: "dark" },
		]);
		expect(cookies.get("missing")).toBeUndefined();
	});

	it("reads back what this request set, over what the browser sent", () => {
		const { cookies } = jar("theme=dark");
		cookies.set("theme", "light");
		cookies.set("session", "abc");
		expect(cookies.get("theme")).toBe("light");
		expect(cookies.get("session")).toBe("abc");
		cookies.delete("session");
		expect(cookies.get("session")).toBeUndefined();
		expect(cookies.getAll()).toEqual([{ name: "theme", value: "light" }]);
	});

	it("writes one Set-Cookie per cookie, since the header is legitimately repeated", () => {
		const cookieJar = jar();
		cookieJar.cookies.set("a", "1");
		cookieJar.cookies.set("b", "2");
		expect(cookieJar.flush()).toEqual([
			"a=1; Path=/; HttpOnly; Secure; SameSite=Lax",
			"b=2; Path=/; HttpOnly; Secure; SameSite=Lax",
		]);
	});

	it("flushes each cookie once, so applying headers twice does not send it twice", () => {
		const cookieJar = jar();
		cookieJar.cookies.set("a", "1");
		expect(cookieJar.flush()).toHaveLength(1);
		expect(cookieJar.flush()).toEqual([]);
	});

	it("deletes with an expiry in the past, scoped the way the cookie was set", () => {
		const cookieJar = jar("session=abc");
		cookieJar.cookies.delete("session", { path: "/app" });
		expect(cookieJar.flush()).toEqual([
			"session=; Path=/app; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Lax",
		]);
	});

	it("marks a cookie secure when the request itself was, and not when it was not", () => {
		const secure = jar(undefined, "https://example.com");
		secure.cookies.set("a", "1");
		expect(secure.flush()[0]).toContain("Secure");

		// dev over http://localhost is the case a blanket `Secure` breaks: the
		// browser drops the cookie and nothing says why
		const local = jar(undefined, "http://localhost:5173");
		local.cookies.set("a", "1");
		expect(local.flush()[0]).not.toContain("Secure");
	});

	it("hands event.fetch the cookies as they now stand", () => {
		const cookieJar = jar("session=old");
		expect(cookieJar.header()).toBe("session=old");
		cookieJar.cookies.set("session", "new one");
		expect(cookieJar.header()).toBe("session=new%20one");
		cookieJar.cookies.delete("session");
		expect(cookieJar.header()).toBeNull();
	});
});
