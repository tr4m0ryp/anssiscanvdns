// Entry point (runs last). Resolves which governed course the page belongs to,
// injects the pre-paint hiding CSS, then routes to the handlers for the page.
// Every course: announcements hidden everywhere, To-do list included. Governed
// courses: the Discussions section blocked too (pages redirect, links hide). A
// course with `marks` also gets the marks freeze.
(function () {
  const H = globalThis.CanvasHide;
  const { courses, injectStyle, topicId } = H;
  const M = H.marks;
  const frozen = courses.filter((c) => c.marks);
  const path = location.pathname;

  // Announcements, each governed course's Discussions entries and frozen marks
  // on every page, the dashboard included.
  injectStyle(H.globalCss(courses) + M.css.global(frozen));
  M.runFeedback(frozen);
  H.runAnnBadges(courses);
  H.runAnnKeep(courses);

  const urlId = (path.match(/\/courses\/(\d+)/) || [])[1];
  if (!urlId) return;

  const isTopic = /\/courses\/\d+\/discussion_topics\/\d+/.test(path);
  // Discussions index (and /new etc.): the whole section is blocked.
  const isDiscussions = !isTopic && /\/courses\/\d+\/discussion_topics(\/|$)/.test(path);
  const tid = topicId(path);
  const isAnnIndex = /\/courses\/\d+\/announcements\/?$/.test(path);

  // A topic page may be an announcement in any course: hold its content
  // invisible before paint until topic.js decides.
  const holdTopic = () => {
    document.documentElement.setAttribute("data-cvh-topic", "pending");
    injectStyle(H.buildCss().topic);
  };

  const apply = (course) => {
    H.useCourse(course);
    const css = H.buildCss();
    // Leave the Discussions section before anything paints, back to the course
    // home, the way Canvas treats a section that is switched off.
    // A course with a `discussions` mode keeps its Discussions section;
    // "pinned" also hides the pinned group there.
    if (isDiscussions && course.discussions) {
      if (course.discussions === "pinned") H.runPinnedSection();
    } else if (isDiscussions) {
      injectStyle(css.base + css.leaving);
      return location.replace(`/courses/${urlId}`);
    }
    // Base hiding (Discussions tab and links) on every course page.
    let sheet = css.base + H.annPageCss(course.annAllow);
    if (isTopic && tid) {
      document.documentElement.setAttribute("data-cvh-topic", "pending");
      sheet += css.topic;
    }
    const marks = course.marks ? M.route(path) : null;
    sheet += M.pageCss(marks);
    injectStyle(sheet);

    H.runDiscussionLinks();
    M.runPage(course, marks);
    if (isTopic && tid) H.runTopic(tid, true);
    if (isAnnIndex && course.annAllow) H.runAnnIndex(course.annAllow, course.annAllowTitle);
  };

  // Fast path: known course id, act immediately with no DOM dependency.
  const known = courses.find((c) => c.id === urlId);
  if (known) return apply(known);

  // Any other course: only its announcements are hidden. A topic page is held
  // and checked; if the course turns out to be governed (new id), apply()
  // takes over and the topic is blocked outright.
  let ungoverned = null;
  injectStyle(H.annPageCss(null));
  if (isTopic && tid) {
    holdTopic();
    H.useCourse({ id: urlId });
    ungoverned = H.runTopic(tid, false);
  }

  // Unknown id: identify the course by its unique code (or name) in the page
  // title and breadcrumbs before touching anything. Not the whole body, which
  // lists other courses too (course menus, grade dropdowns). Needs the DOM.
  const confirm = () => {
    const crumbs = document.querySelector("#breadcrumbs, .ic-app-crumbs");
    const t = document.title + " " + (crumbs ? crumbs.textContent : "");
    const course = courses.find((c) => c.codeRe.test(t) || c.nameRe.test(t));
    // Use the live id, so API calls and storage keys follow the new course.
    if (course) {
      if (ungoverned) ungoverned.cancel();
      apply({ ...course, id: urlId });
    }
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", confirm, { once: true });
  } else {
    confirm();
  }
})();
