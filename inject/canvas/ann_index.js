// Announcements index of a course with allowed announcements (WDD-1): every
// row starts hidden by CSS and only rows whose topic id is allowed are shown.
// The proxy already drops the rest from the data; this covers anything that
// still renders. Rows are React-rendered, so the filter re-applies on change.
var CanvasHide = globalThis.CanvasHide || (globalThis.CanvasHide = {});

CanvasHide.runAnnIndex = function (allow, byTitle) {
  const { sel, topicId } = CanvasHide;
  const ok = new Set(allow);
  const apply = () => {
    document.querySelectorAll(sel.annRow + ":not(.cvh-show)").forEach((row) => {
      const link = row.querySelector("a[href*='discussion_topics/']");
      const title = link ? link.textContent : "";
      if (ok.has(topicId(link && link.getAttribute("href"))) || (byTitle && byTitle.test(title)))
        row.classList.add("cvh-show");
    });
  };
  apply();
  new MutationObserver(apply).observe(document.documentElement, { childList: true, subtree: true });
};

// To-do and planner rows of announcements allowed by title (no id known):
// marked .cvh-keep so the global hiding rule (css.js) lets them through.
CanvasHide.runAnnKeep = function (courses) {
  const res = courses.map((c) => c.annAllowTitle).filter(Boolean);
  if (!res.length) return;
  const apply = () => {
    document.querySelectorAll(
      "li:has(> .ToDoSidebarItem svg[name^='IconAnnouncement']):not(.cvh-keep), [class*='PlannerItem']:has(svg[name^='IconAnnouncement']):not(.cvh-keep)"
    ).forEach((row) => {
      if (res.some((re) => re.test(row.textContent.replace(/^\s*(Aankondiging|Announcement)\s*/i, ""))))
        row.classList.add("cvh-keep");
    });
  };
  new MutationObserver(apply).observe(document.documentElement, { childList: true, subtree: true });
};
