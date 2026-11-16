import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ExternalLink, Lock, RefreshCw, Trophy } from "lucide-react";
import { api } from "../services/api.js";
import "./Explorer.css";

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */
// NASA Image and Video Library: free, no key needed.
const IMAGES = "https://images-api.nasa.gov/search";
// Astronomy Picture of the Day needs a key. DEMO_KEY works but is rate limited.
// Get a free key at https://api.nasa.gov and put VITE_NASA_API_KEY=... in frontend/.env
const APOD_KEY = import.meta.env.VITE_NASA_API_KEY || "DEMO_KEY";

const QUESTIONS = 5;      // questions per level
const PASS = 0.6;         // 3 of 5 correct unlocks the next level
const PER_CORRECT = 10;   // points for each correct answer (best attempt counts)
const LEVEL_BONUS = 20;   // extra points the first time a level is passed

/* Each level is only a topic. Every text, photo, date and question comes from NASA's API. */
const LEVELS = [
  { title: "Apollo 11 and the first landing", query: "Apollo 11 Moon landing" },
  { title: "Driving on the Moon", query: "Apollo 15 lunar rover" },
  { title: "The space shuttle era", query: "Space Shuttle launch" },
  { title: "Hubble’s view of the universe", query: "Hubble Space Telescope" },
  { title: "Life on the International Space Station", query: "International Space Station astronauts" },
  { title: "The Voyager journey", query: "Voyager Jupiter Saturn" },
  { title: "Opportunity on Mars", query: "Mars rover Opportunity" },
  { title: "Curiosity and Gale Crater", query: "Curiosity rover Gale Crater" },
  { title: "Perseverance and Ingenuity", query: "Perseverance rover Ingenuity helicopter" },
  { title: "James Webb Space Telescope", query: "James Webb Space Telescope" },
];

const CENTERS = {
  JSC: "Johnson Space Center", KSC: "Kennedy Space Center", GSFC: "Goddard Space Flight Center",
  JPL: "Jet Propulsion Laboratory", MSFC: "Marshall Space Flight Center", ARC: "Ames Research Center",
  GRC: "Glenn Research Center", LARC: "Langley Research Center", AFRC: "Armstrong Flight Research Center",
  HQ: "NASA Headquarters", SSC: "Stennis Space Center",
};

/* ------------------------------------------------------------------ */
/* Turning NASA data into reading material and questions               */
/* ------------------------------------------------------------------ */
const shuffle = (a) => [...a].sort(() => Math.random() - 0.5);
const pick = (a, n) => shuffle(a).slice(0, n);

const stripHtml = (s = "") =>
  s.replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

function shorten(text, max = 800) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  return end > 200 ? cut.slice(0, end + 1) : cut;
}

function parseItems(json) {
  const seen = new Set();
  const items = [];
  for (const i of json.collection?.items || []) {
    const d = i.data?.[0] || {};
    const title = stripHtml(d.title || "");
    const text = shorten(stripHtml(d.description || ""));
    const sentences = (text.match(/[^.!?]+[.!?]+/g) || []).map((s) => s.trim()).filter((s) => s.length >= 40 && s.length <= 220);
    const image = i.links?.[0]?.href;
    if (!d.nasa_id || !image || text.length < 150 || sentences.length < 2 || seen.has(title)) continue;
    seen.add(title);
    items.push({ id: d.nasa_id, title, text, sentences, image, year: (d.date_created || "").slice(0, 4), center: d.center });
  }
  return pick(items, 3);
}

const STOP = new Set(["This", "That", "They", "With", "From", "Their", "There", "These", "Image", "Credit", "Photo", "NASA"]);

function candidates(sentence) {
  const out = [];
  let m;
  const num = /\b\d{2,}(?:,\d{3})*\b/g;
  while ((m = num.exec(sentence))) out.push({ text: m[0], kind: "num" });
  const word = /\b[A-Z][a-z]{3,}\b/g;
  while ((m = word.exec(sentence))) {
    if (m.index > 0 && !STOP.has(m[0])) out.push({ text: m[0], kind: "word" });
  }
  return out;
}

function numDistractors(answer) {
  const n = parseInt(answer.replace(/,/g, ""), 10);
  const year = n >= 1900 && n <= 2100;
  const set = new Set();
  for (let t = 0; set.size < 3 && t < 40; t += 1) {
    const v = year ? n + Math.floor(Math.random() * 9) - 4 : Math.round(n * (0.5 + Math.random()));
    if (v > 0 && v !== n) set.add(answer.includes(",") ? v.toLocaleString("en-US") : String(v));
  }
  return [...set];
}

function withOptions(answer, distractors) {
  const options = shuffle([answer, ...distractors.slice(0, 3)]);
  return { options, answer: options.indexOf(answer) };
}

function buildQuiz(items) {
  const wordPool = [...new Set(items.flatMap((it) => it.sentences.flatMap((s) => candidates(s).filter((c) => c.kind === "word").map((c) => c.text))))];

  // Fill-in-the-blank questions from the sentences the learner just read
  const cloze = [];
  items.forEach((it) => it.sentences.forEach((s) => {
    const c = pick(candidates(s), 1)[0];
    if (!c) return;
    const distractors = c.kind === "num"
      ? numDistractors(c.text)
      : pick(wordPool.filter((w) => w.toLowerCase() !== c.text.toLowerCase()), 3);
    if (distractors.length < 3) return;
    cloze.push({
      q: "Fill in the blank using what you read.",
      text: s.replace(c.text, "_____"),
      why: `NASA’s text says: “${s}”`,
      item: it.id,
      ...withOptions(c.text, distractors),
    });
  }));

  const dated = items.filter((it) => /^\d{4}$/.test(it.year)).map((it) => ({
    q: `According to NASA’s record, in which year was “${it.title}” created?`,
    why: `NASA lists this item under ${it.year}.`,
    ...withOptions(it.year, numDistractors(it.year)),
  }));

  const centers = items.filter((it) => CENTERS[it.center]).map((it) => ({
    q: `Which NASA center is credited for “${it.title}”?`,
    why: `The record credits ${CENTERS[it.center]}.`,
    ...withOptions(CENTERS[it.center], pick(Object.values(CENTERS).filter((n) => n !== CENTERS[it.center]), 3)),
  }));

  const perItem = {};
  const chosen = [];
  shuffle(cloze).forEach((c) => {
    perItem[c.item] = (perItem[c.item] || 0) + 1;
    if (perItem[c.item] <= 2 && chosen.length < 3) chosen.push(c);
  });
  const rest = shuffle(cloze).filter((c) => !chosen.includes(c));
  const all = [...chosen, ...pick(dated, 1), ...pick(centers, 1)];
  while (all.length < QUESTIONS && rest.length) all.push(rest.shift());
  return shuffle(all).slice(0, QUESTIONS);
}

/* ------------------------------------------------------------------ */
/* Progress: best score per level, points are worked out from it       */
/* ------------------------------------------------------------------ */
const isPassed = (best, n) => !!best[n] && best[n].score / best[n].total >= PASS;

function summarize(best) {
  let points = 0;
  let passed = 0;
  LEVELS.forEach((_, k) => {
    const b = best[k + 1];
    if (!b) return;
    points += b.score * PER_CORRECT;
    if (b.score / b.total >= PASS) { points += LEVEL_BONUS; passed += 1; }
  });
  return { points, passed };
}

function mergeBest(a, b) {
  const out = { ...a };
  Object.entries(b || {}).forEach(([k, v]) => {
    if (!v || !v.total) return;
    if (!out[k] || v.score / v.total > out[k].score / out[k].total) out[k] = v;
  });
  return out;
}

function loadBest(key) {
  try { return JSON.parse(localStorage.getItem(key) || "{}").best || {}; } catch { return {}; }
}

/* ------------------------------------------------------------------ */
/* Small components                                                    */
/* ------------------------------------------------------------------ */
function PictureOfTheDay() {
  const [p, setP] = useState(null);
  useEffect(() => {
    const ctl = new AbortController();
    fetch(`https://api.nasa.gov/planetary/apod?api_key=${APOD_KEY}`, { signal: ctl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("bad"))))
      .then(setP)
      .catch(() => {}); // optional extra, so failing quietly is fine
    return () => ctl.abort();
  }, []);
  if (!p || p.media_type !== "image") return null;
  return (
    <a className="sh-apod" href="https://apod.nasa.gov/apod/astropix.html" target="_blank" rel="noopener noreferrer">
      <img src={p.url} alt={p.title} loading="lazy" />
      <span><em>NASA picture of the day</em><strong>{p.title}</strong></span>
    </a>
  );
}

function QuizRun({ questions, onFinish }) {
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState(null);
  const [score, setScore] = useState(0);
  const q = questions[i];
  const answered = picked !== null;
  const last = i === questions.length - 1;

  const choose = (k) => {
    if (answered) return;
    setPicked(k);
    if (k === q.answer) setScore((s) => s + 1);
  };
  const next = () => {
    if (last) onFinish(score, questions.length);
    else { setI(i + 1); setPicked(null); }
  };

  return (
    <div className="sh-quiz">
      <p className="sh-meta">Question {i + 1} of {questions.length}</p>
      <p className="sh-quiz-q">{q.q}</p>
      {q.text && <blockquote className="sh-cloze">{q.text}</blockquote>}
      <div className="sh-quiz-opts">
        {q.options.map((t, k) => (
          <button key={t} type="button" disabled={answered} onClick={() => choose(k)}
                  className={answered ? (k === q.answer ? "right" : k === picked ? "wrong" : "") : ""}>{t}</button>
        ))}
      </div>
      {answered && (
        <>
          <p className="sh-quiz-why" role="status">
            <strong>{picked === q.answer ? `Correct, +${PER_CORRECT} points if this is your best run. ` : "Not quite. "}</strong>{q.why}
          </p>
          <button type="button" className="sh-mark" onClick={next}>{last ? "See my result" : "Next question"}</button>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */
export default function Explorer({ user }) {
  const storeKey = `sh_progress_${user?.id ?? user?.email ?? "guest"}`;
  const [best, setBest] = useState(() => loadBest(storeKey));
  const [synced, setSynced] = useState(false);
  const [level, setLevel] = useState(() => {
    const b = loadBest(storeKey);
    const open = LEVELS.findIndex((_, k) => !isPassed(b, k + 1)) + 1;
    return open || LEVELS.length;
  });
  const [phase, setPhase] = useState("read"); // read | quiz | result
  const [data, setData] = useState({ status: "loading", items: [] });
  const [questions, setQuestions] = useState([]);
  const [result, setResult] = useState(null);
  const [note, setNote] = useState("");
  const cache = useRef({});

  const { points, passed } = summarize(best);
  const unlocked = (n) => n === 1 || isPassed(best, n - 1);

  /* Save locally, and also to the backend if it has /api/progress */
  useEffect(() => {
    let off = false;
    api("/api/progress")
      .then((d) => !off && d?.best && setBest((b) => mergeBest(b, d.best)))
      .catch(() => {})
      .finally(() => !off && setSynced(true));
    return () => { off = true; };
  }, []);

  useEffect(() => {
    try { localStorage.setItem(storeKey, JSON.stringify({ best })); } catch { /* storage unavailable */ }
    if (synced) api("/api/progress", { method: "PUT", body: { best, points: summarize(best).points } }).catch(() => {});
  }, [best, synced, storeKey]);

  /* Fetch this level’s information from NASA */
  const loadLevel = useCallback(async (n, fresh, signal) => {
    if (!fresh && cache.current[n]) { setData({ status: "ready", items: cache.current[n] }); return; }
    setData({ status: "loading", items: [] });
    try {
      const r = await fetch(`${IMAGES}?q=${encodeURIComponent(LEVELS[n - 1].query)}&media_type=image&page_size=40`, { signal });
      if (!r.ok) throw new Error("bad response");
      const items = parseItems(await r.json());
      if (items.length < 2) throw new Error("not enough items");
      cache.current[n] = items;
      setData({ status: "ready", items });
    } catch (e) {
      if (e.name !== "AbortError") setData({ status: "error", items: [] });
    }
  }, []);

  useEffect(() => {
    const ctl = new AbortController();
    setPhase("read");
    setNote("");
    loadLevel(level, false, ctl.signal);
    return () => ctl.abort();
  }, [level, loadLevel]);

  const startQuiz = () => {
    const qs = buildQuiz(data.items);
    if (qs.length < 3) { setNote("This set has too little readable text for a fair quiz. Load different information."); return; }
    setNote("");
    setQuestions(qs);
    setPhase("quiz");
  };

  const finish = (score, total) => {
    const before = summarize(best).points;
    const old = best[level];
    const next = !old || score / total > old.score / old.total ? { ...best, [level]: { score, total } } : best;
    setBest(next);
    setResult({ score, total, gained: summarize(next).points - before, pass: score / total >= PASS });
    setPhase("result");
  };

  const info = LEVELS[level - 1];
  const allDone = passed === LEVELS.length;

  return (
    <div className="sh-page">
      <header className="sh-hero">
        <div>
          <h1>Space heritage missions</h1>
          <p>Read real information from NASA’s archive, then answer questions about it. Pass a level to unlock the next one.</p>
        </div>
        <div className="sh-score" aria-label={`${points} points, ${passed} of ${LEVELS.length} levels passed`}>
          <Trophy size={20} aria-hidden="true" />
          <strong>{points}</strong><span>points</span>
          <span className="sh-bar"><span style={{ width: `${(passed / LEVELS.length) * 100}%` }} /></span>
          <small>{passed} of {LEVELS.length} levels passed</small>
        </div>
      </header>

      <PictureOfTheDay />

      <nav className="sh-levels" aria-label="Levels">
        {LEVELS.map((l, k) => {
          const n = k + 1;
          const open = unlocked(n);
          return (
            <button key={l.title} type="button" disabled={!open}
                    className={(n === level ? "on " : "") + (isPassed(best, n) ? "done" : "")}
                    aria-current={n === level ? "step" : undefined}
                    title={open ? l.title : "Pass the previous level to unlock"}
                    onClick={() => setLevel(n)}>
              {isPassed(best, n) ? <Check size={14} aria-hidden="true" /> : !open ? <Lock size={14} aria-hidden="true" /> : null}
              Level {n}
            </button>
          );
        })}
      </nav>

      <section className="sh-stage">
        <p className="sh-meta">Level {level} of {LEVELS.length}{best[level] ? ` · best ${best[level].score}/${best[level].total}` : ""}</p>
        <h2>{info.title}</h2>

        {phase === "read" && (
          <>
            {data.status === "loading" && <p className="sh-muted">Loading information from NASA…</p>}
            {data.status === "error" && (
              <div>
                <p className="sh-err">Couldn’t get information from NASA. Check your internet connection and try again.</p>
                <button type="button" className="sh-ghost" onClick={() => loadLevel(level, true)}><RefreshCw size={16} /> Try again</button>
              </div>
            )}
            {data.status === "ready" && (
              <>
                <p className="sh-muted">Read these three records carefully. The questions are about them.</p>
                <div className="sh-items">
                  {data.items.map((it) => (
                    <article key={it.id} className="sh-item">
                      <img src={it.image} alt={it.title} loading="lazy" />
                      <div>
                        <h3>{it.title}</h3>
                        <p className="sh-meta">{[it.year, CENTERS[it.center] || it.center].filter(Boolean).join(" · ")}</p>
                        <p>{it.text}</p>
                        <a href={`https://images.nasa.gov/details/${it.id}`} target="_blank" rel="noopener noreferrer">
                          View on NASA <ExternalLink size={14} aria-hidden="true" />
                        </a>
                      </div>
                    </article>
                  ))}
                </div>
                {note && <p className="sh-err" role="alert">{note}</p>}
                <div className="sh-actions">
                  <button type="button" className="sh-mark" onClick={startQuiz}>I’ve read it. Start the quiz</button>
                  <button type="button" className="sh-ghost" onClick={() => loadLevel(level, true)}><RefreshCw size={16} /> Load different information</button>
                </div>
              </>
            )}
          </>
        )}

        {phase === "quiz" && <QuizRun key={questions.map((q) => q.q).join("|")} questions={questions} onFinish={finish} />}

        {phase === "result" && result && (
          <div className="sh-result" role="status">
            <h3>{result.pass ? "Level passed" : "Not yet"}: {result.score} out of {result.total}</h3>
            <p>
              {result.gained > 0 ? `You earned ${result.gained} new points. ` : "No new points, because your best score for this level is unchanged. "}
              You now have {points} points.
            </p>
            {!result.pass && <p className="sh-muted">You need {Math.ceil(PASS * result.total)} correct to unlock the next level.</p>}
            <div className="sh-actions">
              {result.pass && level < LEVELS.length && (
                <button type="button" className="sh-mark" onClick={() => setLevel(level + 1)}>Go to Level {level + 1}</button>
              )}
              {!result.pass && <button type="button" className="sh-mark" onClick={() => setPhase("read")}>Read again</button>}
              <button type="button" className="sh-ghost" onClick={startQuiz}>{result.pass ? "Play for a better score" : "Retry with new questions"}</button>
            </div>
            {allDone && <p className="sh-done-msg">You passed every level. Great work.</p>}
          </div>
        )}
      </section>

      <p className="sh-foot">
        Text, photos and dates come from NASA’s Image and Video Library and are used here for education.
        Questions are generated automatically from that text. Unofficial fan project, not affiliated with or endorsed by NASA.
      </p>
    </div>
  );
}