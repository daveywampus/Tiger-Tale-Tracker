const el = (id) => document.getElementById(id);

const inputText = el("inputText");
const preview = el("preview");
const emoji = el("emoji");
const statusText = el("statusText");
const barKnob = el("barKnob");
const scoreNum = el("scoreNum");
const posHitsEl = el("posHits");
const negHitsEl = el("negHits");
const tipsEl = el("tips");
const clearBtn = el("clearBtn");

// 🟢 EXPANDED POSITIVE WORDS
const POSITIVE = [
  "amazing","excellent","great","outstanding","impressive","successful",
  "helpful","effective","best","strong","innovative","encouraging",
  "hopeful","valuable","remarkable","beneficial","positive","favorable",
  "efficient","productive","improved","improvement","progress","growing",
  "significant","notable","important","useful","well-received","popular",
  "supported","recommended","praised","admired","respected","trusted",
  "reliable","solid","clear","fair","reasonable","constructive",
  "engaging","interesting","inspiring","motivating","wins",
  "achievement","accomplished","advantage","strength","impactful"
];

// 🔴 EXPANDED NEGATIVE WORDS
const NEGATIVE = [
  "terrible","awful","bad","worst","harmful","dangerous","weak",
  "corrupt","disappointing","alarming","failed","failure","unfair",
  "biased","ridiculous","disgusting","problematic","damaging",
  "negative","unfavorable","ineffective","inefficient","decline",
  "declining","worsening","serious","concerning","troubling",
  "criticized","complained","opposed","rejected","questioned",
  "unreliable","unclear","confusing","frustrating","difficult",
  "challenging","limited","lacking","poor","insufficient",
  "risk","risky","danger","issue","problem","concern","controversial",
  "unpopular","weakness","setback"
];

// 📊 OBJECTIVE LANGUAGE
const OBJECTIVE = [
  "according to","reported","data","evidence","study","research",
  "survey","results","analysis","measured","observed","estimate",
  "percent","percentage"
];

// ---------------- UTILITIES ----------------

function escapeHTML(str){
  return str.replace(/[&<>"']/g, m => ({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    '"':"&quot;",
    "'":"&#39;"
  }[m]));
}

function reEscape(s){
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function countPhrase(textLower, phrase){
  const p = phrase.trim();
  if (!p) return 0;
  const re = new RegExp(`\\b${reEscape(p).replace(/\\s+/g, "\\s+")}\\b`, "gi");
  const m = textLower.match(re);
  return m ? m.length : 0;
}

// ---------------- QUOTE HANDLING ----------------

function getQuoteRanges(text){
  const ranges = [];
  const patterns = [
    /"[^"]*"/g,
    /“[^”]*”/g
  ];

  for (const re of patterns){
    let match;
    while ((match = re.exec(text)) !== null){
      ranges.push({
        start: match.index,
        end: re.lastIndex
      });
    }
  }

  ranges.sort((a, b) => a.start - b.start);
  return ranges;
}

function stripQuotedText(text){
  const ranges = getQuoteRanges(text);
  if (!ranges.length) return text;

  let result = "";
  let cursor = 0;

  for (const range of ranges){
    result += text.slice(cursor, range.start);
    result += " ".repeat(range.end - range.start);
    cursor = range.end;
  }

  result += text.slice(cursor);
  return result;
}

// ---------------- HIGHLIGHTING ----------------

function highlightPhrases(text, phrases, className){
  let out = text;
  const sorted = [...phrases].sort((a,b) => b.length - a.length);

  for (const phrase of sorted){
    const re = new RegExp(`\\b${reEscape(phrase).replace(/\\s+/g,"\\s+")}\\b`, "gi");
    out = out.replace(re, (m) => `<span class="${className}">${m}</span>`);
  }

  return out;
}

function buildHighlights(raw){
  if (!raw.trim()) {
    return "<span style='color:var(--muted)'>Your feedback will appear here.</span>";
  }

  const quoteRanges = getQuoteRanges(raw);

  if (!quoteRanges.length){
    let safe = escapeHTML(raw);
    safe = highlightPhrases(safe, POSITIVE, "hlPos");
    safe = highlightPhrases(safe, NEGATIVE, "hlNeg");
    safe = highlightPhrases(safe, OBJECTIVE, "hlObj");
    return safe;
  }

  let output = "";
  let cursor = 0;

  for (const range of quoteRanges){
    if (cursor < range.start){
      let normalText = escapeHTML(raw.slice(cursor, range.start));
      normalText = highlightPhrases(normalText, POSITIVE, "hlPos");
      normalText = highlightPhrases(normalText, NEGATIVE, "hlNeg");
      normalText = highlightPhrases(normalText, OBJECTIVE, "hlObj");
      output += normalText;
    }

    output += `<span class="quotedText">${escapeHTML(raw.slice(range.start, range.end))}</span>`;
    cursor = range.end;
  }

  if (cursor < raw.length){
    let normalText = escapeHTML(raw.slice(cursor));
    normalText = highlightPhrases(normalText, POSITIVE, "hlPos");
    normalText = highlightPhrases(normalText, NEGATIVE, "hlNeg");
    normalText = highlightPhrases(normalText, OBJECTIVE, "hlObj");
    output += normalText;
  }

  return output;
}

// ---------------- SCORING ----------------

function computeScore(text){
  const scoringText = stripQuotedText(text);
  const lower = scoringText.toLowerCase();

  let positiveHits = 0;
  let negativeHits = 0;
  let objectiveHits = 0;

  for (const p of POSITIVE) positiveHits += countPhrase(lower, p);
  for (const p of NEGATIVE) negativeHits += countPhrase(lower, p);
  for (const p of OBJECTIVE) objectiveHits += countPhrase(lower, p);

  const numbers = (lower.match(/\b\d{1,3}(?:,\d{3})*(?:\.\d+)?\b/g) || []).length;
  objectiveHits += Math.min(6, numbers) * 0.5;

  let toneScore = (positiveHits - negativeHits) * 8;

  if (objectiveHits > 0) {
    toneScore *= 0.9;
  }

  toneScore = Math.max(-50, Math.min(50, Math.round(toneScore)));

  return {
    toneScore,
    positiveHits,
    negativeHits,
    objectiveHits
  };
}

// ---------------- UI ----------------

function updateUI(){
  const text = inputText.value || "";
  const result = computeScore(text);

  const score = result.toneScore;

  scoreNum.textContent = score;
  posHitsEl.textContent = result.positiveHits;
  negHitsEl.textContent = result.negativeHits;

  const knobTop = 50 - score;
  barKnob.style.top = `${knobTop}%`;

  emoji.classList.remove("pos","neutral","neg");

  let label = "Neutral tone";

  if (score >= 20) {
    label = "Positive tone";
    emoji.classList.add("pos");
  } else if (score <= -20) {
    label = "Negative tone";
    emoji.classList.add("neg");
  } else {
    emoji.classList.add("neutral");
  }

  emoji.textContent = "🐯";
  statusText.textContent = label;

  emoji.classList.remove("bump");
  void emoji.offsetWidth;
  emoji.classList.add("bump");
  setTimeout(() => emoji.classList.remove("bump"), 180);

  preview.innerHTML = buildHighlights(text);

  const tips = [];

  if (!text.trim()){
    tips.push("Use precise language instead of emotional wording.");
    tips.push("Quoted source language does not affect the bias tracker.");
    tips.push("Neutral reporting often relies on facts and evidence.");
  } else {
    if (result.positiveHits > 0){
      tips.push("Positive wording detected in the reporter's voice.");
    }

    if (result.negativeHits > 0){
      tips.push("Negative wording detected in the reporter's voice.");
    }

    if (result.objectiveHits === 0 && text.length > 50){
      tips.push("Consider adding evidence or sources.");
    }

    if (Math.abs(score) < 15){
      tips.push("This draft stays near neutral tone.");
    }
  }

  tipsEl.innerHTML = tips.map(t => `<li>${escapeHTML(t)}</li>`).join("");
}

inputText.addEventListener("input", updateUI);

clearBtn.addEventListener("click", () => {
  inputText.value = "";
  updateUI();
});

updateUI();
