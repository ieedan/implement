import { describe, expect, it } from "vitest";
import { type WebConfigSettings, webConfig } from "../src/web-config.ts";

function settings(overrides: Partial<WebConfigSettings> = {}): WebConfigSettings {
	return {
		hosting: "iisnode",
		entry: "index.js",
		nodeExe: "node.exe",
		env: {},
		externalRoutes: [],
		redirectToHttps: false,
		maxRequestBodySize: 30_000_000,
		iisnode: {},
		httpPlatform: {},
		...overrides,
	};
}

describe("webConfig", () => {
	it("opens with the XML declaration, which IIS requires on the first line", () => {
		expect(webConfig(settings()).split("\n")[0]).toBe('<?xml version="1.0" encoding="utf-8"?>');
	});

	it("maps the entry to iisnode and rewrites every path onto it", () => {
		const xml = webConfig(settings());
		expect(xml).toContain('<add name="iisnode" path="index.js" verb="*" modules="iisnode" />');
		expect(xml).toContain('<rule name="implement" stopProcessing="true">');
		expect(xml).toContain('<action type="Rewrite" url="index.js" />');
		expect(xml).toContain('nodeProcessCommandLine="node.exe"');
		expect(xml).toContain('enableXFF="true"');
	});

	it("watches the .cjs entry too, since that is the file iisnode is pointed at", () => {
		expect(webConfig(settings({ entry: "index.cjs" }))).toContain(
			'watchedFiles="web.config;*.js;*.cjs"',
		);
	});

	it("passes the app's own error bodies through instead of IIS's error pages", () => {
		expect(webConfig(settings())).toContain('<httpErrors existingResponse="PassThrough" />');
	});

	it("raises the request limit to what the adapter was given", () => {
		expect(webConfig(settings({ maxRequestBodySize: 104_857_600 }))).toContain(
			'<requestLimits maxAllowedContentLength="104857600" />',
		);
	});

	it("carries the environment as appSettings, which iisnode copies into process.env", () => {
		const xml = webConfig(
			settings({ env: { ORIGIN: "https://example.com", NODE_ENV: "production" } }),
		);
		expect(xml).toContain('<add key="ORIGIN" value="https://example.com" />');
		expect(xml).toContain('<add key="NODE_ENV" value="production" />');
	});

	it("escapes values, since a bare & in an attribute is a 500.19 rather than a bad page", () => {
		const xml = webConfig(settings({ env: { QUERY: 'a&b<c>d"e' } }));
		expect(xml).toContain('value="a&amp;b&lt;c&gt;d&quot;e"');
		expect(xml).not.toContain('value="a&b');
	});

	it("leaves the paths IIS handles itself alone", () => {
		const xml = webConfig(settings({ externalRoutes: ["reports", "/legacy"] }));
		expect(xml).toContain('<match url="^(reports|legacy)(/.*)?$" />');
		expect(xml).toContain('<action type="None" />');
		// the rule that answers everything else has to come after this one
		expect(xml.indexOf("external routes")).toBeLessThan(xml.indexOf('name="implement"'));
	});

	it("redirects to https ahead of every other rule, when asked to", () => {
		const xml = webConfig(settings({ redirectToHttps: true, externalRoutes: ["reports"] }));
		expect(xml).toContain('<add input="{HTTPS}" pattern="off" ignoreCase="true" />');
		expect(xml.indexOf("redirect to https")).toBeLessThan(xml.indexOf("external routes"));
	});

	it("omits the rewrite section entirely when there is nothing to rewrite", () => {
		expect(webConfig(settings({ hosting: "httpPlatform" }))).not.toContain("<rewrite>");
	});

	it("starts the process with HttpPlatformHandler instead, when that is the host", () => {
		const xml = webConfig(
			settings({ hosting: "httpPlatform", env: { ORIGIN: "https://example.com" } }),
		);
		expect(xml).toContain('<remove name="httpPlatformHandler" />');
		expect(xml).toContain('modules="httpPlatformHandler"');
		expect(xml).toContain('processPath="node.exe"');
		expect(xml).toContain('arguments=".\\index.js"');
		// its environment is its own element, not appSettings
		expect(xml).toContain('<environmentVariable name="ORIGIN" value="https://example.com" />');
		expect(xml).not.toContain("<appSettings>");
		expect(xml).not.toContain('modules="iisnode"');
	});

	it("gives a stream longer than four minutes to finish before IIS cuts it", () => {
		expect(webConfig(settings({ hosting: "httpPlatform" }))).toContain('requestTimeout="00:20:00"');
	});

	it("takes the node executable the site was told to run", () => {
		expect(webConfig(settings({ nodeExe: "C:\\Program Files\\nodejs\\node.exe" }))).toContain(
			'nodeProcessCommandLine="C:\\Program Files\\nodejs\\node.exe"',
		);
	});

	it("lets an app override the defaults for either module", () => {
		const node = webConfig(settings({ iisnode: { loggingEnabled: true, node_env: "staging" } }));
		expect(node).toContain('loggingEnabled="true"');
		expect(node).toContain('node_env="staging"');
		expect(node).not.toContain('node_env="production"');

		const platform = webConfig(
			settings({ hosting: "httpPlatform", httpPlatform: { requestTimeout: "01:00:00" } }),
		);
		expect(platform).toContain('requestTimeout="01:00:00"');
		expect(platform).not.toContain('requestTimeout="00:20:00"');
	});
});
