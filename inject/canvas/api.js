// Same-origin Canvas API access: refreshes the cached announcement and
// discussion ids for the course, and looks up a single topic's announcement
// flag. Same-origin fetches send the Canvas session cookie automatically. Canvas may prefix JSON with an anti-JSON guard.
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
      const list = await json(`/api/v1/courses/${id}/discussion_topics?${query}per_page=100`);
      const ids = list.map((a) => String(a.id));
      await CanvasHide.store.set(key, ids);
      return ids;
    } catch (_) {
      return null;
    }
  }

  return {
    json,
    // All announcement ids in the course, refreshed into storage.
    refreshAnnouncementIds: () => refreshIds("only_announcements=true&", CanvasHide.keys.annIds),
    // All discussion ids in the course, refreshed into storage.
    refreshDiscussionIds: () => refreshIds("", CanvasHide.keys.discIds),
    // Whether a single topic is an announcement (used when the id is not cached).
    // null means unknown (request failed), so callers can decide how to fail.
    async isAnnouncement(topicId) {
      const id = CanvasHide.course.id;
      try {
        const t = await json(`/api/v1/courses/${id}/discussion_topics/${topicId}`);
        return !!t.is_announcement;
      } catch (_) {
        return null;
      }
    },
  };
})();
