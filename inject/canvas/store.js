// Thin async wrappers over chrome.storage.local for the cached id lists
// (discussion ids, marks allow-set). Values are stored as arrays of strings.
var CanvasHide = globalThis.CanvasHide || (globalThis.CanvasHide = {});

CanvasHide.store = {
  get(key) {
    return new Promise((res) => {
      try {
        chrome.storage.local.get(key, (o) => res(Array.isArray(o[key]) ? o[key] : []));
      } catch (_) {
        res([]);
      }
    });
  },
  set(key, arr) {
    return new Promise((res) => {
      try {
        chrome.storage.local.set({ [key]: arr }, () => res());
      } catch (_) {
        res();
      }
    });
  }
};
