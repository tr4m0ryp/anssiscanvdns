// Links to a single discussion (/discussion_topics/<id>) are removed wherever
// they appear in the course, so the blocked section cannot be reached from page
// content either. Announcements share that URL shape, so links are matched by
// id against the cached discussion list; cached ids hide known links on the
// first pass, and a background refresh picks up new discussions.
var CanvasHide = globalThis.CanvasHide || (globalThis.CanvasHide = {});

CanvasHide.runDiscussionLinks = function () {
  const { keys, store, api, topicId } = CanvasHide;
  let ids = new Set();

  const apply = () => {
    if (!ids.size) return;
    document.querySelectorAll("a[href*='discussion_topics/']:not(.cvh-hide)").forEach((a) => {
      if (ids.has(topicId(a.getAttribute("href")))) a.classList.add("cvh-hide");
    });
  };
  // Union, so a cache read landing after the refresh never drops fresh ids.
  const add = (list) => {
    if (!list) return;
    list.forEach((id) => ids.add(id));
    apply();
  };

  store.get(keys.discIds).then(add);
  api.refreshDiscussionIds().then(add);
  new MutationObserver(apply).observe(document.documentElement, { childList: true, subtree: true });
};
