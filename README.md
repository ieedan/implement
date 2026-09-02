<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="apps/docs/static/favicon-dark.svg">
    <img src="apps/docs/static/favicon-light.svg" alt="implementjs" width="96">
  </picture>
</p>

<h1 align="center">implementjs</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/@implementjs/core"><img src="https://img.shields.io/npm/v/@implementjs/core" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/@implementjs/core"><img src="https://img.shields.io/npm/dm/@implementjs/core" alt="npm downloads"></a>
</p>

Implement is a UI library that truly is just JS. This is an experiment to see how ergonomic and performant a template-less approach to a UI library can be.

This approach is inspired by Swift UI with a lot of patterns and behaviors taken from Svelte.

```ts
import { App, Button, Div, P, signal, derived } from "@implementjs/core";

const app = App({ target: document.body });

function Counter() {
    const count = signal(0);
    const doubled = derived([count], (c) => c * 2);

    return Div(
        Button({ onClick: () => count.increment() }, "Count: ", count),
        P("Doubled: ", doubled)
    );
}

app.render(Counter());
```

## The advantages of implementjs

- No compiler - there is no compiler, and no virtual DOM. Your TypeScript can be built into JS and run in the browser. And if you aren't using TypeScript then no build is even easier. This also means a hello world can ship smaller than many other frameworks.
- Agent friendly - the simple fine grained reactivity model makes it easy for agents to write huge amounts of code with far fewer reactivity bugs. There is no auto-dependency tracking to shoot them in the foot.
- We don't cheat - you can also build any of the language structures we can, ForEach, If, Switch, etc. it's just TypeScript.

## Getting Started

You can scaffold a new implementjs app with the following command:

```bash
npm create implement-app@latest
```

You can either start with `@implementjs/kit` (A fullstack framework built on top of Vite) or just start with a static site.

If you are building with agents you may also want to add our skills. Our skills are essentially just a collection of links to [our documentation](https://implementjs.dev/docs).
```sh
npx skills add ieedan/implement
```

## Examples

> If you build something cool with implementjs share it with us so we can put it here!

- [Linear Style Issue Tracker](https://github.com/ieedan/tracker) - An open source Linear clone built with implementjs.

## Packages

- `@implementjs/core` - The implementjs core library.
- `@implementjs/kit` - File-based routing, server rendering, and prerendering on top of Vite (Heavily inspired by SvelteKit).
- `@implementjs/vite` - Vite plugin for server rendering, prerendering, and dev styles.
- `@implementjs/router` - A client side router implementation.
- `@implementjs/ui` - A shadcn/ui style library built with implementjs distributed with jsrepo.
- `@implementjs/primitives` - A headless UI library built with implementjs.
- `@implementjs/formish` - A port of the formish library for implementjs.
- `@implementjs/lucide` - Lucide icons for implementjs.
- `@implementjs/mode-watcher` - A port of [svecosystem/mode-watcher](https://github.com/svecosystem/mode-watcher) for implementjs.
- `@implementjs/eslint` - Lint rules to catch some common implementjs mistakes.
- `@implementjs/adapter-node` - Builds a kit app into a standalone Node server.
- `@implementjs/adapter-static` - Builds a kit app into static files.
- `@implementjs/adapter-vercel` - Builds a kit app for Vercel (Build Output API).
- `@implementjs/adapter-cloudflare` - Builds a kit app into a Cloudflare worker with static assets.
- `@implementjs/adapter-iis` - Builds a kit app for IIS on Windows Server.
- `create-implement-app` - Scaffolds a new implement app.
- `implement-vscode` - Some snippets that make writing implementjs code a bit more ergonomic in VS Code.
