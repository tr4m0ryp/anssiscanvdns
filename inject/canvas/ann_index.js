// Announcements index of a course with allowed announcements (WDD-1): every
// row starts hidden by CSS and only rows whose topic id is allowed are shown.
// The proxy already drops the rest from the data; this covers anything that
// still renders. Rows are React-rendered, so the filter re-applies on change.
var CanvasHide = globalThis.CanvasHide || (globalThis.CanvasHide = {});

CanvasHide.runAnnIndex = function (allow) {
  const { sel, topicId } = CanvasHide;
  const ok = new Set(allow);
  const apply = () => {
    document.querySelectorAll(sel.annRow + ":not(.cvh-show)").forEach((row) => {
      const link = row.querySelector("a[href*='discussion_topics/']");
      if (ok.has(topicId(link && link.getAttribute("href")))) row.classList.add("cvh-show");
    });
  };
  apply();
  new MutationObserver(apply).observe(document.documentElement, { childList: true, subtree: true });
};
