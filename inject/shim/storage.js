// The scripts in inject/ were written as extension content scripts and keep
// their state in chrome.storage.local. Injected into the page they have no
// extension context, so this shim backs the same API with localStorage and
// relays cross-tab changes through the `storage` event.
(function () {
  const w = window;
  w.chrome = w.chrome || {};
  if (w.chrome.storage && w.chrome.storage.local) return;
  const PREFIX = "anssis:";
  const read = (k) => {
    try {
      const v = localStorage.getItem(PREFIX + k);
      return v === null ? undefined : JSON.parse(v);
    } catch (_) {
      return undefined;
    }
  };
  const listeners = [];
  const local = {
    get(keys, cb) {
      const list = keys == null ? [] : Array.isArray(keys) ? keys : typeof keys === "string" ? [keys] : Object.keys(keys);
      const out = {};
      for (const k of list) {
        const v = read(k);
        if (v !== undefined) out[k] = v;
        else if (keys && typeof keys === "object" && !Array.isArray(keys)) out[k] = keys[k];
      }
      const p = Promise.resolve(out);
      if (cb) p.then(cb);
      return p;
    },
    set(items, cb) {
      const changes = {};
      for (const [k, v] of Object.entries(items)) {
        changes[k] = { oldValue: read(k), newValue: v };
        localStorage.setItem(PREFIX + k, JSON.stringify(v));
      }
      // Same-tab listeners, like chrome.storage.onChanged.
      listeners.forEach((fn) => fn(changes, "local"));
      const p = Promise.resolve();
      if (cb) p.then(cb);
      return p;
    },
  };
  w.addEventListener("storage", (e) => {
    if (!e.key || !e.key.startsWith(PREFIX)) return;
    const parse = (s) => (s === null ? undefined : JSON.parse(s));
    const k = e.key.slice(PREFIX.length);
    const changes = { [k]: { oldValue: parse(e.oldValue), newValue: parse(e.newValue) } };
    listeners.forEach((fn) => fn(changes, "local"));
  });
  w.chrome.storage = { local, onChanged: { addListener: (fn) => listeners.push(fn) } };
})();
