/* ==========================================================================
   EasyClass — front-end only flow logic.
   There is no real back end yet, so "accounts" are kept in localStorage.
   Swap the functions in the STORAGE section for real API calls later.
   ========================================================================== */

const EasyClass = (() => {
  const USERS_KEY = "easyclass_users";
  const DRAFT_KEY = "easyclass_signup_draft";
  const SESSION_KEY = "easyclass_session";

  function getUsers() {
    try {
      return JSON.parse(localStorage.getItem(USERS_KEY)) || [];
    } catch {
      return [];
    }
  }

  function saveUser(user) {
    const users = getUsers();
    users.push(user);
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }

  function findUser({ birthdate, username }) {
    const users = getUsers();
    if (username) {
      return users.find((u) => u.username.toLowerCase() === username.toLowerCase());
    }
    return users.find((u) => u.birthdate === birthdate);
  }

  function saveDraft(data) {
    const current = JSON.parse(sessionStorage.getItem(DRAFT_KEY)) || {};
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ ...current, ...data }));
  }

  function getDraft() {
    try {
      return JSON.parse(sessionStorage.getItem(DRAFT_KEY)) || {};
    } catch {
      return {};
    }
  }

  function clearDraft() {
    sessionStorage.removeItem(DRAFT_KEY);
  }

  function setSession(payload) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(payload));
  }

  function isValidDate(value) {
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return false;
    const [d, m, y] = value.split("/").map(Number);
    const date = new Date(y, m - 1, d);
    return (
      date.getFullYear() === y &&
      date.getMonth() === m - 1 &&
      date.getDate() === d &&
      y > 1900 &&
      y <= new Date().getFullYear()
    );
  }

  function isValidPhone(value) {
    const digits = value.replace(/\D/g, "");
    return digits.length >= 10 && digits.length <= 13;
  }

  function isStrongPassword(value) {
    return /^(?=.*[!@#$%^&*()_\-+=?/.,:;]).{8,}$/.test(value);
  }

  function setFieldError(fieldEl, message) {
    fieldEl.classList.toggle("has-error", Boolean(message));
    const msgEl = fieldEl.querySelector(".error-msg");
    if (msgEl) msgEl.textContent = message || "";
  }

  function formatDateInput(inputEl) {
    inputEl.addEventListener("input", () => {
      let digits = inputEl.value.replace(/\D/g, "").slice(0, 8);
      let out = digits;
      if (digits.length > 4) {
        out = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
      } else if (digits.length > 2) {
        out = `${digits.slice(0, 2)}/${digits.slice(2)}`;
      }
      inputEl.value = out;
    });
  }

  return {
    getUsers,
    saveUser,
    findUser,
    saveDraft,
    getDraft,
    clearDraft,
    setSession,
    isValidDate,
    isValidPhone,
    isStrongPassword,
    setFieldError,
    formatDateInput,
  };
})();
