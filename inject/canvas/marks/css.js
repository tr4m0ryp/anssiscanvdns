// Pre-paint CSS for the marks freeze. Every mark surface starts hidden; the
// page handlers add .cvh-show (or data-cvh-marks="ok") only for allowed marks.
// visibility (not display) keeps table and header layout stable, and
// pointer-events stops the hidden cells from opening What-If or details.
var CanvasHide = globalThis.CanvasHide || (globalThis.CanvasHide = {});
CanvasHide.marks = CanvasHide.marks || {};

CanvasHide.marks.css = (function () {
  const masked = "visibility: hidden !important; pointer-events: none !important;";

  // Every Canvas page: dashboard recent feedback, the all-courses grades list,
  // and the grade pill on dashboard cards, for each frozen course.
  const global = (courses) =>
    courses
      .map((c) => {
        const href = CanvasHide.courseHref(c);
        return `
          .recent_feedback li:has(a${href}):not(.cvh-show) { display: none !important; }
          table.course_details tr:has(a${href}) td.percent { ${masked} }
          .ic-DashboardCard a[href$='/courses/${c.id}/grades'] { display: none !important; }
        `;
      })
      .join("\n");

  // Course grades page: score and details cells of every row (group totals
  // included), and all detail rows (score stats, comments, rubric).
  const grades = `
    #grades_summary tr.student_assignment:not(.cvh-show) td.assignment_score,
    #grades_summary tr.student_assignment:not(.cvh-show) td.details { ${masked} }
    #grades_summary tr.comments:not(.cvh-show),
    #grades_summary tr.rubric_assessments:not(.cvh-show),
    #grades_summary tr.final_grade,
    #student-grades-final { display: none !important; }
  `;

  // Course assignments index: the score line of each row.
  const index = `
    li.assignment:not(.cvh-show) .js-score { ${masked} }
  `;

  // Single assignment page: grade, feedback and rubric until allowed.
  const assignment = `
    html:not([data-cvh-marks="ok"]) :is(
      [data-testid='grade-display'],
      [data-testid='view_feedback_button'],
      [data-testid^='rubric'],
      #sidebar_content .details
    ) { ${masked} }
  `;

  // Submission details page: the whole content waits for the decision.
  const submission = `
    html[data-cvh-marks="pending"] ${CanvasHide.sel.content} { visibility: hidden !important; }
  `;

  return { global, grades, index, assignment, submission };
})();
