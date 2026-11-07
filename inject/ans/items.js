// Removes every item whose text names a hidden course or assignment. Scans
// only text nodes (cheap, and each new subtree is scanned once), then hides
// the smallest enclosing item, so the rest of a list or calendar stays usable.
var AnsHide = globalThis.AnsHide || (globalThis.AnsHide = {});

AnsHide.items = (function () {
  const SKIP = new Set(["SCRIPT", "STYLE", "TITLE", "NOSCRIPT", "TEMPLATE"]);

  // A course code and an assignment name usually sit in one text node, but a
  // date may be split off; fall back to the parent's full text for iRATs.
  const hit = (node) => {
    const el = node.parentElement;
    if (!el || SKIP.has(el.tagName) || el.closest(".ans-hide, nav.breadcrumb")) return null;
    const t = node.nodeValue;
    if (AnsHide.matches(t) || (/irat/i.test(t) && AnsHide.matches(el.textContent))) return el;
    return null;
  };

  const itemOf = (el) =>
    el.tagName === "OPTION" ? el : el.closest(AnsHide.itemSel) || el.closest("a") || el;

  // A home section whose cards are all hidden would leave a bare heading.
  const collapse = (item) => {
    const sec = item.closest("section");
    if (sec && sec.querySelector("a.box") && !sec.querySelector("a.box:not(.ans-hide)")) {
      sec.classList.add("ans-hide");
    }
  };

  function scan(root) {
    if (!root) return;
    if (root.nodeType === Node.TEXT_NODE) root = root.parentElement;
    if (!root || root.nodeType !== Node.ELEMENT_NODE) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const found = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = hit(n);
      if (el) found.push(itemOf(el));
    }
    found.forEach((item) => {
      item.classList.add("ans-hide");
      collapse(item);
    });
  }

  return { scan };
})();
