import {
  A,
  ImplementEffect,
  ImplementLifecycle,
  Outlet,
  derived,
  isReadable,
  location,
  navigateTo,
  normalizePath,
  searchParam,
  signal
} from "./chunk-PGKIGHVG.js";
import "./chunk-NCQMJJXZ.js";
import "./chunk-PX6F3LHL.js";

// ../router/src/index.ts
var mismatch = /* @__PURE__ */ Symbol.for("implementjs:param-mismatch");
function parseKey(key) {
  const raw = key.startsWith("/") ? key : `/${key}`;
  return raw.split("/").filter(Boolean).filter((part) => !(part.startsWith("(") && part.endsWith(")"))).map((part) => {
    if (!part.startsWith(":")) return { param: false, value: part };
    const rest = part.startsWith(":...");
    const body = part.slice(rest ? 4 : 1);
    const equals = body.indexOf("=");
    return equals === -1 ? { param: true, rest, name: body, matcher: null } : { param: true, rest, name: body.slice(0, equals), matcher: body.slice(equals + 1) };
  });
}
function routePath(segments) {
  if (segments.length === 0) return "/";
  return `/${segments.map((segment) => segment.param ? `:${segment.name}` : segment.value).join("/")}`;
}
function assertMatchersExist(routes, matchers) {
  for (const route of routes) {
    for (const segment of route.segments) {
      if (!segment.param || segment.matcher === null) continue;
      if (matchers[segment.matcher] === void 0) {
        throw new Error(
          `Route "${routePath(route.segments)}" matches ":${segment.name}" against "${segment.matcher}", which is not in the router's matchers`
        );
      }
    }
  }
}
function assertRouteRender(value, at) {
  if (typeof value !== "function") {
    throw new Error(`Route render at ${at} must be a function, got ${typeof value}`);
  }
  return value;
}
function assertLayoutHandler(value) {
  if (typeof value !== "function") {
    throw new Error(`Route layout must be a function, got ${typeof value}`);
  }
  return value;
}
function compileNode(node, prefix, layouts, out) {
  const scope = node.layout === void 0 ? layouts : [...layouts, { handler: assertLayoutHandler(node.layout) }];
  for (const [key, value] of Object.entries(node)) {
    if (key === "layout") continue;
    if (key === "/") {
      assertRestIsLast(prefix);
      out.push({
        segments: prefix,
        layouts: scope,
        render: assertRouteRender(value, routePath(prefix))
      });
      continue;
    }
    if (typeof value === "function") {
      const segments = [...prefix, ...parseKey(key)];
      assertRestIsLast(segments);
      out.push({
        segments,
        layouts: scope,
        render: assertRouteRender(value, routePath(segments))
      });
      continue;
    }
    compileNode(value, [...prefix, ...parseKey(key)], scope, out);
  }
}
function assertRestIsLast(segments) {
  for (let i = 0; i < segments.length - 1; i++) {
    const segment = segments[i];
    if (segment.param && segment.rest) {
      throw new Error(`Catch-all segment ":...${segment.name}" must be the last path segment`);
    }
  }
}
function segmentRank(segment) {
  if (!segment.param) return 0;
  const base = segment.rest ? 3 : 1;
  return segment.matcher === null ? base + 1 : base;
}
function compareRoutes(a, b) {
  const length = Math.min(a.segments.length, b.segments.length);
  for (let i = 0; i < length; i++) {
    const difference = segmentRank(a.segments[i]) - segmentRank(b.segments[i]);
    if (difference !== 0) return difference;
  }
  return a.segments.length - b.segments.length;
}
function matchRoute(routes, path, matchers) {
  const parts = path.split("/").filter(Boolean).map(decodeURIComponent);
  for (const route of routes) {
    const last = route.segments[route.segments.length - 1];
    const hasRest = last !== void 0 && last.param && last.rest;
    if (hasRest ? parts.length < route.segments.length : route.segments.length !== parts.length) {
      continue;
    }
    const params = {};
    let matched = true;
    for (let i = 0; i < route.segments.length; i++) {
      const segment = route.segments[i];
      if (!segment.param) {
        if (segment.value !== parts[i]) {
          matched = false;
          break;
        }
        continue;
      }
      const raw = segment.rest ? parts.slice(i).join("/") : parts[i];
      if (segment.matcher === null) {
        params[segment.name] = raw;
        continue;
      }
      const value = matchers[segment.matcher].match(raw);
      if (value === mismatch) {
        matched = false;
        break;
      }
      params[segment.name] = value;
    }
    if (matched) return { route, params };
  }
  return null;
}
function paramText(value, name, path) {
  switch (typeof value) {
    case "string":
      return value;
    case "number":
    case "bigint":
    case "boolean":
      return String(value);
    default:
      if (value instanceof Date) return value.toISOString();
      throw new Error(
        `Param "${name}" of "${path}" is a ${typeof value} — a URL segment needs a string, number, boolean, or Date`
      );
  }
}
function buildHref(path, params = {}) {
  const built = path.split("/").map((part) => {
    if (!part.startsWith(":")) return part;
    const rest = part.startsWith(":...");
    const body = part.slice(rest ? 4 : 1);
    const equals = body.indexOf("=");
    const name = equals === -1 ? body : body.slice(0, equals);
    const value = params[name];
    if (value === void 0) {
      throw new Error(`Missing param "${name}" building href for "${path}"`);
    }
    const text = paramText(value, name, path);
    if (!rest) return encodeURIComponent(text);
    return text.split("/").filter(Boolean).map(encodeURIComponent).join("/");
  }).join("/");
  return built === "" ? "/" : built;
}
var FALLBACK = /* @__PURE__ */ Symbol("router.fallback");
var NOT_FOUND = { code: 404, message: "Not Found" };
function toRouterError(thrown) {
  if (typeof thrown === "object" && thrown !== null && "code" in thrown && typeof thrown.code === "number" && "message" in thrown && typeof thrown.message === "string") {
    return { code: thrown.code, message: thrown.message };
  }
  return { code: 500, message: thrown instanceof Error ? thrown.message : String(thrown) };
}
function Router(routes, options = {}) {
  const compiled = [];
  compileNode(routes, [], [], compiled);
  compiled.sort(compareRoutes);
  const matchers = options.matchers ?? {};
  assertMatchersExist(compiled, matchers);
  const mountable = () => {
    const root = Outlet();
    const paramSignals = /* @__PURE__ */ new Map();
    const outlets = [root];
    let chain = [];
    const paramsFor = (route) => {
      const params = {};
      for (const segment of route.segments) {
        if (segment.param) params[segment.name] = paramSignals.get(segment.name);
      }
      return params;
    };
    const build = (route, index) => {
      const params = paramsFor(route);
      if (index < route.layouts.length) {
        const child = Outlet();
        outlets[index + 1] = child;
        const content = route.layouts[index].handler(child, params);
        child.set(build(route, index + 1));
        return content;
      }
      return route.render(params);
    };
    let shownError = null;
    const showFallback = (error) => {
      if (chain.length === 1 && chain[0] === FALLBACK && shownError !== null && shownError.code === error.code && shownError.message === error.message) {
        return;
      }
      chain = [FALLBACK];
      shownError = error;
      outlets.length = 1;
      root.set(options.fallback ? options.fallback(error) : null);
    };
    const onLocation = ({ path }) => {
      const match = matchRoute(compiled, path, matchers);
      if (!match) {
        showFallback(NOT_FOUND);
        return;
      }
      for (const [name, value] of Object.entries(match.params)) {
        const existing = paramSignals.get(name);
        if (existing) {
          existing.set(value);
        } else {
          paramSignals.set(name, signal(value));
        }
      }
      for (const name of paramSignals.keys()) {
        if (!(name in match.params)) paramSignals.delete(name);
      }
      const next = [...match.route.layouts, match.route];
      let diverged = 0;
      while (diverged < chain.length && diverged < next.length && chain[diverged] === next[diverged]) {
        diverged++;
      }
      if (diverged === chain.length && diverged === next.length) return;
      chain = next;
      shownError = null;
      try {
        outlets[diverged].set(build(match.route, diverged));
        outlets.length = next.length;
      } catch (thrown) {
        (options.onError ?? console.error)(thrown);
        showFallback(toRouterError(thrown));
      }
    };
    return ImplementLifecycle(
      {
        onUnmount() {
          chain = [];
          outlets.length = 1;
          paramSignals.clear();
        }
      },
      ImplementEffect([location], onLocation),
      root
    )();
  };
  const href = (path, params) => buildHref(path, params);
  const navigate = (path, ...rest) => {
    const takesParams = path.includes(":");
    const params = takesParams ? rest[0] : void 0;
    const navOptions = takesParams ? rest[1] : rest[0];
    navigateTo(buildHref(path, params), navOptions);
  };
  const Link = (props, ...children) => {
    const { to, params, replace, noScroll, onClick, ...rest } = props;
    const record = params ?? {};
    const entries = Object.entries(record);
    const reactive = entries.map(([, value]) => value).filter((value) => isReadable(value));
    const resolveParams = () => Object.fromEntries(
      entries.map(([name, value]) => [name, isReadable(value) ? value.get() : value])
    );
    const linkHref = reactive.length === 0 ? buildHref(to, resolveParams()) : derived(reactive, () => buildHref(to, resolveParams()));
    const currentHref = () => typeof linkHref === "string" ? linkHref : linkHref.get();
    const hrefSignals = typeof linkHref === "string" ? [] : [linkHref];
    const ariaCurrent = derived(
      [location, ...hrefSignals],
      (current) => current.path === normalizePath(currentHref()) ? "page" : void 0
    );
    return A(
      {
        ...rest,
        href: linkHref,
        "aria-current": ariaCurrent,
        onClick(event) {
          if (typeof onClick === "function") {
            onClick.call(this, event);
          }
          if (event.defaultPrevented) return;
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          if (event.button !== 0) return;
          const target = isReadable(rest.target) ? rest.target.get() : rest.target;
          if (target && target !== "_self") return;
          event.preventDefault();
          navigateTo(currentHref(), { replace, noScroll });
        }
      },
      ...children
    );
  };
  return Object.assign(mountable, {
    location,
    href,
    navigate,
    Link,
    searchParam
  });
}
export {
  Router,
  mismatch
};
//# sourceMappingURL=@implementjs_router.js.map
