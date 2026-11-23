// Injects the hiding CSS at document_start, before the page paints, so nothing
// governed here ever flashes on screen. Reveal is done by adding marker classes,
// never by un-hiding after a visible delay.
var CanvasHide = globalThis.CanvasHide || (globalThis.CanvasHide = {});

// One rule per selector: an unsupported selector then drops only its own rule.
CanvasHide.hideRules = (...list) => list.map((x) => `${x} { display: none !important; }`).join("\n");
CanvasHide.courseHref = (course) => `[href*='/courses/${course.id}/']`;

// Every Canvas page (dashboard included): announcements of every course, and
// each governed course's Discussions entries.
CanvasHide.globalCss = function (courses) {
  const s = CanvasHide.sel;
  const ann = CanvasHide.hideRules(
    s.annRecent, s.annNav, `:is(${s.annIndexLink})`, s.annCard, s.annStream, s.annTodo, s.annPlanner
  );
  const disc = courses.map((c) => {
    const href = CanvasHide.courseHref(c);
    return CanvasHide.hideRules(s.discCard + href, `${s.discTodo}:has(a${href})`);
  });
  return [ann, ...disc].join("\n");
};

// Sheets for pages inside the matched course.
CanvasHide.buildCss = function () {
  const s = CanvasHide.sel;
  // Always-on: the Discussions tab and every link or row that leads into the
  // Discussions section.
  const base = CanvasHide.hideRules(
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
