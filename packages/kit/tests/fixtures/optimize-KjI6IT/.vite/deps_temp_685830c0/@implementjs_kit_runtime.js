import {
  derived,
  setNavigationResolver,
  signal
} from "./chunk-PGKIGHVG.js";
import {
  appMatchers,
  isParamMatcher,
  matcher,
  matcherTable,
  mismatch,
  registerMatchers
} from "./chunk-R47OUD5L.js";
import "./chunk-NCQMJJXZ.js";
import "./chunk-PX6F3LHL.js";

// src/errors.ts
var sources = /* @__PURE__ */ new WeakMap();
function markErrorSource(thrown, source) {
  if (typeof thrown === "object" && thrown !== null && !sources.has(thrown)) {
    sources.set(thrown, source);
  }
  return thrown;
}

// src/match.ts
function normalizeRoutePath(pathname) {
  let path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  while (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  return path;
}
function parsePatternSegment(part) {
  if (!part.startsWith(":")) return { param: false, value: part };
  const rest = part.startsWith(":...");
  const body = part.slice(rest ? 4 : 1);
  const equals = body.indexOf("=");
  return equals === -1 ? { param: true, rest, name: body, matcher: null } : { param: true, rest, name: body.slice(0, equals), matcher: body.slice(equals + 1) };
}
function parsePattern(pattern) {
  return pattern.split("/").filter(Boolean).map(parsePatternSegment);
}
function matchRoutePattern(pattern, path, matchers) {
  const segments = parsePattern(pattern);
  const parts = path.split("/").filter(Boolean).map(decodeURIComponent);
  const last = segments[segments.length - 1];
  const hasRest = last !== void 0 && last.param && last.rest;
  if (hasRest ? parts.length < segments.length : parts.length !== segments.length) return null;
  const params = {};
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    if (!segment.param) {
      if (segment.value !== parts[i]) return null;
      continue;
    }
    const raw = segment.rest ? parts.slice(i).join("/") : parts[i];
    if (segment.matcher === null || matchers === "structure") {
      params[segment.name] = raw;
      continue;
    }
    const matcher2 = matchers[segment.matcher];
    if (matcher2 === void 0) {
      throw new Error(
        `"${pattern}" matches its "${segment.name}" against "${segment.matcher}", which is not a registered param matcher`
      );
    }
    const value = matcher2.match(raw);
    if (value === mismatch) return null;
    params[segment.name] = value;
  }
  return params;
}
function patternSegmentRank(segment) {
  if (!segment.param) return 0;
  const base = segment.rest ? 3 : 1;
  return segment.matcher === null ? base + 1 : base;
}
function comparePatterns(a, b) {
  const left = parsePattern(a);
  const right = parsePattern(b);
  const length = Math.min(left.length, right.length);
  for (let i = 0; i < length; i++) {
    const difference = patternSegmentRank(left[i]) - patternSegmentRank(right[i]);
    if (difference !== 0) return difference;
  }
  return left.length - right.length;
}
function routeId(pattern) {
  return pattern.split("/").map((part) => part.startsWith(":") ? `[${part.replace(/^:(\.\.\.)?/, "$1")}]` : part).join("/");
}
function matchPage(pages, path, matchers) {
  const sorted = [...pages].toSorted((a, b) => comparePatterns(a.pattern, b.pattern));
  for (const route of sorted) {
    const params = matchRoutePattern(route.pattern, path, matchers);
    if (params !== null) return { route, params };
  }
  return null;
}
async function runLoads(route, event) {
  if (route.files.length === 0) return null;
  const data = {};
  for (const { id, load } of route.files) {
    try {
      data[id] = await load(event) ?? {};
    } catch (thrown) {
      throw markErrorSource(thrown, { kind: "load", file: id });
    }
  }
  return data;
}
function matchEndpoint(endpoints, path, matchers) {
  const sorted = [...endpoints].toSorted(
    (a, b) => comparePatterns(a.pattern, b.pattern) || (a.extension === null ? 1 : 0) - (b.extension === null ? 1 : 0)
  );
  for (const route of sorted) {
    let base = path;
    if (route.extension !== null) {
      if (!path.endsWith(route.extension)) continue;
      base = normalizeRoutePath(path.slice(0, -route.extension.length));
    }
    const params = matchRoutePattern(route.pattern, base, matchers);
    if (params !== null) return { route, params };
  }
  return null;
}
function dataPath(path) {
  return path === "/" ? "/__data.json" : `${path}/__data.json`;
}

// src/lazy.ts
var handles = /* @__PURE__ */ new Map();
function lazyModule(id, importer) {
  let resolved = null;
  let loading = null;
  const handle = {
    load() {
      if (resolved !== null) return Promise.resolve();
      loading ??= importer().then(
        (module) => {
          resolved = { value: module.default };
          loading = null;
        },
        (error) => {
          loading = null;
          throw error;
        }
      );
      return loading;
    },
    get() {
      if (resolved === null) {
        throw new Error(
          `route module "${id}" rendered before it loaded — this render path is missing its preloadRoute`
        );
      }
      return resolved.value;
    }
  };
  handles.set(id, handle);
  return handle;
}
var moduleRoutes = [];
function registerRouteModules(routes) {
  moduleRoutes = routes.toSorted((a, b) => comparePatterns(a.pattern, b.pattern));
}
async function preloadRoute(url) {
  const path = normalizeRoutePath(new URL(url, "http://implement.internal").pathname);
  const matchers = appMatchers();
  const route = moduleRoutes.find(
    (entry) => matchRoutePattern(entry.pattern, path, matchers) !== null
  );
  if (route === void 0) return;
  await Promise.all(route.modules.map((id) => handleFor(id).load()));
}
function handleFor(id) {
  const handle = handles.get(id);
  if (handle === void 0) {
    throw new Error(`no route module declared for "${id}"`);
  }
  return handle;
}

// src/runtime.ts
var store = /* @__PURE__ */ new Map();
function fileData(id) {
  let entry = store.get(id);
  if (entry === void 0) {
    entry = signal({});
    store.set(id, entry);
  }
  return entry;
}
function seedData(data) {
  for (const [id, value] of Object.entries(data)) {
    fileData(id).set(value ?? {});
  }
}
function routeData(files) {
  return derived(files.map(fileData), (...values) => Object.assign({}, ...values));
}
var clientRoutes = [];
function registerRoutes(routes) {
  clientRoutes = routes;
}
async function fetchRouteData(path) {
  const matchers = appMatchers();
  const route = clientRoutes.find(
    (entry) => matchRoutePattern(entry.pattern, path, matchers) !== null
  );
  if (route === void 0) return;
  const response = await fetch(dataPath(path));
  if (!response.ok) throw new Error(`fetching route data failed: ${response.status}`);
  seedData(await response.json());
}
function initClientData() {
  const embedded = document.querySelector("script[data-implement-data]");
  if (embedded?.textContent && store.size === 0) {
    seedData(JSON.parse(embedded.textContent));
  }
  setNavigationResolver(async (to) => {
    if (to.path === normalizeRoutePath(window.location.pathname)) return;
    try {
      await Promise.all([preloadRoute(to.path), fetchRouteData(to.path)]);
    } catch (error) {
      window.location.assign(to.path + to.search + to.hash);
      throw error;
    }
  });
}
export {
  appMatchers,
  comparePatterns,
  dataPath,
  initClientData,
  isParamMatcher,
  lazyModule,
  matchEndpoint,
  matchPage,
  matchRoutePattern,
  matcher,
  matcherTable,
  mismatch,
  preloadRoute,
  registerMatchers,
  registerRouteModules,
  registerRoutes,
  routeData,
  routeId,
  runLoads,
  seedData
};
//# sourceMappingURL=@implementjs_kit_runtime.js.map
