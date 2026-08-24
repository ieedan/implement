import {
  require_fast_deep_equal
} from "./chunk-NCQMJJXZ.js";
import {
  __toESM
} from "./chunk-PX6F3LHL.js";

// ../core/src/signal.ts
var import_fast_deep_equal = __toESM(require_fast_deep_equal(), 1);
var noop = () => {
};
function isThenable(value) {
  return typeof value === "object" && value !== null && "then" in value && typeof value.then === "function";
}
function hasChanged(prev, next) {
  if (prev === next) return false;
  if (prev instanceof Map || prev instanceof Set || next instanceof Map || next instanceof Set) {
    return true;
  }
  if (isThenable(prev) || isThenable(next)) {
    return true;
  }
  if (isReadable(prev) || isReadable(next)) {
    return true;
  }
  return !(0, import_fast_deep_equal.default)(prev, next);
}
function subscribe(signals, getter) {
  if (signals.length === 1) {
    const source = signals[0];
    const call = getter;
    let value = source.get();
    const unsubscribe = source.subscribe((next) => {
      if (next === value) return;
      value = next;
      call(value);
    });
    call(value);
    return unsubscribe;
  }
  const values = signals.map((signal2) => signal2.get());
  const unsubscribers = signals.map(
    (signal2, i) => signal2.subscribe((newValue) => {
      const changed = values[i] !== newValue;
      if (!changed) return;
      values[i] = newValue;
      getter(...values);
    })
  );
  getter(...values);
  return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
}
function bindOnChange(initial, subscribeTo, callback) {
  let previous = initial;
  return subscribeTo((value) => {
    const prev = previous;
    previous = value;
    callback(value, prev);
  });
}
function isReadable(value) {
  return typeof value === "object" && value !== null && "get" in value && "subscribe" in value && typeof value.get === "function" && typeof value.subscribe === "function";
}
function isWritable(value) {
  return isReadable(value) && "set" in value && typeof value.set === "function";
}
var READ_ONLY_BIND = "bind(selector, update) requires a writable source";
var Notifier = class {
  single = null;
  singleId = 0;
  many = null;
  nextId = 0;
  get subscriberCount() {
    if (this.many !== null) return this.many.size;
    return this.single === null ? 0 : 1;
  }
  /**
   * Returns the subscription's id rather than a closure to cancel it, so a
   * caller that has cleanup of its own wraps one closure instead of two. Every
   * subscription carries an id so one held past a promotion still cancels.
   */
  /**
   * Registers a binding without the wrapper closure `subscribe` would add.
   * Only ever reached through `takesBindings`, which checks that this
   * notifier's own subscriber table is the one its `subscribe` feeds.
   */
  attachBinding(binding) {
    return this.addSubscriber(binding);
  }
  /** Cancels an `attachBinding` registration by its id. */
  detachBinding(id) {
    this.removeSubscriber(id);
  }
  addSubscriber(callback) {
    const id = ++this.nextId;
    if (this.many === null && this.single === null) {
      this.single = callback;
      this.singleId = id;
    } else {
      if (this.many === null) {
        this.many = /* @__PURE__ */ new Map();
        if (this.single !== null) this.many.set(this.singleId, this.single);
        this.single = null;
        this.singleId = 0;
      }
      this.many.set(id, callback);
    }
    return id;
  }
  removeSubscriber(id) {
    if (this.singleId === id) {
      this.single = null;
      this.singleId = 0;
      return;
    }
    this.many?.delete(id);
  }
  clearSubscribers() {
    this.single = null;
    this.singleId = 0;
    this.many = null;
  }
  notifySubscribers(value) {
    if (this.many === null) {
      const only = this.single;
      if (only !== null) deliver(only, value);
      return;
    }
    for (const subscriber of [...this.many.values()]) deliver(subscriber, value);
  }
};
function takesBindings(source) {
  if (!(source instanceof Notifier)) return false;
  const method = source.subscribe;
  return method === Signal.prototype.subscribe || method === LazyReadable.prototype.subscribe || method === ForwardedSignal.prototype.subscribe;
}
function deliver(subscriber, value) {
  if (typeof subscriber === "function") subscriber(value);
  else subscriber.receive(value);
}
var Binding = class {
  /** Set only when the source could not take a binding directly. */
  cancel = null;
  notifier = null;
  id = 0;
  value;
  /** Reads the source, applies the value, and subscribes for later ones. */
  start(source) {
    this.value = source.get();
    if (takesBindings(source)) {
      this.notifier = source;
      this.id = source.attachBinding(this);
    } else {
      this.cancel = source.subscribe((next) => this.receive(next));
    }
    this.apply(this.value);
  }
  /** Called by the notifier. Filters unchanged values the way `subscribe` does. */
  receive(next) {
    if (next === this.value) return;
    this.value = next;
    this.apply(next);
  }
  /** Ends the subscription. Safe to call more than once. */
  stop() {
    this.notifier?.detachBinding(this.id);
    this.notifier = null;
    this.cancel?.();
    this.cancel = null;
  }
};
var Signal = class extends Notifier {
  value;
  constructor(initialValue) {
    super();
    this.value = initialValue;
  }
  get() {
    return this.value;
  }
  set(value) {
    if (!hasChanged(this.value, value)) return;
    this.value = value;
    this.notify(value);
  }
  flush() {
    this.notify(this.value);
  }
  update(fn) {
    this.set(fn(this.get()));
  }
  toggle() {
    this.update((value) => !value);
  }
  increment(step = 1) {
    this.update((value) => value + step);
  }
  decrement(step = 1) {
    this.update((value) => value - step);
  }
  push(...items) {
    const next = [...this.get(), ...items];
    this.set(next);
    return next.length;
  }
  pop() {
    const current3 = this.get();
    if (current3.length === 0) return void 0;
    this.set(current3.slice(0, -1));
    return current3[current3.length - 1];
  }
  unshift(...items) {
    const next = [...items, ...this.get()];
    this.set(next);
    return next.length;
  }
  shift() {
    const current3 = this.get();
    if (current3.length === 0) return void 0;
    const [first, ...rest] = current3;
    this.set(rest);
    return first;
  }
  splice(start, deleteCount, ...items) {
    const next = this.get().slice();
    const deleted = deleteCount === void 0 && items.length === 0 ? next.splice(start) : next.splice(start, deleteCount ?? 0, ...items);
    this.set(next);
    return deleted;
  }
  notify(value) {
    this.notifySubscribers(value);
  }
  subscribe(callback) {
    const id = this.addSubscriber(callback);
    return () => this.removeSubscriber(id);
  }
  onChange(callback) {
    return bindOnChange(this.value, (cb) => this.subscribe(cb), callback);
  }
  bind(keyOrSelector, update) {
    return createBinding(this, keyOrSelector, update);
  }
};
function signal(initialValue) {
  if (isWritable(initialValue)) return initialValue;
  return new Signal(initialValue);
}
var LazyReadable = class extends Notifier {
  value;
  sourceUnsubscribe = null;
  disposed = false;
  get() {
    if (!this.disposed && !this.sourceUnsubscribe) {
      this.value = this.read();
    }
    return this.value;
  }
  notify(value) {
    this.notifySubscribers(value);
  }
  activate() {
    if (this.sourceUnsubscribe || this.disposed) return;
    this.value = this.read();
    this.sourceUnsubscribe = this.watch((value) => {
      if (!hasChanged(this.value, value)) return;
      this.value = value;
      this.notify(value);
    });
  }
  deactivate() {
    this.sourceUnsubscribe?.();
    this.sourceUnsubscribe = null;
  }
  subscribe(callback) {
    if (this.disposed) return noop;
    this.activate();
    const id = this.addSubscriber(callback);
    return () => {
      this.removeSubscriber(id);
      if (this.subscriberCount === 0) this.deactivate();
    };
  }
  // A lazy source only watches its own sources while something is listening,
  // and a binding counts the same as a callback.
  attachBinding(binding) {
    if (this.disposed) return 0;
    this.activate();
    return this.addSubscriber(binding);
  }
  detachBinding(id) {
    this.removeSubscriber(id);
    if (this.subscriberCount === 0) this.deactivate();
  }
  onChange(callback) {
    if (!this.disposed && !this.sourceUnsubscribe) {
      this.value = this.read();
    }
    return bindOnChange(this.value, (cb) => this.subscribe(cb), callback);
  }
  // The overloads above are the whole public surface; the implementation
  // still takes `update` so a call that got here through a `Signal`-typed
  // reference reaches the {@link READ_ONLY_BIND} guard instead of silently
  // losing its write-back.
  bind(keyOrSelector, update) {
    return createBinding(this, keyOrSelector, update);
  }
  /** Stop watching sources and drop subscribers. Safe to call more than once. */
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.deactivate();
    this.clearSubscribers();
  }
};
var Derived = class extends LazyReadable {
  constructor(signals, getter) {
    super();
    this.signals = signals;
    this.getter = getter;
    this.only = signals.length === 1 ? signals[0] ?? null : null;
    this.value = this.read();
  }
  signals;
  getter;
  /**
   * The lone source when there is one, which is the shape of every binding and
   * most deriveds. Held here so reading does not walk the tuple, and typed
   * loosely because the tuple cannot express "exactly one".
   */
  only;
  /* oxlint-disable typescript/no-unsafe-type-assertion -- Tuple typing cannot express "this getter takes exactly one value". */
  read() {
    if (this.only !== null) {
      return this.getter(this.only.get());
    }
    const values = this.signals.map((signal2) => signal2.get());
    return this.getter(...values);
  }
  watch(onValue) {
    if (this.only !== null) {
      const call = this.getter;
      const forward = ((value) => onValue(call(value)));
      return subscribe(this.signals, forward);
    }
    return subscribe(this.signals, (...values) => onValue(this.getter(...values)));
  }
  /* oxlint-enable typescript/no-unsafe-type-assertion */
};
var SelectorView = class extends LazyReadable {
  constructor(source, selector) {
    super();
    this.source = source;
    this.selector = selector;
  }
  source;
  selector;
  /** Subscriptions to readables the selector returned, allocated only if the
   * selector ever returns one. */
  inner = null;
  read() {
    let value = this.selector(this.source.get());
    while (isReadable(value)) value = value.get();
    return value;
  }
  clearFrom(depth) {
    const list = this.inner;
    if (list === null) return;
    while (list.length > depth) list.pop()();
  }
  /**
   * `value` came from the readable at `depth - 1` (or the selector when depth
   * is 0), so every subscription at or below `depth` is stale.
   */
  follow(value, depth, onValue) {
    this.clearFrom(depth);
    while (isReadable(value)) {
      const readable = value;
      const list = this.inner ??= [];
      const nextDepth = list.length + 1;
      list.push(
        readable.subscribe((next) => {
          const settled = this.follow(next, nextDepth, onValue);
          onValue(settled);
        })
      );
      value = readable.get();
    }
    return value;
  }
  watch(onValue) {
    const raw = this.selector(this.source.get());
    if (isReadable(raw)) this.follow(raw, 0, onValue);
    const unsubscribe = this.source.subscribe(() => {
      const next = this.selector(this.source.get());
      const settled = this.inner === null && !isReadable(next) ? next : this.follow(next, 0, onValue);
      onValue(settled);
    });
    return () => {
      unsubscribe();
      this.clearFrom(0);
    };
  }
};
function derived(signals, getter) {
  return new Derived(signals, getter);
}
function getAtPath(obj, path) {
  let current3 = obj;
  for (const key of path.split(".")) {
    if (current3 == null) return void 0;
    current3 = current3[key];
  }
  return current3;
}
function setAtPath(obj, path, value) {
  const keys = path.split(".");
  return setAtKeys(obj, keys, value, path);
}
function setAtKeys(obj, keys, value, path) {
  if (obj == null || typeof obj !== "object") {
    const segments = path.split(".");
    const walked = segments.slice(0, segments.length - keys.length).join(".");
    throw new Error(
      walked === "" ? `Cannot set "${path}" on ${String(obj)}` : `Cannot set "${path}": "${walked}" is ${String(obj)}`
    );
  }
  const head = keys[0];
  if (head === void 0) return value;
  const rest = keys.slice(1);
  if (Array.isArray(obj)) {
    const next = obj.slice();
    const index = Number(head);
    next[index] = rest.length === 0 ? value : setAtKeys(obj[index], rest, value, path);
    return next;
  }
  return {
    ...obj,
    [head]: rest.length === 0 ? value : (
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Immutable update recurses into nested object fields.
      setAtKeys(obj[head], rest, value, path)
    )
  };
}
var ForwardedSignal = class extends Signal {
  sourceUnsubscribe = null;
  current;
  activate() {
    if (this.sourceUnsubscribe !== null) return;
    this.current = this.get();
    this.sourceUnsubscribe = this.origin().subscribe(() => {
      const next = this.get();
      if (!hasChanged(this.current, next)) return;
      this.current = next;
      this.notifySubscribers(next);
    });
  }
  deactivate() {
    this.sourceUnsubscribe?.();
    this.sourceUnsubscribe = null;
  }
  subscribe(callback) {
    this.activate();
    const id = this.addSubscriber(callback);
    return () => {
      this.removeSubscriber(id);
      if (this.subscriberCount === 0) this.deactivate();
    };
  }
  attachBinding(binding) {
    this.activate();
    return this.addSubscriber(binding);
  }
  detachBinding(id) {
    this.removeSubscriber(id);
    if (this.subscriberCount === 0) this.deactivate();
  }
};
var BoundPath = class extends ForwardedSignal {
  constructor(source, path) {
    super(getAtPath(source.get(), path));
    this.source = source;
    this.path = path;
  }
  source;
  path;
  origin() {
    return this.source;
  }
  get() {
    return getAtPath(this.source.get(), this.path);
  }
  set(value) {
    const parent = this.source.get();
    if (Object.is(getAtPath(parent, this.path), value)) return;
    this.source.set(setAtPath(parent, this.path, value));
  }
  flush() {
    this.source.flush();
  }
  onChange(callback) {
    return bindOnChange(this.get(), (cb) => this.subscribe(cb), callback);
  }
};
var BoundSelector = class extends ForwardedSignal {
  constructor(source, selector, writeBack) {
    super(selector(source.get()));
    this.source = source;
    this.selector = selector;
    this.writeBack = writeBack;
  }
  source;
  selector;
  writeBack;
  origin() {
    return this.source;
  }
  get() {
    return this.selector(this.source.get());
  }
  set(next) {
    const prev = this.source.get();
    const result = this.writeBack(prev, next);
    if (result !== void 0) {
      this.source.set(result);
      return;
    }
    this.source.flush();
  }
  flush() {
    this.source.flush();
  }
  onChange(callback) {
    return bindOnChange(this.get(), (cb) => this.subscribe(cb), callback);
  }
};
function createBinding(source, keyOrSelector, update) {
  if (typeof keyOrSelector === "function") {
    if (update) {
      if (!isWritable(source)) throw new Error(READ_ONLY_BIND);
      return new BoundSelector(source, keyOrSelector, update);
    }
    return new SelectorView(source, keyOrSelector);
  }
  const path = String(keyOrSelector);
  if (isWritable(source)) {
    return new BoundPath(source, path);
  }
  return new Derived([source], (value) => getAtPath(value, path));
}

// ../core/src/hydration.ts
var support = null;
var claiming = false;
function isHydrating() {
  return claiming;
}
function withMountParent(parent, fn) {
  return support === null ? fn() : support.withMountParent(parent, fn);
}
function attachAtCursor(parent, node) {
  return support?.attachAtCursor(parent, node) ?? false;
}
function claimElement(tag) {
  return support?.claimElement(tag) ?? null;
}
function claimSvgRoot() {
  return support?.claimSvgRoot() ?? null;
}
function claimText(data) {
  return support?.claimText(data) ?? null;
}
function wasClaimed(node) {
  return support?.wasClaimed(node) ?? false;
}

// ../core/src/dom.ts
var svgTemplates = /* @__PURE__ */ new Map();
var browser = {
  createElement: (tag) => document.createElement(tag),
  createTextNode: (data) => document.createTextNode(data),
  createComment: (data) => document.createComment(data),
  head: () => document.head,
  body: () => document.body,
  setTitle: (value) => {
    document.title = value;
  },
  windowTarget: () => window,
  documentTarget: () => document,
  insertHtml: (html, parent, before) => {
    const template = document.createElement("template");
    template.innerHTML = html;
    parent.insertBefore(template.content, before);
  },
  createSvgRoot: (source) => {
    let template = svgTemplates.get(source);
    if (!template) {
      template = document.createElement("template");
      template.innerHTML = source;
      svgTemplates.set(source, template);
    }
    const root = template.content.firstElementChild;
    if (!(root instanceof SVGSVGElement)) {
      console.warn("Svg: source did not parse to a root <svg> element", source);
      return null;
    }
    return root.cloneNode(true);
  }
};
var active = browser;
var anchor = null;
function withInsertionAnchor(node, fn) {
  const previous = anchor;
  anchor = node;
  try {
    fn();
  } finally {
    anchor = previous;
  }
}
var dom = {
  // Outside a hydration pass there is nothing to claim and no cursor to place
  // against, so these skip straight to the environment. Every node in the tree
  // goes through them — a hundred thousand times to build ten thousand rows —
  // and a pass that is not running should not cost three calls per node.
  createElement: (tag) => isHydrating() ? claimElement(tag) ?? active.createElement(tag) : active.createElement(tag),
  createTextNode: (data) => isHydrating() ? claimText(data) ?? active.createTextNode(data) : active.createTextNode(data),
  createComment: (data) => active.createComment(data),
  attach: (parent, node) => {
    if (!isHydrating()) {
      if (anchor !== null && anchor.parentNode === parent) parent.insertBefore(node, anchor);
      else parent.appendChild(node);
      return;
    }
    if (wasClaimed(node)) return;
    if (!attachAtCursor(parent, node)) parent.appendChild(node);
  },
  head: () => active.head(),
  body: () => active.body(),
  setTitle: (value) => active.setTitle(value),
  windowTarget: () => active.windowTarget(),
  documentTarget: () => active.documentTarget(),
  insertHtml: (html, parent, before) => active.insertHtml(html, parent, before),
  createSvgRoot: (source) => isHydrating() ? claimSvgRoot() ?? active.createSvgRoot(source) : active.createSvgRoot(source)
};

// ../core/src/utils.ts
function toError(error) {
  if (error instanceof Error) return error;
  if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string") {
    return new Error(error.message);
  }
  return new Error(String(error));
}

// ../core/src/tree.ts
var current = null;
var PARENT = /* @__PURE__ */ Symbol("implementjs.treeParent");
function asParent(node, fn) {
  const prev = current;
  current = node;
  try {
    return fn();
  } finally {
    current = prev;
  }
}
function mountChild(instance, htmlParent) {
  instance[PARENT] = current;
  const previous = current;
  current = instance;
  try {
    if (isHydrating()) withMountParent(htmlParent, () => instance.mount(htmlParent));
    else instance.mount(htmlParent);
  } finally {
    current = previous;
  }
}
var detaching = 0;
function isDetaching() {
  return detaching > 0;
}
function beginDetach() {
  detaching++;
}
function endDetach() {
  detaching--;
}
var discarding = 0;
function isDiscarding() {
  return discarding > 0;
}
function beginDiscard() {
  discarding++;
}
function endDiscard() {
  discarding--;
}
function parentOf(node) {
  return node[PARENT] ?? null;
}
var boundaries = /* @__PURE__ */ new WeakMap();
function raiseError(from, error) {
  let node = from ?? null;
  while (node) {
    const handler = boundaries.get(node);
    if (handler) {
      handler(toError(error));
      return true;
    }
    node = parentOf(node);
  }
  return false;
}
function guarded(node, fn) {
  try {
    fn();
  } catch (error) {
    if (!raiseError(node, error)) throw error;
  }
}

// ../core/src/components/props.ts
var ATTR_ALIASES = {
  class: "className",
  for: "htmlFor",
  readonly: "readOnly",
  tabindex: "tabIndex",
  colspan: "colSpan",
  rowspan: "rowSpan",
  contenteditable: "contentEditable",
  maxlength: "maxLength",
  minlength: "minLength",
  datetime: "dateTime",
  crossorigin: "crossOrigin",
  formaction: "formAction",
  formenctype: "formEnctype",
  formmethod: "formMethod",
  formnovalidate: "formNoValidate",
  formtarget: "formTarget",
  novalidate: "noValidate",
  srcset: "srcset",
  usemap: "useMap",
  playsinline: "playsInline",
  referrerpolicy: "referrerPolicy",
  fetchpriority: "fetchPriority",
  enterkeyhint: "enterKeyHint",
  inputmode: "inputMode",
  popovertarget: "popoverTarget",
  popovertargetaction: "popoverTargetAction",
  allowfullscreen: "allowFullscreen"
};
function resolveEventName(key) {
  if (key.length < 3 || !key.startsWith("on")) return null;
  const third = key[2];
  if (third === void 0 || third !== third.toUpperCase() || third === third.toLowerCase()) {
    return null;
  }
  return key.slice(2).toLowerCase();
}
var eventNames = /* @__PURE__ */ new Map();
function eventName(key) {
  const cached = eventNames.get(key);
  if (cached !== void 0) return cached;
  const resolved = resolveEventName(key);
  eventNames.set(key, resolved);
  return resolved;
}
var SELECT_VALUE = { event: "change", read: (el) => el.value };
var INPUT_VALUE = { event: "input", read: (el) => el.value };
var INPUT_CHECKED = { event: "change", read: (el) => el.checked };
var TOGGLE_OPEN = { event: "toggle", read: (el) => el.open };
function twoWayBinding(tag, key) {
  if (key === "value") {
    if (tag === "select") return SELECT_VALUE;
    if (tag === "input" || tag === "textarea") return INPUT_VALUE;
    return null;
  }
  if (key === "checked" && tag === "input") return INPUT_CHECKED;
  if (key === "open" && (tag === "details" || tag === "dialog")) return TOGGLE_OPEN;
  return null;
}
function toAttrString(value) {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return `${value}`;
  }
  return "";
}
function setAttribute(el, name, value, booleanAsString) {
  if (value == null) {
    el.removeAttribute(name);
    return;
  }
  if (typeof value === "boolean") {
    if (booleanAsString) {
      el.setAttribute(name, String(value));
      return;
    }
    if (value) {
      el.setAttribute(name, "");
    } else {
      el.removeAttribute(name);
    }
    return;
  }
  el.setAttribute(name, toAttrString(value));
}
function setStyleProperty(el, property, value) {
  if (property.startsWith("--") || property.includes("-")) {
    el.style.setProperty(property, value);
    return;
  }
  el.style[property] = value;
}
function setDomValue(el, key, value) {
  if (key === "style") {
    el.style.cssText = value == null ? "" : toAttrString(value);
    return;
  }
  if (key === "for" || key === "htmlFor") {
    el.htmlFor = value == null ? "" : toAttrString(value);
    return;
  }
  if (key === "textContent") {
    el.textContent = value == null ? "" : toAttrString(value);
    return;
  }
  if (key.startsWith("aria-") || key.startsWith("data-")) {
    setAttribute(el, key, value, true);
    return;
  }
  if (key === "hidden") {
    setAttribute(el, key, value, false);
    return;
  }
  if (key === "tabIndex" || key === "tabindex") {
    setAttribute(el, "tabindex", value, false);
    return;
  }
  if (key === "value") {
    const next = value == null ? "" : toAttrString(value);
    if (el.value !== next) {
      el.value = next;
    }
    return;
  }
  if (key === "checked") {
    const next = Boolean(value);
    if (el.checked !== next) {
      el.checked = next;
    }
    return;
  }
  const prop = ATTR_ALIASES[key] ?? key;
  if (prop in el) {
    const current3 = el[prop];
    if (typeof current3 === "boolean" || typeof value === "boolean") {
      el[prop] = Boolean(value);
      return;
    }
    if (value == null) {
      el[prop] = "";
      el.removeAttribute(key);
      return;
    }
    if (current3 !== value) {
      el[prop] = value;
    }
    return;
  }
  setAttribute(el, key, value, false);
}
function noop2() {
}
function runTeardown(teardown) {
  if (typeof teardown === "function") teardown();
  else teardown.stop();
}
var EventBinding = class {
  constructor(el, event, listener) {
    this.el = el;
    this.event = event;
    this.listener = listener;
    el.addEventListener(event, listener);
  }
  el;
  event;
  listener;
  stop() {
    if (!isDiscarding()) this.el.removeEventListener(this.event, this.listener);
  }
};
function attachEvent(el, event, handler) {
  if (typeof handler !== "function") return null;
  const listener = handler;
  return new EventBinding(el, event, listener);
}
var LiveEventBinding = class extends Binding {
  constructor(el, event, source) {
    super();
    this.el = el;
    this.event = event;
    this.start(source);
  }
  el;
  event;
  attached = null;
  apply(handler) {
    this.attached?.stop();
    this.attached = attachEvent(this.el, this.event, handler);
  }
  stop() {
    super.stop();
    this.attached?.stop();
    this.attached = null;
  }
};
function bindEvent(el, event, value) {
  if (isReadable(value)) return new LiveEventBinding(el, event, value);
  return attachEvent(el, event, value) ?? noop2;
}
function resolveClassValue(value, found, out) {
  if (value == null || typeof value === "boolean" || value === "") return;
  if (typeof value === "string") {
    out.push(value);
    return;
  }
  if (typeof value === "number" || typeof value === "bigint") {
    out.push(`${value}`);
    return;
  }
  if (isReadable(value)) {
    found.add(value);
    resolveClassValue(value.get(), found, out);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      resolveClassValue(item, found, out);
    }
    return;
  }
  if (typeof value === "object") {
    for (const [name, condition] of Object.entries(value)) {
      let resolved = condition;
      if (isReadable(condition)) {
        found.add(condition);
        resolved = condition.get();
      }
      if (resolved) {
        out.push(name);
      }
    }
  }
}
var callUnsubscribe = (unsubscribe) => unsubscribe();
var ClassBinding = class extends Binding {
  constructor(el, source) {
    super();
    this.el = el;
    this.source = source;
    this.start(source);
  }
  el;
  source;
  fallback = null;
  apply(value) {
    if (this.fallback !== null) return;
    if (typeof value === "string") {
      this.el.setAttribute("class", value);
      return;
    }
    if (value == null || typeof value === "boolean") {
      this.el.setAttribute("class", "");
      return;
    }
    this.stop();
    this.fallback = bindClassValue(this.el, this.source);
  }
  stop() {
    super.stop();
    this.fallback?.();
    this.fallback = null;
  }
};
function bindClassProp(el, value) {
  if (typeof value === "string") {
    el.setAttribute("class", value);
    return noop2;
  }
  if (isReadable(value)) return new ClassBinding(el, value);
  return bindClassValue(el, value);
}
function bindClassValue(el, value) {
  let subscriptions = null;
  const apply = () => {
    const found = /* @__PURE__ */ new Set();
    const parts = [];
    resolveClassValue(value, found, parts);
    if (subscriptions !== null) {
      for (const [readable, unsubscribe] of subscriptions) {
        if (!found.has(readable)) {
          unsubscribe();
          subscriptions.delete(readable);
        }
      }
    }
    for (const readable of found) {
      subscriptions ??= /* @__PURE__ */ new Map();
      if (!subscriptions.has(readable)) {
        subscriptions.set(readable, readable.subscribe(apply));
      }
    }
    el.setAttribute("class", parts.join(" "));
  };
  apply();
  if (subscriptions === null) return noop2;
  return () => {
    if (subscriptions === null) return;
    subscriptions.forEach(callUnsubscribe);
    subscriptions.clear();
  };
}
function bindStyleObject(el, styles) {
  let unsubscribers = null;
  for (const property in styles) {
    const value = styles[property];
    if (value === void 0) continue;
    const apply = (resolved) => {
      setStyleProperty(el, property, resolved == null ? "" : toAttrString(resolved));
    };
    if (isReadable(value)) {
      (unsubscribers ??= []).push(subscribe([value], apply));
    } else {
      apply(value);
    }
  }
  if (unsubscribers === null) return noop2;
  const bound = unsubscribers;
  return () => {
    for (const unsub of bound) unsub();
  };
}
var DomPropBinding = class extends Binding {
  constructor(el, key, source) {
    super();
    this.el = el;
    this.key = key;
    this.start(source);
  }
  el;
  key;
  apply(value) {
    setDomValue(this.el, this.key, value);
  }
};
function bindDomProp(el, tag, key, value) {
  const event = eventName(key);
  if (event) return bindEvent(el, event, value);
  if (key === "innerHTML") return noop2;
  if (key === "class" || key === "className") {
    return bindClassProp(el, value);
  }
  if (key === "style" && value !== null && typeof value === "object" && !isReadable(value)) {
    return bindStyleObject(el, value);
  }
  const twoWay = twoWayBinding(tag, key);
  if (twoWay && isWritable(value)) {
    const apply = (resolved) => setDomValue(el, key, resolved);
    const unsub = subscribe([value], apply);
    const handler = () => {
      value.set(twoWay.read(el));
    };
    el.addEventListener(twoWay.event, handler);
    return () => {
      unsub();
      el.removeEventListener(twoWay.event, handler);
    };
  }
  if (isReadable(value)) {
    return new DomPropBinding(el, key, value);
  }
  setDomValue(el, key, value);
  return noop2;
}
function applyElementProps(el, tag, props) {
  let first = null;
  let rest = null;
  for (const key in props) {
    if (key === "children" || key === "this") continue;
    const value = props[key];
    if (value === void 0) continue;
    const unsubscribe = bindDomProp(el, tag, key, value);
    if (unsubscribe === noop2) continue;
    if (first === null) first = unsubscribe;
    else (rest ??= []).push(unsubscribe);
  }
  if (first === null) return noop2;
  if (rest === null) return first;
  const head = first;
  const tail = rest;
  return () => {
    runTeardown(head);
    for (const teardown of tail) runTeardown(teardown);
  };
}
function syncValueProp(el, props) {
  if (!("value" in props) || props.value === void 0) return;
  const value = props.value;
  setDomValue(el, "value", isReadable(value) ? value.get() : value);
}

// ../core/src/components/index.ts
function toText(value) {
  if (value == null || value === false) return "";
  return typeof value === "string" ? value : `${value}`;
}
var StaticText = class {
  #node = null;
  #initial;
  constructor(initial) {
    this.#initial = initial;
  }
  mount(parent) {
    this.#node = dom.createTextNode(this.#initial);
    dom.attach(parent, this.#node);
  }
  unmount() {
    if (!isDetaching()) this.#node?.remove();
    this.#node = null;
  }
  getFirstDomNode() {
    return this.#node;
  }
};
var LiveText = class extends Binding {
  #node = null;
  #content;
  constructor(content) {
    super();
    this.#content = content;
  }
  mount(parent) {
    this.#node = dom.createTextNode(toText(this.#content.get()));
    dom.attach(parent, this.#node);
    this.start(this.#content);
  }
  apply(value) {
    if (this.#node) this.#node.data = toText(value);
  }
  unmount() {
    this.stop();
    if (!isDetaching()) this.#node?.remove();
    this.#node = null;
  }
  getFirstDomNode() {
    return this.#node;
  }
};
function text(content) {
  const initial = toText(content);
  return () => new StaticText(initial);
}
function readableText(content) {
  return () => new LiveText(content);
}
function toMountable(child) {
  if (typeof child === "function") return child;
  if (child !== null && typeof child === "object" && isReadable(child)) {
    return readableText(child);
  }
  return text(child);
}
function component(tag, props = {}, ...children) {
  return () => new Component(tag, props, ...children);
}
function isPropsObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value) && !isReadable(value);
}
function createElementComponent(tag, propsOrChild, ...rest) {
  if (isPropsObject(propsOrChild)) {
    return component(tag, propsOrChild, ...rest);
  }
  const children = propsOrChild === void 0 ? rest : [propsOrChild, ...rest];
  return component(tag, {}, ...children);
}
function element(tag) {
  function factory(propsOrChild, ...rest) {
    return createElementComponent(tag, propsOrChild, ...rest);
  }
  return factory;
}
function reconcileChildren(props, ...children) {
  if (!props.children) {
    for (const child of children) {
      if (typeof child !== "function") return children.map(toMountable);
    }
    return children;
  }
  const fromProps = Array.isArray(props.children) ? props.children : [props.children];
  return [...fromProps, ...children].map(toMountable);
}
var TextBinding = class extends Binding {
  constructor(node, source) {
    super();
    this.node = node;
    this.start(source);
  }
  node;
  apply(value) {
    this.node.data = toText(value);
  }
};
var NO_CHILDREN = [];
var Component = class {
  #element = null;
  #tag;
  #props;
  #children;
  /**
   * An element whose whole content is one readable — `Span(issue.bind("title"))`
   * — owns its text node directly instead of mounting a child for it. Three of
   * the ten mountables in this comparison's list row are exactly that shape, so
   * skipping them is 30% fewer objects to create, track and tear down per row.
   */
  #textChild = null;
  #textNode = null;
  #textBinding = null;
  #mountedChildren = null;
  #unsubscribeProps = null;
  constructor(tag, props, ...children) {
    this.#tag = tag;
    this.#props = props;
    const lone = props.children === void 0 && children.length === 1 ? children[0] : void 0;
    if (lone !== null && typeof lone === "object" && isReadable(lone)) {
      this.#textChild = lone;
      this.#children = NO_CHILDREN;
      return;
    }
    this.#children = reconcileChildren(props, ...children);
  }
  mount(parent) {
    this.#element = dom.createElement(this.#tag);
    this.#unsubscribeProps = applyElementProps(this.#element, this.#tag, this.#props);
    if (this.#textChild !== null) {
      const content = this.#textChild;
      const host = this.#element;
      withMountParent(host, () => {
        const node2 = dom.createTextNode(toText(content.get()));
        this.#textNode = node2;
        dom.attach(host, node2);
      });
      const node = this.#textNode;
      if (node !== null) this.#textBinding = new TextBinding(node, content);
    }
    for (const child of this.#children) {
      const createdChild = child();
      (this.#mountedChildren ??= []).push(createdChild);
      mountChild(createdChild, this.#element);
    }
    syncValueProp(this.#element, this.#props);
    dom.attach(parent, this.#element);
    this.#props.this?.set(this.#element);
  }
  unmount() {
    const detached = isDetaching();
    beginDiscard();
    beginDetach();
    try {
      if (this.#unsubscribeProps !== null) runTeardown(this.#unsubscribeProps);
      this.#unsubscribeProps = null;
      this.#textBinding?.stop();
      this.#textBinding = null;
      this.#textNode = null;
      if (this.#mountedChildren !== null) {
        for (const child of this.#mountedChildren) child.unmount();
        this.#mountedChildren = null;
      }
    } finally {
      endDetach();
      endDiscard();
    }
    this.#props.this?.set(null);
    if (!detached) this.#element?.remove();
    this.#element = null;
  }
  getFirstDomNode() {
    return this.#element;
  }
};

// ../core/src/components/elements.ts
var A = element("a");
var Abbr = element("abbr");
var Address = element("address");
var Area = element("area");
var Article = element("article");
var Aside = element("aside");
var Audio = element("audio");
var B = element("b");
var Bdi = element("bdi");
var Bdo = element("bdo");
var Blockquote = element("blockquote");
var Br = element("br");
var Button = element("button");
var Canvas = element("canvas");
var Caption = element("caption");
var Cite = element("cite");
var Code = element("code");
var Col = element("col");
var Colgroup = element("colgroup");
var Data = element("data");
var Datalist = element("datalist");
var Dd = element("dd");
var Del = element("del");
var Details = element("details");
var Dfn = element("dfn");
var Dialog = element("dialog");
var Div = element("div");
var Dl = element("dl");
var Dt = element("dt");
var Em = element("em");
var Embed = element("embed");
var Fieldset = element("fieldset");
var Figcaption = element("figcaption");
var Figure = element("figure");
var Footer = element("footer");
var Form = element("form");
var H1 = element("h1");
var H2 = element("h2");
var H3 = element("h3");
var H4 = element("h4");
var H5 = element("h5");
var H6 = element("h6");
var Header = element("header");
var Hgroup = element("hgroup");
var Hr = element("hr");
var I = element("i");
var Iframe = element("iframe");
var Img = element("img");
var Input = element("input");
var Ins = element("ins");
var Kbd = element("kbd");
var Label = element("label");
var Legend = element("legend");
var Li = element("li");
var Link = element("link");
var Main = element("main");
var Map2 = element("map");
var Mark = element("mark");
var Menu = element("menu");
var Meta = element("meta");
var Meter = element("meter");
var Nav = element("nav");
var Object2 = element("object");
var Ol = element("ol");
var Optgroup = element("optgroup");
var Option = element("option");
var Output = element("output");
var P = element("p");
var Picture = element("picture");
var Pre = element("pre");
var Progress = element("progress");
var Q = element("q");
var Rp = element("rp");
var Rt = element("rt");
var Ruby = element("ruby");
var S = element("s");
var Samp = element("samp");
var Script = element("script");
var Search = element("search");
var Section = element("section");
var Select = element("select");
var Slot = element("slot");
var Small = element("small");
var Source = element("source");
var Span = element("span");
var Strong = element("strong");
var Style = element("style");
var Sub = element("sub");
var Summary = element("summary");
var Sup = element("sup");
var Table = element("table");
var Tbody = element("tbody");
var Td = element("td");
var Template = element("template");
var Textarea = element("textarea");
var Tfoot = element("tfoot");
var Th = element("th");
var Thead = element("thead");
var Time = element("time");
var Title = element("title");
var Tr = element("tr");
var Track = element("track");
var U = element("u");
var Ul = element("ul");
var Var = element("var");
var Video = element("video");
var Wbr = element("wbr");

// ../core/src/components/helpers/lifecycle.ts
function ImplementLifecycle(props = {}, ...children) {
  return () => {
    const childrenArray = reconcileChildren(props, ...children);
    let mounted = [];
    let cleanup = null;
    let cancelled = false;
    const node = {
      mount(parent) {
        cancelled = false;
        mounted = [];
        for (const child of childrenArray) {
          const instance = child();
          mounted.push(instance);
          mountChild(instance, parent);
        }
        queueMicrotask(() => {
          if (cancelled) return;
          guarded(node, () => {
            cleanup = props.onMount?.(parent) ?? null;
          });
        });
      },
      unmount() {
        cancelled = true;
        props.onUnmount?.();
        cleanup?.();
        cleanup = null;
        for (const child of mounted) child.unmount();
        mounted = [];
      },
      getFirstDomNode() {
        for (const child of mounted) {
          const first = child.getFirstDomNode();
          if (first) return first;
        }
        return null;
      }
    };
    return node;
  };
}

// ../core/src/components/helpers/region.ts
function placeRegionEnd(parent, endMarker) {
  if (!isHydrating() || endMarker === null) return;
  attachAtCursor(parent, endMarker);
}

// ../core/src/components/helpers/outlet.ts
function Outlet(...initial) {
  let children = initial;
  let parent = null;
  let mounted = [];
  let endMarker = null;
  let node = null;
  const clear = () => {
    for (const child of mounted) child.unmount();
    mounted = [];
  };
  const render = () => {
    clear();
    asParent(node, () => {
      withInsertionAnchor(endMarker, () => {
        for (const factory of reconcileChildren({}, ...children)) {
          const instance = factory();
          mounted.push(instance);
          mountChild(instance, parent);
        }
      });
    });
    placeRegionEnd(parent, endMarker);
  };
  return Object.assign(
    () => {
      if (node === null) {
        const marker = dom.createComment("");
        endMarker = marker;
        node = {
          mount(p) {
            parent = p;
            dom.attach(p, marker);
            render();
          },
          unmount() {
            clear();
            if (!isDetaching()) marker.remove();
            parent = null;
          },
          getFirstDomNode() {
            for (const child of mounted) {
              const first = child.getFirstDomNode();
              if (first) return first;
            }
            return marker.isConnected ? marker : null;
          }
        };
      }
      return node;
    },
    {
      set(...next) {
        children = next;
        if (parent) render();
      }
    }
  );
}

// ../core/src/components/helpers/watch.ts
function ImplementEffect(signals, effect, options = {}) {
  const immediate = options.immediate ?? true;
  return () => {
    let unsubscribe = null;
    const node = {
      mount() {
        unsubscribe?.();
        let priming = !immediate;
        unsubscribe = subscribe(signals, (...values) => {
          if (priming) return;
          guarded(node, () => effect(...values));
        });
        priming = false;
      },
      unmount() {
        unsubscribe?.();
        unsubscribe = null;
      },
      getFirstDomNode() {
        return null;
      }
    };
    return node;
  };
}

// ../core/src/components/helpers/head.ts
function brand(mountable) {
  return mountable;
}
function Title2(text2) {
  return brand(() => {
    let unsubscribe = null;
    return {
      mount() {
        unsubscribe?.();
        if (typeof text2 === "string") {
          dom.setTitle(text2);
        } else {
          unsubscribe = subscribe([text2], (value) => {
            dom.setTitle(value ?? "");
          });
        }
      },
      unmount() {
        unsubscribe?.();
        unsubscribe = null;
      },
      getFirstDomNode() {
        return null;
      }
    };
  });
}
var ImplementHead = Object.assign(
  (...children) => {
    const mountables = children;
    return () => {
      let mounted = [];
      return {
        mount() {
          mounted = [];
          for (const child of mountables) {
            const instance = child();
            mounted.push(instance);
            mountChild(instance, dom.head());
          }
        },
        unmount() {
          for (const child of mounted) child.unmount();
          mounted = [];
        },
        getFirstDomNode() {
          return null;
        }
      };
    };
  },
  {
    Title: Title2,
    Meta(props) {
      return brand(component("meta", props));
    },
    Link(props) {
      return brand(component("link", props));
    },
    Script(props, content) {
      return brand(
        content === void 0 ? component("script", props) : component("script", props, content)
      );
    },
    Style(css, props = {}) {
      return brand(component("style", props, css));
    }
  }
);

// ../core/src/components/helpers/switch.ts
var import_fast_deep_equal2 = __toESM(require_fast_deep_equal(), 1);

// ../core/src/location/scroll.ts
var STATE_KEY = "implement:scroll";
var STORAGE_KEY = "implement:scroll-positions";
var MAX_POSITIONS = 50;
var positions = /* @__PURE__ */ new Map();
var nextKey = 0;
var currentKey = 0;
var committedKey = 0;
var installed = false;
var restoredInitial = false;
function readKey(state) {
  if (typeof state !== "object" || state === null) return null;
  const key = Reflect.get(state, STATE_KEY);
  return typeof key === "number" ? key : null;
}
function readPosition(value) {
  if (typeof value !== "object" || value === null) return null;
  const x = Reflect.get(value, "x");
  const y = Reflect.get(value, "y");
  return typeof x === "number" && typeof y === "number" ? { x, y } : null;
}
function record(key, position) {
  positions.delete(key);
  positions.set(key, position);
  for (const oldest of positions.keys()) {
    if (positions.size <= MAX_POSITIONS) break;
    positions.delete(oldest);
  }
}
function persist() {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ next: nextKey, entries: [...positions] }));
  } catch {
  }
}
function restorePersisted() {
  let raw;
  try {
    raw = sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return;
  }
  if (raw === null) return;
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return;
  }
  if (typeof parsed !== "object" || parsed === null) return;
  const next = Reflect.get(parsed, "next");
  if (typeof next === "number") nextKey = Math.max(nextKey, next);
  const entries = Reflect.get(parsed, "entries");
  if (!Array.isArray(entries)) return;
  for (const entry of entries) {
    if (!Array.isArray(entry)) continue;
    const key = entry[0];
    const position = readPosition(entry[1]);
    if (typeof key !== "number" || position === null) continue;
    record(key, position);
  }
}
function enterEntry(key) {
  currentKey = key;
  if (nextKey <= key) nextKey = key + 1;
}
function installScrollRestoration() {
  if (installed) return;
  installed = true;
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  restorePersisted();
  const existing = readKey(history.state);
  if (existing === null) {
    currentKey = nextKey++;
    history.replaceState(currentEntryState(), "");
  } else {
    enterEntry(existing);
  }
  committedKey = currentKey;
  window.addEventListener("pagehide", () => {
    captureScroll();
    persist();
  });
}
function captureScroll() {
  record(committedKey, { x: window.scrollX, y: window.scrollY });
  persist();
}
function commitEntry() {
  committedKey = currentKey;
}
function newEntryState() {
  currentKey = nextKey++;
  positions.delete(currentKey);
  return { [STATE_KEY]: currentKey };
}
function currentEntryState() {
  const existing = history.state;
  const base = typeof existing === "object" && existing !== null ? existing : {};
  return { ...base, [STATE_KEY]: currentKey };
}
function adoptPoppedEntry(state) {
  const key = readKey(state);
  enterEntry(key ?? nextKey);
}
function restoreScroll() {
  const position = positions.get(committedKey);
  window.scrollTo(position?.x ?? 0, position?.y ?? 0);
}
function scrollToTop() {
  window.scrollTo(0, 0);
}
function restoreInitialScroll() {
  if (!installed || restoredInitial) return;
  restoredInitial = true;
  const position = positions.get(committedKey);
  if (position) window.scrollTo(position.x, position.y);
}

// ../core/src/location/index.ts
function normalizePath(pathname) {
  let path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  while (path.length > 1 && path.endsWith("/")) {
    path = path.slice(0, -1);
  }
  return path;
}
function readLocation() {
  return {
    path: normalizePath(window.location.pathname),
    search: window.location.search,
    hash: window.location.hash
  };
}
var current2 = null;
var serverSignal = null;
var scopeSignal = null;
function locationSignal() {
  if (scopeSignal) return scopeSignal;
  if (serverSignal) return serverSignal;
  if (!current2) {
    current2 = signal(readLocation());
    installScrollRestoration();
    window.addEventListener("popstate", () => {
      const target = readLocation();
      if (!guardsAllow(target)) {
        const kept = current2.get();
        history.pushState(newEntryState(), "", kept.path + kept.search + kept.hash);
        commitEntry();
        captureScroll();
        return;
      }
      captureScroll();
      adoptPoppedEntry(history.state);
      resolveNavigation(target, () => {
        current2.set(target);
        commitEntry();
        restoreScroll();
      });
    });
  }
  return current2;
}
function isPageLocation() {
  return scopeSignal === null && serverSignal === null;
}
var initialScrollPending = true;
function scheduleInitialScrollRestore() {
  if (!initialScrollPending || !isPageLocation()) return;
  initialScrollPending = false;
  queueMicrotask(restoreInitialScroll);
}
var location = {
  get: () => locationSignal().get(),
  subscribe: (callback) => {
    const unsubscribe = locationSignal().subscribe(callback);
    scheduleInitialScrollRestore();
    return unsubscribe;
  },
  onChange: (callback) => locationSignal().onChange(callback),
  bind: (keyOrSelector) => locationSignal().bind(keyOrSelector)
};
var navigationGuards = /* @__PURE__ */ new Set();
function guardsAllow(target) {
  for (const guard of navigationGuards) {
    if (!guard(target)) return false;
  }
  return true;
}
var navigationResolver = null;
function setNavigationResolver(resolver) {
  navigationResolver = resolver;
}
var navigationToken = 0;
function resolveNavigation(target, commit) {
  const token = ++navigationToken;
  if (navigationResolver === null) {
    commit();
    return;
  }
  let result;
  try {
    result = navigationResolver(target);
  } catch (error) {
    console.error(error);
    return;
  }
  if (result instanceof Promise) {
    result.then(
      () => {
        if (token === navigationToken) commit();
      },
      (error) => console.error(error)
    );
  } else {
    commit();
  }
}
function navigateTo(href, options = {}) {
  if (serverSignal) {
    throw new Error(
      "navigateTo is not available during server rendering — render the target location instead"
    );
  }
  const active2 = locationSignal();
  const url = new URL(href, window.location.href);
  if (url.href === window.location.href) return;
  const target = {
    path: normalizePath(url.pathname),
    search: url.search,
    hash: url.hash
  };
  if (!guardsAllow(target)) return;
  resolveNavigation(target, () => {
    if (options.replace) {
      history.replaceState(currentEntryState(), "", url);
    } else {
      captureScroll();
      history.pushState(newEntryState(), "", url);
    }
    active2.set(target);
    commitEntry();
    if (!options.replace && !options.noScroll) scrollToTop();
  });
}
function searchParam(name, fallback) {
  const source = locationSignal();
  const inner = derived([source], ({ search }) => {
    const value = new URLSearchParams(search).get(name);
    return value ?? fallback ?? null;
  });
  return {
    get: () => inner.get(),
    subscribe: (callback) => inner.subscribe(callback),
    onChange: (callback) => inner.onChange(callback),
    bind: (selector) => inner.bind(selector),
    set(value) {
      if (serverSignal) {
        throw new Error(
          "searchParam.set is not available during server rendering — render the target location instead"
        );
      }
      const url = new URL(window.location.href);
      if (value == null || value === "" || value === fallback) {
        url.searchParams.delete(name);
      } else {
        url.searchParams.set(name, value);
      }
      navigateTo(url.pathname + url.search + url.hash, { replace: true });
    }
  };
}

export {
  isReadable,
  signal,
  derived,
  A,
  ImplementLifecycle,
  Outlet,
  ImplementEffect,
  normalizePath,
  location,
  setNavigationResolver,
  navigateTo,
  searchParam
};
//# sourceMappingURL=chunk-PGKIGHVG.js.map
