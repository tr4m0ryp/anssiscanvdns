// Course grades page (/courses/<id>/grades). Scores, details and detail rows
// start hidden by CSS. A row is revealed when its assignment is allowed (by id,
// or by the group name Canvas prints under the title); a group subtotal only
// for an open group, since any other subtotal would sum frozen marks. Detail
// rows share their main row's id suffix (grade_info_<id>, rubric_<id>, ...).
var CanvasHide = globalThis.CanvasHide || (globalThis.CanvasHide = {});
CanvasHide.marks = CanvasHide.marks || {};

CanvasHide.marks.runGrades = function (course) {
  const { isOpenGroup, watch } = CanvasHide.marks.policy;
  const suffix = (id) => (String(id).match(/_((?:group-)?\d+)$/) || [])[1] || null;
  const text = (el) => (el ? el.textContent.trim() : "");

  const allowed = (row, key, allow) => {
    if (key.startsWith("group-")) {
      const name = text(row.querySelector("th")).split("\n")[0];
      return isOpenGroup(course, key.slice(6), name);
    }
    const group = text(row.querySelector("th.title .context"));
    return allow.has(key) || course.marks.groupRe.test(group);
  };

  watch(course, (allow) => {
    const table = document.querySelector("#grades_summary");
    if (!table) return;
    const ok = new Map();
    table.querySelectorAll("tr.student_assignment[id^='submission_']").forEach((row) => {
      const key = suffix(row.id);
      if (key) ok.set(key, allowed(row, key, allow));
    });
    table.querySelectorAll("tr[id]").forEach((row) => {
      row.classList.toggle("cvh-show", ok.get(suffix(row.id)) === true);
    });
  });
};
