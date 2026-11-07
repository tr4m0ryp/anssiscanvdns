// The governed courses and the Canvas elements handled within them.
// Content scripts are not ES modules, so state is shared via a global.
var CanvasHide = globalThis.CanvasHide || (globalThis.CanvasHide = {});

// Every course gets announcement hiding and the Discussions block. A course
// with `marks` also gets the marks freeze (see src/canvas/marks/).
CanvasHide.courses = [
  {
    // Primary match: the course id in the URL (/courses/<id>/...). Fallbacks
    // if the id changes (re-enrollment, new term): the code is unique, the
    // name is a looser secondary check.
    id: "59331",
    codeRe: /4011OVV10Y/i,
    nameRe: /voortplanting en veroudering\s*-\s*1/i,
  },
  {
    id: "59300",
    codeRe: /4021WDD10Y/i,
    nameRe: /waarnemen,?\s*denken,?\s*doen\s*-\s*1/i,
    marks: {
      // Marks in these assignment groups (e-learnings) always show.
      groupIds: ["202037"],
      groupRe: /^\s*e-?learning/i,
      // Assignment ids outside those groups that were already graded when the
      // freeze started (2026-11-03); their marks stay visible. Every other
      // mark that arrives later is hidden.
      frozen: [],
    },
  },
];

// The matched course, set by main.js before any page handler runs.
CanvasHide.course = null;

CanvasHide.sel = {
  recentBlock: "#announcements_on_home_page",       // course home "Recente aankondigingen"
  navTab: "#aankondigingen-link",                   // left-nav Announcements link (stable id)
  todoLinks: ".todo-list a[href*='discussion_topics'], .Sidebar__TodoListContainer a[href*='discussion_topics']",
  todoContainer: ".todo-list, .Sidebar__TodoListContainer",
  annRow: ".ic-announcement-row",                   // a row on the Announcements index
  annRowLink: "a[href*='discussion_topics']",       // the row's link to the announcement
  content: "#content",
  // Discussions section (blocked entirely). Announcements share the
  // /discussion_topics/<id> URL shape, so only index links and typed rows are
  // matched here; single-discussion links are matched by id at runtime.
  discNav: "#section-tabs li:has(> a.discussions)",
  discIndexLink:
    "a[href$='/discussion_topics'], a[href$='/discussion_topics/'], " +
    "a[href*='/discussion_topics?'], a[data-api-returntype='[Discussion]']",
  discModuleItem: "li.context_module_item.discussion_topic",
  discAssignment: "li.assignment:has(.ig-type-icon .icon-discussion)",
  discTodo: "li:has(> .ToDoSidebarItem svg[name^='IconDiscussion'])",
  discCard: ".ic-DashboardCard a.ic-DashboardCard__action.discussions",
};

// Storage keys, namespaced per course so courses never collide.
CanvasHide.keysFor = (course) => ({
  allow: "cvh_allow_" + course.id,          // ids currently in the To-do list
  annIds: "cvh_annids_" + course.id,        // ids of all announcements in the course
  discIds: "cvh_discids_" + course.id,      // ids of all discussions in the course
  marksAllow: "cvh_marksallow_" + course.id, // assignment ids whose marks may show
});
CanvasHide.keys = null;

// Make `course` the active one: page handlers read CanvasHide.course/keys.
CanvasHide.useCourse = function (course) {
  CanvasHide.course = course;
  CanvasHide.keys = CanvasHide.keysFor(course);
};

// Extract a discussion-topic id from a URL or href.
CanvasHide.topicId = (s) =>
  (String(s || "").match(/discussion_topics\/(\d+)/) || [])[1] || null;

// Extract an assignment id from a URL or href.
CanvasHide.assignmentId = (s) =>
  (String(s || "").match(/assignments\/(\d+)/) || [])[1] || null;
