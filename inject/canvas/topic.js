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

  // Listed but never opened: the page stays on a loading spinner forever.
  if ((CanvasHide.course.annLoading || []).includes(tid)) {
    CanvasHide.loadingForever();
    return { cancel() {} };
  }
  if ((CanvasHide.course.annAllow || []).includes(tid)) {
    reveal();
    return { cancel() {} };
  }

  (async () => {
    // A slow topic sits on the spinner for its delay, then opens, whatever
    // its type.
    const slow = (CanvasHide.course.slowTopics || {})[tid];
    if (slow) {
      const spinner = CanvasHide.loadingForever();
      await new Promise((r) => setTimeout(r, slow * 1000));
      if (cancelled) return;
      spinner.remove();
      return reveal();
    }
    const t = await api.topic(tid);
    if (cancelled) return;
    // Plain discussion: shown outside governed courses, and in a pinned-only
    // course unless it is pinned. Everything else (announcements, failed
    // lookups) is blocked.
    const byTitle = CanvasHide.course.annAllowTitle;
    if (t && t.announcement && byTitle && byTitle.test(t.title)) return reveal();
    const mode = CanvasHide.course.discussions;
    const showDisc =
      t && !t.announcement && (!governed || mode === "open" || (mode === "pinned" && !t.pinned));
    if (showDisc) {
      // A course with discussionDelay holds each discussion on the spinner.
      const delay = CanvasHide.course.discussionDelay;
      if (delay) {
        const spinner = CanvasHide.loadingForever();
        await new Promise((r) => setTimeout(r, delay * 1000));
        if (cancelled) return;
        spinner.remove();
      }
      return reveal();
    }
    return block(
      t && !t.announcement
        ? "Deze discussie is niet beschikbaar."
        : "Deze aankondiging is niet beschikbaar."
    );
  })();

  return { cancel: () => (cancelled = true) };
};

// Canvas-style spinner over the (still hidden) content; remove() ends it.
CanvasHide.loadingForever = function () {
  const el = document.createElement("div");
  const show = () => {
    if (!document.body) return document.addEventListener("DOMContentLoaded", show, { once: true });
    el.setAttribute("role", "progressbar");
    el.setAttribute("aria-label", "Laden");
    el.style.cssText = "position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:1;pointer-events:none";
    el.innerHTML =
      '<div style="width:48px;height:48px;border:4px solid #c7cdd1;border-top-color:#2b7abc;' +
      'border-radius:50%;animation:cvh-spin .8s linear infinite"></div>' +
      "<style>@keyframes cvh-spin{to{transform:rotate(360deg)}}</style>";
    document.body.appendChild(el);
  };
  show();
  return { remove: () => el.remove() };
};
