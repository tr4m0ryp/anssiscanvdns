// Announcements index (/courses/<id>/announcements): every row starts hidden by
// CSS. We reveal only rows whose topic id is in the allow-set (the To-do list).
// Rows are React-rendered, so we observe and re-apply; a live allow-set change
// (dismissing a To-do item in another tab) re-filters immediately.
var CanvasHide = globalThis.CanvasHide || (globalThis.CanvasHide = {});

CanvasHide.runIndex = function () {
  const { sel, keys, store, topicId } = CanvasHide;
  let allow = new Set();

  const apply = () => {
    document.querySelectorAll(sel.annRow).forEach((row) => {
      const link = row.querySelector(sel.annRowLink);
      const id = topicId(link && link.getAttribute("href"));
      row.classList.toggle("cvh-show", !!id && allow.has(id));
    });
  };

  const load = async () => {
    allow = new Set(await store.get(keys.allow));
    apply();
  };

  load();
  new MutationObserver(apply).observe(document.documentElement, { childList: true, subtree: true });
  store.onAllowChange((ids) => {
    allow = new Set(ids);
    apply();
  });
  // Keep the announcement-id cache warm from this page too.
  CanvasHide.api.refreshAnnouncementIds();
};
