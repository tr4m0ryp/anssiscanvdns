// The other in-course mark surfaces: the assignments index, a single
// assignment page, and the submission details page. Each starts hidden by CSS
// and is revealed only for an allowed assignment.
var CanvasHide = globalThis.CanvasHide || (globalThis.CanvasHide = {});
CanvasHide.marks = CanvasHide.marks || {};

// Assignments index: reveal the score line of allowed rows.
CanvasHide.marks.runIndex = function (course) {
  const { assignmentId } = CanvasHide;
  CanvasHide.marks.policy.watch(course, (allow) => {
    document.querySelectorAll("li.assignment").forEach((row) => {
      const link = row.querySelector("a.ig-title, a[href*='/assignments/']");
      const id = assignmentId(link && link.getAttribute("href"));
      row.classList.toggle("cvh-show", !!id && allow.has(id));
    });
  });
};

// Assignment page: the grade, feedback and rubric show only when allowed.
CanvasHide.marks.runAssignment = function (course, aid) {
  const root = document.documentElement;
  CanvasHide.marks.policy.watch(course, (allow) => {
    root.setAttribute("data-cvh-marks", allow.has(aid) ? "ok" : "blocked");
  });
};

// Submission details page: content held until decided; a frozen mark is
// replaced by a notice.
CanvasHide.marks.runSubmission = function (course, aid) {
  const root = document.documentElement;
  const block = () => {
    const c = document.querySelector(CanvasHide.sel.content);
    if (!c || document.readyState === "loading")
      return document.addEventListener("DOMContentLoaded", block, { once: true });
    root.setAttribute("data-cvh-marks", "blocked");
    c.style.visibility = "visible";
    c.innerHTML =
      '<div style="max-width:640px;margin:15vh auto;text-align:center;color:#6b7780;' +
      "font:16px system-ui,'Segoe UI',sans-serif\">Dit cijfer is niet beschikbaar.</div>";
  };
  CanvasHide.marks.policy
    .allows(course, aid)
    .then((ok) => (ok ? root.setAttribute("data-cvh-marks", "ok") : block()));
};
