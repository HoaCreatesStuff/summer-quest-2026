(() => {
  const DRAFT_KEY = "summerQuestSurveyDraftV1";
  const SUBMITTED_KEY = "summerQuestSurveySubmittedV1";
  const RESPONSE_ID_KEY = "summerQuestSurveyResponseIdV1";
  const form = document.querySelector("#surveyForm");
  const questions = document.querySelector("#surveyQuestions");
  const status = document.querySelector("#surveyStatus");
  const submitButton = document.querySelector("#submitSurvey");
  const success = document.querySelector("#surveySuccess");
  let submitting = false;

  const sections = [
    { title: "Your Summer Quest Experience", questions: [
      ["q1", "About how many quests did you complete?", "radio", ["0", "1–3", "4–7", "8–12", "13–18", "19–24", "All 25"]],
      ["q2", "Did Summer Quest encourage you to do anything you probably would NOT have done otherwise?", "radio", ["Yes, definitely", "Maybe / a little", "No"], { follow: ["q2FollowUp", "What did you do differently?"], values: ["Yes, definitely", "Maybe / a little"] }],
      ["q3", "Did Summer Quest affect how you spent time with other people this summer?", "checkbox", ["I made plans with friends specifically to complete quests", "I included quests in plans I already had", "I reconnected with someone I hadn’t seen in a while", "I spent time with someone new", "I joined a group activity I otherwise might not have", "I mostly completed quests on my own", "It didn’t really affect my social plans", "Other"], { other: ["q3Other", "Please describe"] }],
      ["q4", "What motivated you to keep participating?", "checkbox", ["The quests themselves", "Exploring NYC", "Spending time with friends", "Points", "Ranks / progression", "Friend bonuses", "Seeing my board fill up", "My Summer Story / journal", "Creating memories/photos", "The final keepsake", "The birthday picnic / finale", "Curiosity about what would happen next", "Other"], { max: 3, other: ["q4Other", "Please describe"] }],
      ["q5", "Which part of Summer Quest felt MOST valuable to you?", "radio", ["Discovering places or activities", "Having an excuse to get out and do things", "Spending time with people", "The challenge/game itself", "Tracking my progress", "Looking back at my Summer Story", "Creating a keepsake of the summer", "Being part of the birthday experience", "Other"], { other: ["q5Other", "Please describe"] }],
      ["q6", "Which quest or Summer Quest moment do you think you’ll remember a year from now, and why?", "textarea"],
      ["q7", "Which part of Summer Quest did you enjoy the most?", "radio", ["The quests themselves", "Quest Board / watching it fill up", "Points and scoring", "Ranks / progression", "Friend bonuses", "Summer Story / journal", "Photo keepsake", "Birthday picnic / finale", "Other"], { other: ["q7Other", "Please describe"] }],
      ["journalUsage", "How did you use your Summer Story / Journal?", "checkbox", ["I regularly looked back at my completed quests", "I enjoyed seeing my adventures collected in one place", "I added captions/reflections to preserve the memories", "I looked at it occasionally, but it wasn’t a major part of the experience", "I rarely or never used it", "I didn’t realize it was there / wasn’t sure what it was for", "Other"], { other: ["journalUsageOther", "Please describe"], friction: ["journalFriction", "What made the Summer Story / Journal less useful or appealing to you?"] }],
      ["keepsakeValue", "How valuable was having a finished visual keepsake of your Summer Quest?", "radio", ["Very valuable", "Somewhat valuable", "Neutral", "Not very valuable", "Not valuable at all", "I didn’t use/create one"]],
      ["q8", "Was there anything about Summer Quest that made participating harder than it needed to be?", "textarea", null, { helper: "This could be the app, the quests, scheduling, rules, motivation, or anything else." }]
    ]},
    { title: "Looking Ahead", note: "These questions are about future interest, rather than your past Summer Quest experience.", questions: [
      ["q9", "If we did another NYC Quest for a different season, like fall or winter, would you want to participate?", "radio", ["Yes", "Maybe", "No"]],
      ["q10", "What other kinds of Quest experiences would you personally be interested in?", "checkbox", ["Travel / vacation", "Birthday or celebration", "Family outings", "Wedding / wedding weekend", "Work / team-building", "School or campus events", "Museum / cultural experiences", "None", "Other"], { none: "None", other: ["q10Other", "Please describe"] }]
    ]},
    { title: "Follow-up Research", questions: [
      ["q11", "Would you be open to a short follow-up interview about your Summer Quest experience?", "radio", ["Yes", "No"], { follow: ["q12", "If yes, please leave your name and the best way to contact you."], values: ["Yes"], helper: "Email, phone, Instagram, or whatever works." }],
      ["q13", "Optional: Anything else you want me to know?", "textarea", null, { helper: "What worked, what didn’t, something unexpected, a favorite memory, or an app complaint you’ve been patiently withholding — all fair game." }]
    ]}
  ];

  function optionId(name, index) { return `${name}-${index}`; }
  function optionsMarkup(name, type, choices) {
    return `<div class="survey-options">${choices.map((choice, index) => `<label class="survey-option"><input id="${optionId(name, index)}" type="${type}" name="${name}" value="${choice}"><span>${choice}</span></label>`).join("")}</div>`;
  }
  function textField(name, label, long = false, helper = "") {
    return `<div id="${name}Wrap" class="survey-follow-up" hidden><label class="survey-question-label" for="${name}">${label}</label>${helper ? `<p class="survey-helper">${helper}</p>` : ""}${long ? `<textarea id="${name}" name="${name}" class="survey-textarea"></textarea>` : `<input id="${name}" name="${name}" class="survey-short-input" type="text">`}</div>`;
  }
  function questionMarkup(item) {
    const [name, label, type, choices, config = {}] = item;
    const displayNumbers = {
      journalUsage: 8,
      keepsakeValue: 9,
      q8: 10,
      q9: 11,
      q10: 12,
      q11: 13,
      // The contact field is an extension of Q11; retain q13 for the agreed
      // sheet schema while displaying the final standalone prompt as Q14.
      q13: 14
    };
    const displayNumber = displayNumbers[name] || Number(name.slice(1));
    const numberedLabel = `${displayNumber}. ${label}`;
    if (type === "textarea") return `<div class="survey-question">${textField(name, numberedLabel, true, config.helper || "").replace(" hidden", "")}</div>`;
    const helper = config.max ? `<p class="survey-helper">Choose up to ${config.max}.</p>` : "";
    const after = `${config.max ? `<p id="${name}Limit" class="survey-limit" aria-live="polite">Choose up to ${config.max}.</p>` : ""}${config.follow ? textField(config.follow[0], config.follow[1], false, config.helper || "") : ""}${config.other ? textField(config.other[0], config.other[1]) : ""}${config.friction ? textField(config.friction[0], config.friction[1]) : ""}`;
    return `<fieldset class="survey-question" data-question="${name}"><legend>${numberedLabel}</legend>${helper}${optionsMarkup(name, type, choices)}${after}</fieldset>`;
  }
  function render() {
    questions.innerHTML = sections.map((section, index) => `<section class="survey-section"><header class="survey-section-heading"><p class="label section-eyebrow">Section ${index + 1}</p><h2>${section.title}</h2>${section.note ? `<p class="survey-section-note">${section.note}</p>` : ""}</header>${section.questions.map(questionMarkup).join("")}</section>`).join("");
  }
  function readDraft() { try { return JSON.parse(sessionStorage.getItem(DRAFT_KEY) || "{}") || {}; } catch { return {}; } }
  function writeDraft(values) { try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(values)); } catch {} }
  function values() {
    const result = {};
    form.querySelectorAll("input[type='radio']:checked").forEach(input => { result[input.name] = input.value; });
    form.querySelectorAll("input[type='checkbox']:checked").forEach(input => { (result[input.name] ||= []).push(input.value); });
    form.querySelectorAll("input[type='text'], textarea").forEach(input => { result[input.name] = input.value; });
    return result;
  }
  function restore() {
    const draft = readDraft();
    Object.entries(draft).forEach(([name, value]) => {
      if (Array.isArray(value)) value.forEach(choice => { const input = form.querySelector(`input[name="${name}"][value="${CSS.escape(choice)}"]`); if (input) input.checked = true; });
      else { const input = form.querySelector(`[name="${name}"][value="${CSS.escape(value)}"]`) || form.querySelector(`[name="${name}"]`); if (input) input.value = value; }
    });
    syncConditions();
  }
  function selected(name) { return Array.from(form.querySelectorAll(`input[name="${name}"]:checked`)).map(input => input.value); }
  function setShown(name, shown) { const wrap = document.querySelector(`#${name}Wrap`); if (wrap) wrap.hidden = !shown; }
  function syncConditions() {
    const q2 = selected("q2")[0]; setShown("q2FollowUp", ["Yes, definitely", "Maybe / a little"].includes(q2));
    ["q3", "q4", "q5", "q7", "q10", "journalUsage"].forEach(name => setShown(`${name}Other`, selected(name).includes("Other")));
    setShown("q12", selected("q11")[0] === "Yes");
    const journalLowUseChoices = [
      "I looked at it occasionally, but it wasn’t a major part of the experience",
      "I rarely or never used it",
      "I didn’t realize it was there / wasn’t sure what it was for"
    ];
    setShown("journalFriction", selected("journalUsage").some(choice => journalLowUseChoices.includes(choice)));
    const q4 = selected("q4"); const reached = q4.length >= 3;
    form.querySelectorAll("input[name='q4']").forEach(input => { input.disabled = reached && !input.checked; input.closest("label").classList.toggle("is-disabled", input.disabled); });
    const limit = document.querySelector("#q4Limit"); if (limit) { limit.textContent = reached ? "You’ve selected the maximum of 3 choices." : `${q4.length} of 3 choices selected.`; limit.classList.toggle("is-limit", reached); }
  }
  function syncNone(target) {
    if (target.name !== "q10") return;
    const none = target.value === "None";
    if (none && target.checked) form.querySelectorAll("input[name='q10']").forEach(input => { if (input !== target) input.checked = false; });
    if (!none && target.checked) form.querySelector("input[name='q10'][value='None']").checked = false;
  }
  function submitted() { try { return sessionStorage.getItem(SUBMITTED_KEY) === "true"; } catch { return false; } }
  function responseId() {
    try {
      const existing = sessionStorage.getItem(RESPONSE_ID_KEY);
      if (existing) return existing;
      const id = crypto.randomUUID ? crypto.randomUUID() : `survey-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      sessionStorage.setItem(RESPONSE_ID_KEY, id);
      return id;
    } catch { return crypto.randomUUID ? crypto.randomUUID() : `survey-${Date.now()}-${Math.random().toString(16).slice(2)}`; }
  }
  function showSubmitted() { form.hidden = true; success.hidden = false; }
  async function submit(event) {
    event.preventDefault();
    if (submitting || submitted()) return;
    if (!navigator.onLine) { status.textContent = "You’re offline. Reconnect to submit your survey."; status.className = "survey-status is-error"; return; }
    submitting = true; submitButton.disabled = true; submitButton.textContent = "Submitting…"; status.textContent = ""; status.className = "survey-status";
    try {
      const result = await window.SummerQuestAnalytics?.submitSurveyResponse?.(values(), responseId());
      if (!result?.ok) throw new Error("Survey receiver did not confirm submission.");
      sessionStorage.removeItem(DRAFT_KEY); sessionStorage.removeItem(RESPONSE_ID_KEY); sessionStorage.setItem(SUBMITTED_KEY, "true");
      showSubmitted();
    } catch (error) {
      console.warn("[Survey] Submission failed.", error);
      status.textContent = "Your survey couldn’t be sent. Please check your connection and try again."; status.className = "survey-status is-error";
      submitButton.disabled = false; submitButton.textContent = "Submit Survey";
    } finally { submitting = false; }
  }
  render();
  if (submitted()) showSubmitted(); else restore();
  form.addEventListener("input", () => writeDraft(values()));
  form.addEventListener("change", event => { syncNone(event.target); syncConditions(); writeDraft(values()); });
  form.addEventListener("submit", submit);
  document.addEventListener("summerquest:pagechange", event => { if (event.detail?.page === "survey") window.SummerQuestAnalytics?.trackSurveyOpened?.(); });
})();
