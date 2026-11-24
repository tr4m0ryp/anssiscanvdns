// Injects the hiding CSS at document_start, before the page paints, so nothing
// governed here ever flashes on screen. Reveal is done by adding marker classes,
// never by un-hiding after a visible delay.
var CanvasHide = globalThis.CanvasHide || (globalThis.CanvasHide = {});

// One rule per selector: an unsupported selector then drops only its own rule.
CanvasHide.hideRules = (...list) => list.map((x) => `${x} { display: none !important; }`).join("\n");
CanvasHide.courseHref = (course) => `[href*='/courses/${course.id}/']`;

// Every Canvas page (dashboard included): announcements of every course, and
// each governed course's Discussions entries. Allowed announcements keep their
// To-do and planner rows, and a course with allowed ones keeps its
// Announcements tab, home block and index links (see annPageCss).
CanvasHide.globalCss = function (courses) {
  const full = courses.filter((c) => c.discussions !== "pinned");
  const s = CanvasHide.sel;
  const keep = CanvasHide.annAllowIds.map((id) => `:not(:has(a[href*='discussion_topics/${id}']))`).join("");
  const keepCourses = courses
    .filter((c) => c.annAllow)
    .map((c) => `:not(${CanvasHide.courseHref(c)}):not([href$='/courses/${c.id}/announcements'])`)
    .join("");
  const ann = CanvasHide.hideRules(
    `:is(${s.annIndexLink})${keepCourses}`, s.annStream, s.annTodo + keep, s.annPlanner + keep
  );
  const disc = full.map((c) => {
    const href = CanvasHide.courseHref(c);
    return CanvasHide.hideRules(s.discCard + href, `${s.discTodo}:has(a${href})`);
  });
  return [ann, ...disc].join("\n");
};

// Course pages: the Announcements tab and home block, hidden unless the course
// has allowed announcements; on its index only allowed rows (.cvh-show) appear.
CanvasHide.annPageCss = function (allow) {
  const s = CanvasHide.sel;
  if (!allow) return CanvasHide.hideRules(s.annRecent, s.annNav);
  return `${s.annRow}:not(.cvh-show) { display: none !important; }`;
};

// Sheets for pages inside the matched course.
CanvasHide.buildCss = function () {
  const s = CanvasHide.sel;
  // Always-on (pinned-only course: just the pinned links, .cvh-hide): the Discussions tab and every link or row that leads into the
  // Discussions section.
  const base = CanvasHide.course.discussions === "pinned"
    ? CanvasHide.hideRules(".cvh-hide")
    : CanvasHide.hideRules(
    s.discNav,
    `:is(${s.discIndexLink})`,
    s.discModuleItem,
    s.discAssignment,
    s.discTodo,
    ".cvh-hide"
  );
  // Topic page: keep content invisible until we decide reveal/block.
  // visibility (not display) preserves layout, so the reveal is seamless.
  const topic = `
    html[data-cvh-topic="pending"] ${s.content} { visibility: hidden !important; }
  `;
  // Discussions section: hidden while we redirect away from it.
  const leaving = `
    ${s.content} { visibility: hidden !important; }
  `;
  return { base, topic, leaving };
};

CanvasHide.injectStyle = function (cssText) {
  const style = document.createElement("style");
  style.className = "cvh-style";
  style.textContent = cssText;
  (document.head || document.documentElement).appendChild(style);
};
