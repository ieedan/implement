import { state } from "./state.ts";

// Stands in for what `@implementjs/kit/og` imports lazily: satori's harfbuzz
// build reads `__dirname` as it evaluates, which an ESM bundle does not have.
// A bundle that inlined every dynamic import would run this at load.
state.evaluated = true;
