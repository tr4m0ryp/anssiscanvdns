// A single discussion/announcement page (/courses/<id>/discussion_topics/<tid>).
// Content is held invisible by CSS (data-cvh-topic="pending", set before paint).
// Announcements are never shown, in any course, except the course's annAllow. In a governed course every
// topic is blocked, since its Discussions section is blocked entirely; in any
// other course a plain discussion is revealed once the API confirms it is not
// an announcement. A failed lookup blocks (fail closed).
var CanvasHide = globalThis.CanvasHide || (globalThis.CanvasHide = {});

// Returns { cancel } so main.js can hand the page over to the governed path.
CanvasHide.runTopic = function (tid, governed) {
  const { api, sel } = CanvasHide;
  const root = document.documentElement;
  let cancelled = false;

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

  if ((CanvasHide.course.annAllow || []).includes(tid)) {
    reveal();
    return { cancel() {} };
  }

  (async () => {
    // true / false, or null when the lookup failed.
    const isAnn = await api.isAnnouncement(tid);
    if (cancelled) return;
    if (isAnn === false && !governed) return reveal();
    return block(
      isAnn === false
        ? "Deze discussie is niet beschikbaar."
        : "Deze aankondiging is niet beschikbaar."
    );
  })();

  return { cancel: () => (cancelled = true) };
};
