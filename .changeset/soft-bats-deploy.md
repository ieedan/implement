---
"@implementjs/adapter-iis": patch
---

Add `@implementjs/adapter-iis`, for deploying a kit app to IIS on Windows Server.

`vite build` writes `dist/`: the app as a Node server, the client bundle beside
it, and the `web.config` that tells IIS to start the one and hand it every
request. Copy the directory to the server and point a site at it — there is
nothing to set up in IIS Manager beyond that, and dependencies are bundled in,
so the folder is the whole deployment.

IIS does not run JavaScript, so a module in front has to start the process and
proxy to it. Both are supported: `hosting: "iisnode"` (the default, and what
most existing IIS-and-Node servers already have) and `hosting: "httpPlatform"`
for Microsoft's HttpPlatformHandler. They hand the process its socket in
different ways — iisnode a named pipe in `PORT`, HttpPlatformHandler a TCP port
in `HTTP_PLATFORM_PORT` — and the built server reads both.

The generated `web.config` carries the app's environment, keeps the app's own
error bodies from being replaced by IIS's error pages, raises the request-body
limit, and can leave named paths to a virtual directory beside the app.
`origin` pins the origin the app is served from, since IIS forwards the
visitor's own `Host` header.
