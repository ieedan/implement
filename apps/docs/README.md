# `@implementjs/ui`

The styled layer over [`@implementjs/primitives`](https://implementjs.dev/primitives): the
primitives own the behavior, these own the look. shadcn's design language, expressed in Tailwind
classes over a small set of CSS variables.

They are not a dependency. Each component is one TypeScript file that
[jsrepo](https://jsrepo.dev) copies into your project, and from that moment the file is yours.

```sh
npx jsrepo add @implementjs/ui/button
```

Imports are followed, so `select` brings `dropdown-menu` with it, and `cn` — the one thing every
component shares — arrives with the first component that needs it.

## What you need first

An [implement](https://implementjs.dev) app with Tailwind CSS v4, and the two packages the
components expect to already be there:

```sh
npm install @implementjs/core @implementjs/primitives
```

Those two are the only thing `jsrepo add` will not install for you. Everything else a component
reaches for — `tailwind-merge`, `tailwind-variants`, `@implementjs/lucide` — comes down with it.

The components never name a color directly: every class goes through a token, so the stylesheet
that defines them has to be in place before anything renders correctly.
[implementjs.dev/ui](https://implementjs.dev/ui) has it to paste, and
`create-implement-app --ui` writes it for you along with everything else on this page.

## The components

Every one of them has a page with an editable live demo, its full source, and the packages it
pulls in: [implementjs.dev/ui](https://implementjs.dev/ui).

---

This is also the README of the docs app the registry is built from — those pages render the same
files the registry ships. The rest of it is in
[the repository](https://github.com/ieedan/implement).
