// A single discussion/announcement page (/courses/<id>/discussion_topics/<tid>).
// Content is held invisible by CSS (data-cvh-topic="pending", set before paint).
// Only an announcement that is in the allow-set is revealed. Everything else is
// blocked and never shown: announcements outside the To-do list, and every
// normal discussion, since the Discussions section is blocked entirely.
var CanvasHide = globalThis.CanvasHide || (globalThis.CanvasHide = {});

CanvasHide.runTopic = function (tid) {
  const { keys, store, api, sel } = CanvasHide;
  const root = document.documentElement;

  const reveal = () => root.setAttribute("data-cvh-topic", "ok");

  // Content stays hidden ("pending") until the whole page is parsed, so the
  // parser cannot append real content after the notice replaced it.
  const block = (text) => {
    const show = () => {
      const c = document.querySelector(sel.content);
      if (!c || document.readyState === "loading")
        return document.addEventListener("DOMContentLoaded", show, { once: true });
      root.setAttribute("data-cvh-topic", "blocked");
      c.style.visibility = "visible";
      c.innerHTML =
        '<div style="max-width:640px;margin:15vh auto;text-align:center;color:#6b7780;' +
        "font:16px system-ui,'Segoe UI',sans-serif\">" + text + "</div>";
    };
    show();
  };

  (async () => {
    const [allow, annIds, discIds] = await Promise.all([
      store.get(keys.allow),
      store.get(keys.annIds),
      store.get(keys.discIds),
    ]);
    // true / false, or null when the lookup failed. Cached ids skip the fetch.
    const isAnn =
      annIds.includes(tid) || (discIds.includes(tid) ? false : await api.isAnnouncement(tid));
    if (isAnn !== false && allow.includes(tid)) return reveal();
    return block(
      isAnn === false
        ? "Deze discussie is niet beschikbaar."
        : "Deze aankondiging is niet beschikbaar."
    );
  })();
};
