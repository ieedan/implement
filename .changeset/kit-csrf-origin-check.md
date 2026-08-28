---
"@implementjs/kit": patch
---

Reject cross-site form submissions that mutate, and say out loud that kit does
nothing else about where a request came from.

Kit has never had built-in CORS, which was hard to tell from the outside: an
endpoint that wanted to be read cross-origin had to hand-roll its
`access-control-*` headers and an `OPTIONS` handler, and nothing said whether
it was working around a policy or filling in for the absence of one. It was the
absence of one — kit adds no `access-control-*` headers to anything, so a public
`GET` is as open as the headers it sets for itself. That is now written down,
with the pattern, in [Server
Routes](https://implementjs.dev/kit/server-routes#cross-origin-requests).

What was missing is the gate SvelteKit does have, and kit now has the same one.
A `POST`, `PUT`, `PATCH`, or `DELETE` carrying `application/x-www-form-urlencoded`,
`multipart/form-data`, or `text/plain` from an origin that is not yours is
answered `403` before hooks run — those are the content types a `<form>` on
someone else's page can send at your app with no preflight and no opt-in from
you. Everything else is untouched: a cross-origin `GET`, and a `POST` of
`application/json`, which a browser will not send cross-site until your endpoint
answers the preflight allowing it.

Two things to know if you have a non-browser client:

- A request with no `Origin` header counts as cross-site, so
  `fetch(url, { method: "POST", body: "…" })` with no `content-type` — which
  sends `text/plain` — now gets the `403`. Sending `application/json` is enough.
- `kit({ csrf: { trustedOrigins: ["https://admin.example.com"] } })` names
  origins allowed to post forms anyway, and `csrf: { checkOrigin: false }` turns
  the check off entirely.

Requests the pipeline dispatches to itself through `event.fetch` are never
gated: they never crossed a network, so there is no browser to have been made
to send them.
