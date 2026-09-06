/* ==========================================================================
   /easyclass/app.js
   EasyClass — front-end only flow logic.

   There is no real back end yet, so "accounts" are kept in localStorage.
   Swap the functions in the STORAGE section for real API calls later.

   v4 changes:
   - Português e Inglês agora também têm gabarito (ver quizzes-data.js) e
     são corrigidos na hora, igual Matemática.
   - Regra de aprovação: existe uma média mínima (PASSING_RATIO, 60% = nota
     6) somando os acertos de todos os quizzes que a pessoa fez. Se ela
     não bater essa média, ela NÃO é aprovada como professora — a conta é
     automaticamente registrada como aluna em vez disso.
     Ajuste PASSING_RATIO abaixo se quiser uma nota de corte diferente.
   ========================================================================== */

const EasyClass = (() => {
  const USERS_KEY = "easyclass_users";
  const DRAFT_KEY = "easyclass_signup_draft";
  const SESSION_KEY = "easyclass_session";
  const AULAS_KEY = "easyclass_aulas_realizadas";
  const MATERIALS_KEY = "easyclass_materiais"; // reserved for future file uploads

  const PROF_QUEUE_KEY = "easyclass_prof_queue";       // subjects still to do, this onboarding
  const PROF_RESULTS_KEY = "easyclass_prof_results";   // results gathered during this onboarding
  const PROF_CURRENT_KEY = "easyclass_prof_current";   // the quiz currently being answered

  // nota mínima pra ser aprovado como professor (0.6 = 60% = nota 6 de 10)
  const PASSING_RATIO = 0.6;

  // ---------- storage (mock "database") ----------

  function getUsers() {
    try {
      return JSON.parse(localStorage.getItem(USERS_KEY)) || [];
    } catch {
      return [];
    }
  }

  function saveUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }

  function saveUser(user) {
    const users = getUsers();
    users.push(user);
    saveUsers(users);
  }

  function findUser({ birthdate, username }) {
    const users = getUsers();
    if (username) {
      return users.find((u) => u.username.toLowerCase() === username.toLowerCase());
    }
    return users.find((u) => u.birthdate === birthdate);
  }

  function updateUser(username, changes) {
    const users = getUsers();
    const idx = users.findIndex((u) => u.username.toLowerCase() === username.toLowerCase());
    if (idx === -1) return null;
    users[idx] = { ...users[idx], ...changes };
    saveUsers(users);
    return users[idx];
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

  function getSession() {
    try {
      return JSON.parse(sessionStorage.getItem(SESSION_KEY)) || null;
    } catch {
      return null;
    }
  }

  function clearSession() {
    sessionStorage.removeItem(SESSION_KEY);
  }

  // ---------- stats shown on the home page ----------
  // Real counts, computed from whoever has actually registered so far —
  // since role can change (a failed professor application becomes "aluno"),
  // this always reflects each user's CURRENT role, not the one they picked
  // at signup.

  function getStats() {
    const users = getUsers();
    const alunos = users.filter((u) => u.role === "aluno").length;
    const professores = users.filter((u) => u.role === "professor").length;
    const aulas = Number(localStorage.getItem(AULAS_KEY)) || 0;
    return { alunos, professores, aulas };
  }

  function incrementAulasRealizadas(amount = 1) {
    const current = Number(localStorage.getItem(AULAS_KEY)) || 0;
    localStorage.setItem(AULAS_KEY, String(current + amount));
  }

  // ---------- materials / files (placeholder for future uploads) ----------

  function getMaterials() {
    try {
      return JSON.parse(localStorage.getItem(MATERIALS_KEY)) || [];
    } catch {
      return [];
    }
  }

  function saveMaterial(material) {
    const materials = getMaterials();
    materials.push(material);
    localStorage.setItem(MATERIALS_KEY, JSON.stringify(materials));
  }

  // ---------- professor onboarding: subject queue ----------

  function setMateriaQueue(materias) {
    sessionStorage.setItem(PROF_QUEUE_KEY, JSON.stringify(materias));
    sessionStorage.setItem(PROF_RESULTS_KEY, JSON.stringify({}));
  }

  function getMateriaQueue() {
    try {
      return JSON.parse(sessionStorage.getItem(PROF_QUEUE_KEY)) || [];
    } catch {
      return [];
    }
  }

  function peekMateria() {
    const queue = getMateriaQueue();
    return queue.length ? queue[0] : null;
  }

  function popMateriaQueue() {
    const queue = getMateriaQueue();
    const done = queue.shift();
    sessionStorage.setItem(PROF_QUEUE_KEY, JSON.stringify(queue));
    return done;
  }

  // ---------- professor onboarding: the quiz being answered right now ----------

  function startQuizForCurrentMateria() {
    const subject = peekMateria();
    if (!subject || !QUIZ_DATA[subject]) return null;
    const quizIndex = Math.floor(Math.random() * QUIZ_DATA[subject].quizzes.length);
    const current = { subject, quizIndex };
    sessionStorage.setItem(PROF_CURRENT_KEY, JSON.stringify(current));
    return current;
  }

  function getCurrentQuiz() {
    try {
      const current = JSON.parse(sessionStorage.getItem(PROF_CURRENT_KEY));
      if (!current || current.subject !== peekMateria()) return startQuizForCurrentMateria();
      return current;
    } catch {
      return startQuizForCurrentMateria();
    }
  }

  // normalize a free-text answer so comparisons ignore spacing/accents/case
  function normalizeAnswer(value) {
    return (value || "")
      .toString()
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // strip accents
      .replace(/²/g, "^2")
      .replace(/√/g, "raiz")
      .replace(/r\$/g, "")
      .replace(/[\s,°%$]/g, "");
  }

  // Grades one quiz submission against QUIZ_DATA's answer key (all three
  // subjects are auto-graded now — see quizzes-data.js).
  function gradeQuiz(subject, quizIndex, answers) {
    const subjectData = QUIZ_DATA[subject];
    const quiz = subjectData.quizzes[quizIndex];

    let score = 0;
    quiz.questions.forEach((question, i) => {
      const given = normalizeAnswer(answers[i]);
      const ok = (question.accept || []).some((accepted) => given.includes(normalizeAnswer(accepted)));
      if (ok) score += 1;
    });

    return {
      subject,
      graded: true,
      total: quiz.questions.length,
      score,
      answers,
    };
  }

  function saveMateriaResult(result) {
    const results = JSON.parse(sessionStorage.getItem(PROF_RESULTS_KEY)) || {};
    results[result.subject] = result;
    sessionStorage.setItem(PROF_RESULTS_KEY, JSON.stringify(results));
    sessionStorage.removeItem(PROF_CURRENT_KEY);
    return result;
  }

  function getMateriaResults() {
    try {
      return JSON.parse(sessionStorage.getItem(PROF_RESULTS_KEY)) || {};
    } catch {
      return {};
    }
  }

  // Overall score ratio across every quiz done this onboarding (0 to 1).
  function getOverallScoreRatio() {
    const results = getMateriaResults();
    const subjects = Object.keys(results);
    if (!subjects.length) return 0;
    let scoreSum = 0;
    let totalSum = 0;
    subjects.forEach((subject) => {
      scoreSum += results[subject].score;
      totalSum += results[subject].total;
    });
    return totalSum > 0 ? scoreSum / totalSum : 0;
  }

  // Called once the professor has gone through every chosen subject.
  // If the overall score meets PASSING_RATIO, the account is approved as
  // professor and the subjects/results are saved onto the user record.
  // If not, the account is registered as "aluno" instead — the person can
  // still use the platform, just not to teach.
  function finalizeProfessorOnboarding(username) {
    const results = getMateriaResults();
    const materias = Object.keys(results);
    const ratio = getOverallScoreRatio();
    const approved = ratio >= PASSING_RATIO;

    if (approved) {
      updateUser(username, { role: "professor", materias, materiaResults: results });
    } else {
      // didn't reach the passing average — becomes a student account instead
      updateUser(username, { role: "aluno", materias: [], materiaResults: results });
    }

    const session = getSession();
    if (session) setSession({ ...session, role: approved ? "professor" : "aluno" });

    sessionStorage.removeItem(PROF_QUEUE_KEY);
    sessionStorage.removeItem(PROF_RESULTS_KEY);
    sessionStorage.removeItem(PROF_CURRENT_KEY);

    return { approved, ratio, materias, results };
  }

  // ---------- validation helpers ----------

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
    // min. 8 characters, at least one special character (matches the sketch's note)
    return /^(?=.*[!@#$%^&*()_\-+=?/.,:;]).{8,}$/.test(value);
  }

  // ---------- UI helpers shared by every page ----------

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

  function formatNumber(n) {
    return n.toLocaleString("pt-BR");
  }

  function formatPercent(ratio) {
    return `${Math.round(ratio * 100)}%`;
  }

  return {
    PASSING_RATIO,
    getUsers,
    saveUser,
    updateUser,
    findUser,
    saveDraft,
    getDraft,
    clearDraft,
    setSession,
    getSession,
    clearSession,
    getStats,
    incrementAulasRealizadas,
    getMaterials,
    saveMaterial,
    setMateriaQueue,
    getMateriaQueue,
    peekMateria,
    popMateriaQueue,
    startQuizForCurrentMateria,
    getCurrentQuiz,
    gradeQuiz,
    saveMateriaResult,
    getMateriaResults,
    getOverallScoreRatio,
    finalizeProfessorOnboarding,
    isValidDate,
    isValidPhone,
    isStrongPassword,
    setFieldError,
    formatDateInput,
    formatNumber,
    formatPercent,
  };
})();
