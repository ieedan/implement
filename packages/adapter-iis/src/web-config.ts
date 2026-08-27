/**
 * The `web.config` IIS reads to find the app — the one file that turns a
 * directory of JavaScript into a site.
 *
 * IIS parses this before anything of ours runs, and it is unforgiving: an
 * unescaped `&` in an attribute is a 500.19 with a configuration error rather
 * than a request the app ever sees. So every value that comes from an app's
 * options goes through {@link attribute} on its way in.
 */

/** Which IIS module launches and proxies to the Node process. */
export type Hosting = "iisnode" | "httpPlatform";

/** An `iisnode` or `httpPlatform` attribute, as it is written into the XML. */
export type Attributes = Record<string, string | number | boolean>;

export type WebConfigSettings = {
	hosting: Hosting;
	/** The file IIS launches, relative to the site root. */
	entry: string;
	/** `node.exe`, or an absolute path to the one this site should run on. */
	nodeExe: string;
	/** Environment the Node process starts with. */
	env: Record<string, string>;
	/** Paths IIS answers itself — a virtual directory, an ASP.NET app beside this one. */
	externalRoutes: string[];
	/** Whether to add the rewrite rule that sends `http://` to `https://`. */
	redirectToHttps: boolean;
	/** The largest request body IIS lets through, in bytes. */
	maxRequestBodySize: number;
	/** Extra `<iisnode>` attributes, overriding the defaults. */
	iisnode: Attributes;
	/** Extra `<httpPlatform>` attributes, overriding the defaults. */
	httpPlatform: Attributes;
};

/**
 * Escapes a value for an XML attribute. `&` has to go first, or the escapes
 * this adds are themselves escaped.
 */
function attribute(value: string | number | boolean): string {
	return String(value)
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&apos;");
}

/** `key="value"` pairs, in the order the record lists them, ready to follow a tag name. */
function attributes(values: Attributes): string {
	return Object.entries(values)
		.map(([key, value]) => ` ${key}="${attribute(value)}"`)
		.join("");
}

/** Indents a block of already-formatted XML by `depth` tabs. */
function indent(xml: string, depth: number): string {
	const padding = "\t".repeat(depth);
	return xml
		.split("\n")
		.map((line) => (line === "" ? line : padding + line))
		.join("\n");
}

/**
 * `<appSettings>`, which is how the Node process gets its environment under
 * iisnode: it copies every key in here into the child's `process.env`.
 */
function appSettings(env: Record<string, string>): string {
	const entries = Object.entries(env).map(
		([key, value]) => `\t<add key="${attribute(key)}" value="${attribute(value)}" />`,
	);
	return ["<appSettings>", ...entries, "</appSettings>"].join("\n");
}

/** `<environmentVariables>`, the same thing for HttpPlatformHandler. */
function environmentVariables(env: Record<string, string>): string {
	const entries = Object.entries(env).map(
		([key, value]) =>
			`\t<environmentVariable name="${attribute(key)}" value="${attribute(value)}" />`,
	);
	return ["<environmentVariables>", ...entries, "</environmentVariables>"].join("\n");
}

/**
 * The rules, in the order IIS evaluates them: the protocol first, since a
 * redirect should happen before anything reads the request; then the paths
 * that are not this app's at all; then everything left, which is the app.
 */
function rewrite(settings: WebConfigSettings): string {
	const rules: string[] = [];

	if (settings.redirectToHttps) {
		rules.push(
			[
				'<rule name="redirect to https" stopProcessing="true">',
				'\t<match url=".*" />',
				"\t<conditions>",
				'\t\t<add input="{HTTPS}" pattern="off" ignoreCase="true" />',
				"\t</conditions>",
				'\t<action type="Redirect" url="https://{HTTP_HOST}{REQUEST_URI}" redirectType="Permanent" appendQueryString="false" />',
				"</rule>",
			].join("\n"),
		);
	}

	if (settings.externalRoutes.length > 0) {
		// `None` leaves the URL alone and stops here, so IIS goes on to whatever
		// it would have done without this app in the way — a virtual directory,
		// another application under the same site
		const pattern = settings.externalRoutes.map((route) => route.replace(/^\/+/, "")).join("|");
		rules.push(
			[
				'<rule name="external routes" stopProcessing="true">',
				`\t<match url="^(${attribute(pattern)})(/.*)?$" />`,
				'\t<action type="None" />',
				"</rule>",
			].join("\n"),
		);
	}

	if (settings.hosting === "iisnode") {
		// iisnode is mapped to one file, so every path the app answers has to be
		// rewritten onto it. `stopProcessing` is what keeps the rewritten URL
		// from falling back into this same rule.
		rules.push(
			[
				'<rule name="implement" stopProcessing="true">',
				'\t<match url=".*" />',
				`\t<action type="Rewrite" url="${attribute(settings.entry)}" />`,
				"</rule>",
			].join("\n"),
		);
	}

	if (rules.length === 0) return "";
	return ["<rewrite>", "\t<rules>", indent(rules.join("\n"), 2), "\t</rules>", "</rewrite>"].join(
		"\n",
	);
}

/** The handler mapping and process configuration for whichever module hosts the app. */
function hosting(settings: WebConfigSettings): string {
	if (settings.hosting === "iisnode") {
		const iisnode = attributes({
			nodeProcessCommandLine: settings.nodeExe,
			// what the app's own `process.env.NODE_ENV` reads, and what kit's
			// production behaviour keys off
			node_env: "production",
			// appends the client's address to X-Forwarded-For, which is where
			// `getClientAddress()` reads it from behind IIS
			enableXFF: true,
			// iisnode's logs are written per process and never rotated, so they
			// grow without bound on a site that recycles
			loggingEnabled: false,
			watchedFiles: "web.config;*.js",
			...settings.iisnode,
		});
		return [
			"<handlers>",
			`\t<add name="iisnode" path="${attribute(settings.entry)}" verb="*" modules="iisnode" />`,
			"</handlers>",
			`<iisnode${iisnode} />`,
		].join("\n");
	}

	const httpPlatform = attributes({
		processPath: settings.nodeExe,
		arguments: `.\\${settings.entry.replaceAll("/", "\\")}`,
		stdoutLogEnabled: false,
		stdoutLogFile: ".\\logs\\stdout",
		startupTimeLimit: 60,
		// IIS gives up on a request after this; a streaming endpoint that holds
		// its connection longer is cut here rather than by the app
		requestTimeout: "00:04:00",
		...settings.httpPlatform,
	});
	return [
		"<handlers>",
		'\t<remove name="httpPlatformHandler" />',
		'\t<add name="httpPlatformHandler" path="*" verb="*" modules="httpPlatformHandler" resourceType="Unspecified" requireAccess="Script" />',
		"</handlers>",
		`<httpPlatform${httpPlatform}>`,
		indent(environmentVariables(settings.env), 1),
		"</httpPlatform>",
	].join("\n");
}

/** The `web.config` for a built app, as a document. */
export function webConfig(settings: WebConfigSettings): string {
	const server = [
		hosting(settings),
		rewrite(settings),
		// without this IIS replaces the app's own 404 and 500 bodies with its
		// error pages, and the error route the app renders never reaches anyone
		'<httpErrors existingResponse="PassThrough" />',
		[
			"<security>",
			"\t<requestFiltering>",
			`\t\t<requestLimits maxAllowedContentLength="${attribute(settings.maxRequestBodySize)}" />`,
			"\t</requestFiltering>",
			"</security>",
		].join("\n"),
	].filter((section) => section !== "");

	const sections = [
		// under iisnode the environment is appSettings; HttpPlatformHandler has
		// its own element for it, written beside the process configuration
		...(settings.hosting === "iisnode" ? [appSettings(settings.env)] : []),
		["<system.webServer>", indent(server.join("\n"), 1), "</system.webServer>"].join("\n"),
	];

	// the XML declaration has to be the very first thing in the file — a leading
	// blank line or a BOM in front of it is a configuration error
	return [
		'<?xml version="1.0" encoding="utf-8"?>',
		"<configuration>",
		indent(sections.join("\n"), 1),
		"</configuration>",
		"",
	].join("\n");
}
