const cvInput = document.getElementById("cv");
const jdInput = document.getElementById("jd");
const btn = document.getElementById("btn");
const errorMsg = document.getElementById("error-msg");
const BTN_HTML = 'Analyze My CV <span class="button-arrow">→</span>';

function updateCount(input, counterId) {
  document.getElementById(counterId).textContent = input.value.length + " characters";
}
cvInput.addEventListener("input", () => updateCount(cvInput, "cv-count"));
jdInput.addEventListener("input", () => updateCount(jdInput, "jd-count"));

function fillList(containerId, items, tag, className, emptyText) {
  const box = document.getElementById(containerId);
  box.innerHTML = "";

  if (!items.length && emptyText) {
    const msg = document.createElement("span");
    msg.className = "empty-message";
    msg.textContent = emptyText;
    box.appendChild(msg);
    return;
  }

  items.forEach((item) => {
    const el = document.createElement(tag);
    if (className) el.className = className;
    el.textContent = item;
    box.appendChild(el);
  });
}

function showReport(r) {
  const score = Math.max(0, Math.min(100, Number(r.matchScore) || 0));
  const matched = r.matchedSkills || [];
  const missing = r.missingSkills || [];

  document.getElementById("match-score").textContent = score + "%";
  document.getElementById("score-ring").style.background =
    `conic-gradient(var(--purple) ${score * 3.6}deg, #28314A 0deg)`;
  document.getElementById("score-message").textContent =
    score >= 75
      ? "Strong match!"
      : score >= 50
      ? "Decent match, thori improvement se behtar ho sakta hai."
      : "Is job ke liye CV mein kaafi tabdili ki zaroorat hai.";

  document.getElementById("matched-count").textContent = matched.length;
  document.getElementById("missing-count").textContent = missing.length;

  fillList("matched-skills", matched, "span", "skill-tag matched", "Koi match nahi mila.");
  fillList("missing-skills", missing, "span", "skill-tag missing", "Koi bari kami nahi mili.");
  fillList("recommendations-list", r.recommendations || [], "li");
  document.getElementById("cover-letter").textContent = r.coverLetter || "";

  const section = document.getElementById("results-section");
  section.hidden = false;
  section.scrollIntoView({ behavior: "smooth" });
}

btn.addEventListener("click", async () => {
  const cv = cvInput.value.trim();
  const jobDescription = jdInput.value.trim();
  errorMsg.textContent = "";

  if (!cv || !jobDescription) {
    errorMsg.textContent = "Pehle CV aur job description dono paste karo.";
    return;
  }

  btn.disabled = true;
  btn.textContent = "Soch raha hun... (10-30 second)";

  try {
    const response = await fetch("/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cv, jobDescription }),
    });

    const data = await response.json();
    if (!response.ok || !data.report) {
      throw new Error(data.error || "Jawab nahi aaya");
    }
    showReport(data.report);
  } catch (err) {
    errorMsg.textContent = err.message;
  }

  btn.disabled = false;
  btn.innerHTML = BTN_HTML;
});