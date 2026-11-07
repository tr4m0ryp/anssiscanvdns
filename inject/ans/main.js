// Entry point for ans.uva.nl (runs at document_start). The site stays usable;
// only the configured course and assignments disappear. Pages that belong to
// them redirect home before they paint, the way a removed page would.
//
// ANS navigates with Turbo (it swaps the <body> without a reload), so one
// observer on the whole document handles both the first load and every Turbo
// visit. Observer callbacks run before the browser paints the change, so a
// hidden item never flashes.
(function () {
  const H = globalThis.AnsHide;
  const root = document.documentElement;

  const style = document.createElement("style");
  style.textContent = `
    .ans-hide { display: none !important; }
    html[data-ans-leaving] body { visibility: hidden !important; }
  `;
  (document.head || root).appendChild(style);

  // A blocked page: course URL, or a title/breadcrumb naming a hidden course
  // or assignment (assignment and result pages carry no course in the URL).
  let leaving = false;
  const guard = () => {
    if (leaving) return true;
    const crumb = document.querySelector("nav.breadcrumb");
    const blocked =
      H.blockedPath(location.pathname) ||
      H.matches(document.title) ||
      (crumb && H.matches(crumb.textContent));
    if (!blocked) return false;
    leaving = true;
    root.setAttribute("data-ans-leaving", "");
    location.replace("/");
    return true;
  };

  if (guard()) return;
  H.items.scan(root);
  H.password.enable(root);
  new MutationObserver((records) => {
    if (guard()) return;
    for (const r of records) {
      if (r.type === "characterData") H.items.scan(r.target);
      else r.addedNodes.forEach((n) => H.items.scan(n));
    }
    // ANS re-renders the Security form via Turbo frames; re-enable each time.
    H.password.enable(root);
  }).observe(root, { childList: true, subtree: true, characterData: true });
})();
