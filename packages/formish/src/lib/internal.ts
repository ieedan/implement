/**
 * The key the internal store hangs off a form store. Everything reachable
 * through it is formish's own state — read it and you are writing formish, not
 * using it.
 */
export const INTERNAL: unique symbol = Symbol("formish.internal");
