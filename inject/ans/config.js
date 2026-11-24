// What is hidden on ans.uva.nl. The site links through /routing/<id> URLs that
// do not carry the course, so items are matched by their visible text (course
// code or assignment name); whole pages by URL path, page title or breadcrumb.
// Content scripts are not ES modules, so state is shared via a global.
var AnsHide = globalThis.AnsHide || (globalThis.AnsHide = {});

AnsHide.rules = {
  // Courses hidden entirely: their pages redirect home, every item naming them
  // (course lists, deadlines, schedule, results) is removed.
  courses: [
    { id: "695168", textRe: /5062STRE6Y|Statistisch Redeneren/i }, // Statistisch Redeneren
  ],
  // Single assignments hidden everywhere, results included. None now: every
  // result shows except Statistisch Redeneren's (hidden with its course).
  assignments: [],
};

// The smallest page element that is one item: home cards, calendar events and
// their dropdown entries, list items, table rows.
AnsHide.itemSel = "a.dropdown-item, div.dropdown:has(> .calendar-event), a.box, li, tr";

AnsHide.matches = function (text) {
  const r = AnsHide.rules;
  return r.courses.some((c) => c.textRe.test(text)) || r.assignments.some((re) => re.test(text));
};

AnsHide.blockedPath = (path) =>
  AnsHide.rules.courses.some((c) => new RegExp(`/courses/${c.id}(/|$)`).test(path));
