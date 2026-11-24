// Dashboard cards keep their Announcements icon. Their unread counts are gone
// (the proxy drops announcements from the activity summary), so a course with
// `annBadge` gets that fixed number drawn on its icon, in Canvas's own badge
// markup. Cards are React-rendered, so the badge is re-applied on change.
var CanvasHide = globalThis.CanvasHide || (globalThis.CanvasHide = {});

CanvasHide.runAnnBadges = function (courses) {
  const badged = courses.filter((c) => c.annBadge);
  if (!badged.length) return;
  const apply = () => {
    for (const c of badged) {
      document.querySelectorAll(`a.ic-DashboardCard__action.announcements[href*='/courses/${c.id}/']`).forEach((a) => {
        if (a.querySelector(".cvh-badge")) return;
        a.querySelectorAll(".ic-DashboardCard__action-badge").forEach((b) => b.remove());
        const b = document.createElement("span");
        b.className = "ic-DashboardCard__action-badge cvh-badge";
        b.innerHTML =
          `<span class="unread_count">${c.annBadge}</span>` +
          '<span class="screenreader-only">Ongelezen</span>';
        a.appendChild(b);
      });
    }
  };
  new MutationObserver(apply).observe(document.documentElement, { childList: true, subtree: true });
};
