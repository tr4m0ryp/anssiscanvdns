// Thin async wrappers over chrome.storage.local for the allow-set (To-do ids)
// and the set of all announcement ids. Values are stored as arrays of strings.
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
  },
  // Fires cb(newAllow) whenever the allow-set changes in any tab.
  onAllowChange(cb) {
    try {
      chrome.storage.onChanged.addListener((ch, area) => {
        if (area === "local" && ch[CanvasHide.keys.allow]) {
          cb(ch[CanvasHide.keys.allow].newValue || []);
        }
      });
    } catch (_) {}
  },
};
