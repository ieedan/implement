---
title: Introduction
description: Framework-aware lint rules for implement apps — leaked subscriptions, broken ARIA, and Lifecycle that could be Effect.
section: Start Here
order: 1
---

TypeScript catches a lot in an implement app, because there is no template language for it to lose sight of — a component is a function call and its props are an object literal. But some mistakes are the right shape and still wrong. `aria-lable` is a perfectly good key on a props object. A `subscribe` whose unsubscribe you drop on the floor type-checks exactly like one you keep.

`@implementjs/eslint` is a small set of rules for those. It is written against ESLint's plugin API, and it runs under **either** linter — ESLint, or [oxlint](https://oxc.rs) through oxlint's ESLint-compatible plugin support. One package, one set of rules, whichever linter you already have.

[Set it up](/eslint/setup) in a few lines of config, and read [how the rules see your code](/eslint/how-rules-work) for what they can and cannot tell you.

## The rules

Six of them are about implement itself — signals that get read wrong, subscriptions that outlive their owner, markup that renders once when it meant to stay live:

| Rule                                                       | Recommended | Catches                                                                |
| ---------------------------------------------------------- | ----------- | ---------------------------------------------------------------------- |
| [`no-hanging-unsubscribe`](/eslint/no-hanging-unsubscribe) | error       | a subscription to a longer-lived signal whose unsubscribe is discarded |
| [`prefer-effect`](/eslint/prefer-effect)                   | warn        | an `ImplementLifecycle` that exists only to own a `watch`              |
| [`no-signal-condition`](/eslint/no-signal-condition)       | error       | a signal tested for truth, which is always true                        |
| [`no-signal-collection`](/eslint/no-signal-collection)     | warn        | a `Set` or `Map` inside a `signal()` rather than a reactive collection |
| [`prefer-foreach`](/eslint/prefer-foreach)                 | error       | `.get().map()` rendering a list that will never update                 |
| [`no-html`](/eslint/no-html)                               | error       | every use of `Html`, which does not sanitize                           |

The other five check the accessibility props you write by hand, against the [WAI-ARIA 1.2](https://www.w3.org/TR/wai-aria-1.2/) vocabulary:

| Rule                                                                   | Recommended | Catches                                                             |
| ---------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------- |
| [`valid-aria`](/eslint/valid-aria)                                     | error       | a misspelled `aria-*` key, or a value the attribute does not permit |
| [`valid-role`](/eslint/valid-role)                                     | error       | a misspelled or abstract `role`                                     |
| [`role-has-required-aria-props`](/eslint/role-has-required-aria-props) | error       | a role missing the property it is incomplete without                |
| [`role-supports-aria-props`](/eslint/role-supports-aria-props)         | error       | an `aria-*` property the role ignores                               |
| [`no-redundant-roles`](/eslint/no-redundant-roles)                     | warn        | a `role` an element already has                                     |
