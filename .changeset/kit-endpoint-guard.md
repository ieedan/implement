---
"@implementjs/kit": patch
---

Treat a route's `server.ts` as server-only, and name the import that dragged a server file in.

An endpoint is not spelled `*.server.ts`, so the guard did not recognise one: a
client file importing a value from `src/routes/api/issues/server.ts` — a
validation schema shared with a form, usually — pulled the whole endpoint into
the client graph, handlers and database and all. It only ever surfaced one hop
later, if the endpoint happened to import a `*.server.ts`, and never at all if it
did not. Both layers now know an endpoint for what it is: the import errors at
the boundary, and the client copy of a `server.ts` is the same empty throwing
stub every server file gets.

The importer chain in that error now names the import each link wrote, so the one
to delete reads straight off the message instead of being bisected by hand:

```
src/lib/db.server.ts is a server file and cannot be imported by client code.

  src/lib/db.server.ts
  imported by src/routes/api/issues/server.ts as "@/lib/db.server"
    ← src/lib/features/issues/create-issue-dialog.ts:7 imports { NewIssueSchema }
    ← src/routes/(dashboard)/layout.ts:3 imports { CreateIssueDialog }
    ← $implement/router
```
