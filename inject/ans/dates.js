// Date groups on the results list ("22 NOV, 2026" then its results) whose
// results are all hidden would leave a bare date. A date header is a leaf
// whose whole text is a date. Its group is either its largest ancestor that
// holds no other date (header and results nested together), or else the
// siblings after that ancestor up to the next date (a flat list). A group
// with no visible text besides the date is hidden.
var AnsHide = globalThis.AnsHide || (globalThis.AnsHide = {});

AnsHide.dates = (function () {
  const DATE = /^\s*\d{1,2}\s+[A-Za-z]{3,9}\.?,?\s+\d{4}\s*$/;

  const isHeader = (el) => !el.children.length && DATE.test(el.textContent);
  const headersIn = (el) =>
    [...el.querySelectorAll("*")].filter(isHeader).length + (isHeader(el) ? 1 : 0);

  // Visible text in `el`, outside hidden items and outside the date itself.
  const hasVisible = (el, header) => {
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const p = n.parentElement;
      if (!n.nodeValue.trim() || p === header || p.closest(".ans-hide")) continue;
      return true;
    }
    return false;
  };

  function tidy(root) {
    const main = root.querySelector("main") || root.body || root;
    [...main.querySelectorAll("*")].filter(isHeader).forEach((h) => {
      if (h.closest(".ans-hide")) return;
      let g = h;
      while (g.parentElement && g.parentElement !== main && headersIn(g.parentElement) === 1) g = g.parentElement;
      const group = [g];
      if (!hasVisible(g, h)) {
        for (let s = g.nextElementSibling; s && !headersIn(s); s = s.nextElementSibling) group.push(s);
      }
      if (!group.some((el) => hasVisible(el, h))) group.forEach((el) => el.classList.add("ans-hide"));
    });
  }

  return { tidy };
})();
