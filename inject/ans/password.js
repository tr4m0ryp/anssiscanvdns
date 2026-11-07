// The Security page (/users/security) ships its password fields with a
// `disabled` attribute, so they render dimmed and refuse input. This re-enables
// them so the account owner can type and submit a change themselves. ANS may
// still reject the submission server-side; this only unlocks the form.
var AnsHide = globalThis.AnsHide || (globalThis.AnsHide = {});

AnsHide.password = (function () {
  const onSecurity = () => /\/users\/security\/?$/.test(location.pathname);

  // Drop disabled/readonly and restore full opacity on the two password inputs
  // and their submit button, so the fields look and behave as editable.
  const enable = (root) => {
    if (!onSecurity()) return;
    root.querySelectorAll(
      "input[name='user[password]'], input[name='user[current_password]'], " +
      "form[data-controller~='form-validation'] [type='submit']"
    ).forEach((el) => {
      el.disabled = false;
      el.removeAttribute("disabled");
      el.readOnly = false;
      el.removeAttribute("readonly");
      el.style.opacity = "1";
    });
  };

  return { enable, onSecurity };
})();
