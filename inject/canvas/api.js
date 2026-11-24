// Same-origin Canvas API access: refreshes the cached discussion ids for the
// course, and looks up a single topic's announcement flag. Same-origin fetches send the Canvas session cookie automatically. Canvas may prefix JSON with an anti-JSON guard.
var CanvasHide = globalThis.CanvasHide || (globalThis.CanvasHide = {});

CanvasHide.api = (function () {
  const parse = (t) => JSON.parse(String(t).replace(/^while\(1\);\s*/, ""));

  async function json(url) {
    const r = await fetch(url, { headers: { Accept: "application/json" }, credentials: "same-origin" });
    if (!r.ok) throw new Error(r.status);
    return parse(await r.text());
  }

  // Refreshes one cached id list from the course topics endpoint. Without
  // only_announcements, Canvas returns plain discussions only.
  async function refreshIds(query, key) {
    const id = CanvasHide.course.id;
    try {
      // cvh=1 lets this lookup past the proxy's discussion filter.
      const list = await json(`/api/v1/courses/${id}/discussion_topics?${query}per_page=100&cvh=1`);
      // Discussion ids to hide: all, only pinned ones, or none ("open").
      const mode = query ? "" : CanvasHide.course.discussions;
      const keep = (a) => (mode === "open" ? false : mode === "pinned" ? a.pinned : true);
      const ids = list.filter(keep).map((a) => String(a.id));
      await CanvasHide.store.set(key, ids);
      return ids;
    } catch (_) {
      return null;
    }
  }

  return {
    json,
    // All discussion ids in the course, refreshed into storage.
    refreshDiscussionIds: () => refreshIds("", CanvasHide.keys.discIds),
    // A single topic's flags: { announcement, pinned }, or null when the
    // lookup failed (callers fail closed).
    async topic(topicId) {
      const id = CanvasHide.course.id;
      try {
        const t = await json(`/api/v1/courses/${id}/discussion_topics/${topicId}`);
        return { announcement: !!t.is_announcement, pinned: !!t.pinned };
      } catch (_) {
        return null;
      }
    },
  };
})();
