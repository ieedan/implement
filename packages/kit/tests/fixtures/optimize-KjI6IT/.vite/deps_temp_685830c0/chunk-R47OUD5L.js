// src/params.ts
var mismatch = /* @__PURE__ */ Symbol.for("implementjs:param-mismatch");
var MATCHER = /* @__PURE__ */ Symbol.for("implementjs:param-matcher");
function matcher(source) {
  if (source instanceof RegExp) {
    const anchored = wholeSegment(source);
    return define((value) => anchored.test(value) ? value : mismatch);
  }
  if (typeof source === "function") return define(source);
  return define((value) => {
    const result = source["~standard"].validate(value);
    if (result instanceof Promise) {
      throw new Error(
        "a param matcher's schema has to validate synchronously — a route match cannot be awaited"
      );
    }
    return result.issues === void 0 ? result.value : mismatch;
  });
}
function define(match) {
  return { [MATCHER]: true, match };
}
function wholeSegment(pattern) {
  return new RegExp(`^(?:${pattern.source})$`, pattern.flags.replaceAll(/[gy]/g, ""));
}
function isParamMatcher(value) {
  return typeof value === "object" && value !== null && // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Reading a brand key off an unknown object is the check itself.
  value[MATCHER] === true;
}
function matcherTable(table, dir) {
  const matchers = {};
  for (const [name, value] of Object.entries(table)) {
    if (!isParamMatcher(value)) {
      throw new Error(
        `${dir}/${name}.ts must default-export a matcher() — got ${value === null ? "null" : typeof value}`
      );
    }
    matchers[name] = value;
  }
  return matchers;
}
var registered = {};
function registerMatchers(matchers) {
  registered = matchers;
}
function appMatchers() {
  return registered;
}

export {
  mismatch,
  matcher,
  isParamMatcher,
  matcherTable,
  registerMatchers,
  appMatchers
};
//# sourceMappingURL=chunk-R47OUD5L.js.map
