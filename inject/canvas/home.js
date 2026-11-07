// Course home: the "Recente aankondigingen" block is already hidden by CSS.
// Here we read the To-do list to build the allow-set (the ids the user is still
// allowed to see), and keep it live: dismissing a To-do item updates the set at
// once, so that announcement disappears everywhere.
var CanvasHide = globalThis.CanvasHide || (globalThis.CanvasHide = {});

CanvasHide.runHome = function () {
  const { sel, keys, store, topicId } = CanvasHide;

  const readTodo = () => {
    const ids = [...document.querySelectorAll(sel.todoLinks)]
      .map((a) => topicId(a.getAttribute("href")))
      .filter(Boolean);
    return [...new Set(ids)];
  };

  let last = "";
  const sync = () => {
    const ids = readTodo();
    const key = ids.join(",");
    if (key === last) return;
    last = key;
    store.set(keys.allow, ids);
  };

  const start = () => {
    sync();
    const box = document.querySelector(sel.todoContainer);
    const target = box || document.body;
    if (target) new MutationObserver(sync).observe(target, { childList: true, subtree: true });
    // Refresh the full announcement-id cache while we are on a course page.
    CanvasHide.api.refreshAnnouncementIds();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
};
