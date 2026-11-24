// Self-block of the tr4m0ryp profile on x.com and instagram.com. Both are
// single-page apps: opening a profile from a link changes the URL without a
// page load, so the proxy's redirect never sees it. This guard checks every
// route change (pushState, replaceState, back/forward) and sends a profile
// URL to the site's own "not found" page. The proxy also answers the profile
// lookups with "not found" and drops the account's posts from every feed.
(function () {
  const NAME = /^\/(?:stories\/)?tr4m0ryp(?:\/|$)/i;
  const target = location.hostname.endsWith("instagram.com") ? "/p/notfound404/" : "/i/notfound_404_page";
  const check = () => {
    if (NAME.test(location.pathname)) location.replace(target);
  };
  for (const fn of ["pushState", "replaceState"]) {
    const orig = history[fn];
    history[fn] = function () {
      const r = orig.apply(this, arguments);
      check();
      return r;
    };
  }
  addEventListener("popstate", check);
  check();
})();
