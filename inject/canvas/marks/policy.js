// Marks freeze policy. A mark may show only when its assignment is an
// e-learning (in an open assignment group) or was already graded when the
// freeze began (course.marks.frozen). Everything else is hidden by CSS before
// paint and never revealed, so new marks (iRAT, tRAT, ...) stay invisible.
// Unknown assignments fail closed.
var CanvasHide = globalThis.CanvasHide || (globalThis.CanvasHide = {});
CanvasHide.marks = CanvasHide.marks || {};

CanvasHide.marks.policy = (function () {
  const H = CanvasHide;

  // Open groups: e-learnings, matched by configured id or by group name.
  const isOpenGroup = (course, id, name) =>
    course.marks.groupIds.includes(String(id)) || course.marks.groupRe.test(name || "");

  const frozen = (course) => course.marks.frozen.map(String);

  // Recomputes the allowed assignment ids from the course's assignment groups
  // (names and ids only, no scores) and caches them. null on failure.
  async function refresh(course) {
    try {
      const groups = await H.api.json(
        `/api/v1/courses/${course.id}/assignment_groups?include[]=assignments&per_page=100`
      );
      const open = groups
        .filter((g) => isOpenGroup(course, g.id, g.name))
        .flatMap((g) => (g.assignments || []).map((a) => String(a.id)));
      const ids = [...new Set([...open, ...frozen(course)])];
      await H.store.set(H.keysFor(course).marksAllow, ids);
      return ids;
    } catch (_) {
      return null;
    }
  }

  // Calls apply(allowSet) now, after the cache read, after the refresh, and on
  // every DOM change. A fresh API answer wins over a late cache read, so an
  // assignment moved out of an open group is hidden again.
  function watch(course, apply) {
    let allow = new Set(frozen(course));
    let fresh = false;
    const run = () => apply(allow);
    H.store.get(H.keysFor(course).marksAllow).then((ids) => {
      if (fresh) return;
      allow = new Set([...frozen(course), ...ids]);
      run();
    });
    refresh(course).then((ids) => {
      if (!ids) return;
      fresh = true;
      allow = new Set(ids);
      run();
    });
    new MutationObserver(run).observe(document.documentElement, { childList: true, subtree: true });
    run();
  }

  // One-shot decision for a single assignment: cache first, then the API.
  async function allows(course, aid) {
    const cached = await H.store.get(H.keysFor(course).marksAllow);
    if (frozen(course).includes(aid) || cached.includes(aid)) return true;
    const ids = await refresh(course);
    return !!ids && ids.includes(aid);
  }

  return { isOpenGroup, watch, allows };
})();
