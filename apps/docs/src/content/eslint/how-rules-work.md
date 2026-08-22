---
title: How the rules see your code
description: Every rule here works from syntax and scope alone — what that buys, and what it costs.
section: Start Here
order: 3
---

Every rule here works from syntax and scope alone. None of them ask TypeScript what a value is, and that is deliberate: oxlint does not give custom rules a type checker, so a rule that needed one would run under ESLint only.

They do read type **annotations**, which are just syntax: `id: Readable<string>` and `signal<Set<string>>()` say plainly what they are, and the rules use that. What they cannot do is infer — a signal reached through a destructured prop or an import from another file is simply not recognised, and the rules stay quiet rather than guess.

That buys portability and costs precision, in one specific way. The rules cannot follow a value across a file boundary. `Div({ role: "buton" })` is caught because the typo is right there in the object literal. Whether your `DialogTrigger` eventually renders a `<button>` — that lives three files away behind `createComponent`, and no rule here can tell you.

One more consequence worth knowing: every rule recognises core's helpers by the import they came through, matched against `@implementjs/core` exactly. Re-export `signal` or `Html` from a barrel of your own and the rules stop seeing it.

So treat these as a spell-checker for the things you write down, not an audit of what your components resolve to. In practice that is where the mistakes are anyway.
