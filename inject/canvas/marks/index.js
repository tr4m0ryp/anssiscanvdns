// Module root of the marks freeze: page routing for a frozen course, and the
// recent-feedback handler that runs on every Canvas page (dashboard included).
var CanvasHide = globalThis.CanvasHide || (globalThis.CanvasHide = {});
CanvasHide.marks = CanvasHide.marks || {};

// Which mark surface the path is, with the assignment id where relevant.
CanvasHide.marks.route = function (path) {
  if (/\/courses\/\d+\/grades(\/|$)/.test(path)) return { kind: "grades" };
  if (/\/courses\/\d+\/assignments\/?$/.test(path)) return { kind: "index" };
  const aid = CanvasHide.assignmentId(path);
  if (aid && /\/assignments\/\d+\/submissions/.test(path)) return { kind: "submission", aid };
  if (aid && /\/assignments\/\d+\/?$/.test(path)) return { kind: "assignment", aid };
  return null;
};

// Pre-paint sheet for the routed page ("" when the page shows no marks).
CanvasHide.marks.pageCss = function (route) {
  if (!route) return "";
  const css = CanvasHide.marks.css;
  if (route.kind === "submission") {
    document.documentElement.setAttribute("data-cvh-marks", "pending");
  }
  return css[route.kind];
};

CanvasHide.marks.runPage = function (course, route) {
  const M = CanvasHide.marks;
  if (!route) return;
  if (route.kind === "grades") M.runGrades(course);
  else if (route.kind === "index") M.runIndex(course);
  else if (route.kind === "assignment") M.runAssignment(course, route.aid);
  else if (route.kind === "submission") M.runSubmission(course, route.aid);
};

// Recent feedback (dashboard and course sidebars): reveal only allowed items
// of each frozen course. Canvas renders the list after load, so each course's
// handler starts the first time one of its items appears; pages without it
// make no API request.
CanvasHide.marks.runFeedback = function (courses) {
  const { assignmentId, courseHref } = CanvasHide;
  const pending = courses.map((course) => ({
    course,
    items: `.recent_feedback li:has(a${courseHref(course)})`,
  }));
  const start = ({ course, items }) =>
    CanvasHide.marks.policy.watch(course, (allow) => {
      document.querySelectorAll(items).forEach((li) => {
        const link = li.querySelector("a[href*='/assignments/']");
        const id = assignmentId(link && link.getAttribute("href"));
        li.classList.toggle("cvh-show", !!id && allow.has(id));
      });
    });
  const check = () => {
    for (let i = pending.length - 1; i >= 0; i--) {
      if (document.querySelector(pending[i].items)) start(pending.splice(i, 1)[0]);
    }
    if (!pending.length) seen.disconnect();
  };
  const seen = new MutationObserver(check);
  seen.observe(document.documentElement, { childList: true, subtree: true });
  check();
};
