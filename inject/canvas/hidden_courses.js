// Removes every trace of the CanvasHide.hidden courses from the page: dashboard
// cards, course menus, to-do and planner items, calendar entries, selectors.
// The proxy already strips them from API responses; this covers what Canvas
// renders from data embedded in the HTML itself. Runs at document_start, so a
// stylesheet hides course links before first paint and an observer handles
// everything rendered later.
var CanvasHide = globalThis.CanvasHide || (globalThis.CanvasHide = {});

(function () {
  const courses = CanvasHide.hidden || [];
  if (!courses.length) return;

  const linkSel = courses
    .flatMap(({ id }) => [
      `a[href*="/courses/${id}/"]`, `a[href$="/courses/${id}"]`, `a[href*="/courses/${id}?"]`,
      `a[href*="/courses/${id}#"]`, `a[href*="course_${id}"]`, `[data-course-id="${id}"]`,
    ])
    .join(",");
  const textRe = new RegExp(courses.map((c) => c.textRe.source).join("|"), "i");
  // The smallest element that is one item in Canvas's lists and widgets.
  const ITEM =
    ".ic-DashboardCard, li, tr, option, .fc-event, .ToDoSidebarItem, " +
    "[class*='PlannerItem'], [class*='planner-item'], .ic-NavMenu-list-item";
  const TEXT_ITEMS = "li, tr, option, .ic-DashboardCard, .fc-event, [class*='PlannerItem']";
  const MAX_TEXT = 400; // never hide a container large enough to hold many items

  const hide = (el) => el.style.setProperty("display", "none", "important");

  function sweep() {
    document.querySelectorAll(linkSel).forEach((a) => hide(a.closest(ITEM) || a));
    document.querySelectorAll(TEXT_ITEMS).forEach((el) => {
      const t = el.textContent || "";
      if (t.length <= MAX_TEXT && textRe.test(t)) hide(el);
    });
  }

  const style = document.createElement("style");
  style.textContent = `${linkSel}{display:none!important}`;
  (document.head || document.documentElement).appendChild(style);

  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      sweep();
    });
  };
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener("DOMContentLoaded", schedule);
})();
