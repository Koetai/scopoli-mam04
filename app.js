// Scopoli · MAM04 (a Koetai product) — a Rosalind-style practical on linked
// data, SPARQL and ontologies with live curry data from DBpedia and Wikidata.
// Plain JS, hash routing, progress kept in localStorage. Answers are checked
// against the live endpoints, so they keep up as the data changes.

const BY_ID = Object.fromEntries(PROBLEMS.map((p) => [p.id, p]));
const STORE = "koetai.scopoli-mam04.v1";
const view = document.getElementById("view");
let editor = null;

// ------------------------------------------------------------------ storage
function load() {
  let s;
  try { s = JSON.parse(localStorage.getItem(STORE)); } catch {}
  return Object.assign({ solved: {}, drafts: {} }, s || {});
}
function save(state) {
  try { localStorage.setItem(STORE, JSON.stringify(state)); } catch {}
}
let state = load();
const isSolved = (id) => !!state.solved[id];

function markSolved(p) {
  const first = !isSolved(p.id);
  state.solved[p.id] = Date.now();
  save(state);
  updateProgress();
  const nav = document.querySelector(".pnav");
  if (nav) nav.outerHTML = pageNav(p);
  return first;
}

// ------------------------------------------------------------------ helpers
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const trackDot = (t) => `<span class="dot" style="background:${TRACKS[t].color}"></span>`;
const kindOf = (p) => p.kind || "answer";
const unsolvedPrereqs = (p) => p.prereqs.filter((id) => !isSolved(id));
const children = (id) => PROBLEMS.filter((p) => p.prereqs.includes(id));
const TOOL = { guide: "Reading", answer: "Answer", choice: "Quiz" };
const toolLabel = (p) => kindOf(p) === "query" ? ENDPOINTS[p.endpoint].name : p.tool || TOOL[kindOf(p)];

const SHORT = [
  ["http://dbpedia.org/resource/", "dbr:"],
  ["http://dbpedia.org/ontology/", "dbo:"],
  ["http://dbpedia.org/property/", "dbp:"],
  ["http://www.wikidata.org/entity/", "wd:"],
  ["http://www.wikidata.org/prop/direct/", "wdt:"],
  ["http://www.w3.org/1999/02/22-rdf-syntax-ns#", "rdf:"],
  ["http://www.w3.org/2000/01/rdf-schema#", "rdfs:"],
  ["http://www.w3.org/2002/07/owl#", "owl:"],
  ["http://xmlns.com/foaf/0.1/", "foaf:"],
  ["http://purl.org/dc/terms/", "dct:"],
];
function shorten(iri) {
  for (const [long, pre] of SHORT) if (iri.startsWith(long)) return pre + iri.slice(long.length);
  return iri;
}

// Answers are compared in a canonical form, so dbr:Bunny_chow, Bunny chow and
// http://dbpedia.org/resource/Bunny_chow are the same, and so are wd:Q164606,
// Q164606 and its full IRI. Numbers ignore thousands separators.
function canon(x) {
  let s = String(x).trim().replace(/^<|>$/g, "").replace(/^"(.*)"(@\w+)?$/, "$1");
  s = s.replace(/^https?:\/\/dbpedia\.org\/(resource|ontology|property)\//, "").replace(/^(dbr|dbo|dbp):/, "");
  s = s.replace(/^https?:\/\/www\.wikidata\.org\/(entity|wiki)\//, "").replace(/^wdt?:/, "");
  s = s.toLowerCase().replace(/_/g, " ").replace(/\s+/g, " ").trim();
  if (/^[\d,. ]+$/.test(s)) s = s.replace(/[, ]/g, "");
  return s;
}
const matches = (input, accepted) => {
  const got = canon(input);
  return !!got && [].concat(accepted).some((a) => canon(a) === got);
};

function updateProgress() {
  const n = PROBLEMS.filter((p) => isSolved(p.id)).length;
  document.getElementById("progress").textContent = `${n} / ${PROBLEMS.length} solved`;
}

function cite(key) {
  const r = REFS[key];
  if (!r) return "";
  const link = r.doi ? `https://doi.org/${r.doi}` : r.url;
  return `${r.authors} (${r.year}). ${r.title}. <i>${r.venue}</i>.${link ? ` <a href="${link}" target="_blank">${esc(r.doi ? "doi:" + r.doi : link.replace(/^https?:\/\//, ""))}</a>` : ""}`;
}

// --------------------------------------------------------------- SPARQL I/O
async function runQuery(endpointKey, query) {
  const url = ENDPOINTS[endpointKey].url;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 90000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Accept: "application/sparql-results+json", "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ query }),
      signal: ctrl.signal,
    });
    const text = await res.text();
    if (res.status === 429) throw new Error(`${ENDPOINTS[endpointKey].name} says "too many requests". Wait a minute and try again.`);
    if (!res.ok) throw new Error(cleanError(text) || `HTTP ${res.status}`);
    let json;
    try { json = JSON.parse(text); } catch { throw new Error("The endpoint did not return SPARQL JSON results. Is this a SELECT query?"); }
    if (!json.head || !json.results) throw new Error("Only SELECT queries are supported here.");
    return { vars: json.head.vars, rows: json.results.bindings };
  } catch (e) {
    if (e.name === "AbortError") throw new Error("The query timed out. Simplify it, or try again in a minute.");
    if (e instanceof TypeError) throw new Error("Network error — the endpoint may be down or unreachable.");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// Endpoint error bodies are long stack traces; keep the useful line.
function cleanError(text) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const hit = lines.find((l) => /parse|Encountered|Lexical|syntax|MalformedQuery|Exception:|error/i.test(l) && l.length < 400);
  return (hit || lines.slice(0, 3).join(" ")).slice(0, 500);
}

const NUMERIC = /#(integer|decimal|double|float|int|long|short|nonNegativeInteger|positiveInteger)$/;
function norm(b) {
  if (!b) return "";
  if (b.type === "literal" && b.datatype && NUMERIC.test(b.datatype)) return String(Number(b.value));
  return b.value + (b["xml:lang"] ? "@" + b["xml:lang"] : "");
}
const keySet = (result, cols) => new Set(result.rows.map((r) => cols.map((c) => norm(r[c])).join(" │ ")));

// Reference results are cached per page load, so a class doesn't hammer the endpoints.
const refCache = {};
function cached(key, fn) {
  if (!refCache[key]) refCache[key] = fn().catch((e) => { delete refCache[key]; throw e; });
  return refCache[key];
}
const reference = (p) => cached("ref " + p.id, () => runQuery(p.endpoint, p.solution));

// ------------------------------------------------------------------- views
function home() {
  const counts = COURSE.order.map((t) => {
    const ps = PROBLEMS.filter((p) => p.track === t);
    return { t, total: ps.length, done: ps.filter((p) => isSolved(p.id)).length, first: ps[0] };
  });
  const next = PROBLEMS.find((p) => !isSolved(p.id) && unsolvedPrereqs(p).length === 0);
  const started = Object.keys(state.solved).length > 0;
  view.innerHTML = `
    <section class="hero">
      <h1>${COURSE.hero.title}</h1>
      <p>${COURSE.hero.text}</p>
      <p>${next ? `<a class="btn primary" href="#/p/${next.id}">${started ? "Continue" : "Start"} with ${next.id} · ${esc(next.title)} →</a>` : `<span class="btn primary">All problems solved 🎉</span>`}
      <a class="btn" href="#/tree">View the tree</a></p>
    </section>
    <div class="tracks">
      ${counts.map(({ t, total, done, first }, i) => `
        <div class="card">
          <div class="step">Part ${i + 1}</div>
          <h3>${trackDot(t)}${TRACKS[t].name}</h3>
          <div class="empty">${COURSE.blurbs[t]}</div>
          <p style="margin:10px 0 0;font-size:13px">${done} / ${total} solved · starts at <a href="#/p/${first.id}">${first.id}</a></p>
        </div>`).join("")}
    </div>`;
}

let listFilter = "all";
function list() {
  const rows = PROBLEMS.filter((p) => listFilter === "all" || p.track === listFilter);
  view.innerHTML = `
    <h1>Problems</h1>
    <div class="filters">
      <button class="chip ${listFilter === "all" ? "on" : ""}" data-f="all">All</button>
      ${COURSE.order.map((k) => `<button class="chip ${listFilter === k ? "on" : ""}" data-f="${k}">${trackDot(k)}${TRACKS[k].name}</button>`).join("")}
    </div>
    <div class="table-scroll"><table class="list">
      <thead><tr><th>ID</th><th>Title</th><th>Concept</th><th>Where</th><th>Status</th></tr></thead>
      <tbody>${rows.map((p) => `
        <tr>
          <td class="id">${trackDot(p.track)}<a href="#/p/${p.id}">${p.id}</a></td>
          <td><a href="#/p/${p.id}">${esc(p.title)}</a></td>
          <td class="concept">${esc(p.concept)}</td>
          <td class="concept">${esc(toolLabel(p))}</td>
          <td>${isSolved(p.id) ? '<span class="solved">✓ solved</span>' : unsolvedPrereqs(p).length ? '<span class="empty">locked</span>' : "open"}</td>
        </tr>`).join("")}
      </tbody>
    </table></div>`;
  view.querySelectorAll("[data-f]").forEach((b) => b.addEventListener("click", () => { listFilter = b.dataset.f; list(); }));
}

function tree() {
  // Layer = longest path from a root, then order each layer by parents' position.
  const level = {};
  const depth = (id) => level[id] ?? (level[id] = Math.max(-1, ...BY_ID[id].prereqs.map(depth)) + 1);
  PROBLEMS.forEach((p) => depth(p.id));
  const layers = [];
  PROBLEMS.forEach((p) => (layers[level[p.id]] ||= []).push(p.id));
  const order = Object.fromEntries(COURSE.order.map((t, i) => [t, i]));
  const xpos = {};
  layers.forEach((ids) => {
    const bary = (id) => { const ps = BY_ID[id].prereqs; return ps.length ? ps.reduce((s, q) => s + xpos[q], 0) / ps.length : 0; };
    ids.sort((a, b) => order[BY_ID[a].track] - order[BY_ID[b].track] || bary(a) - bary(b));
    ids.forEach((id, i) => (xpos[id] = i - (ids.length - 1) / 2));
  });
  const W = 118, H = 92, NW = 96, NH = 44;
  const maxW = Math.max(...layers.map((l) => l.length));
  const width = maxW * W + 40, height = layers.length * H + 30;
  const cx = (id) => width / 2 + xpos[id] * W;
  const cy = (id) => 30 + level[id] * H;
  let edges = "", nodes = "";
  PROBLEMS.forEach((p) => p.prereqs.forEach((q) => {
    const x1 = cx(q), y1 = cy(q) + NH / 2, x2 = cx(p.id), y2 = cy(p.id) - NH / 2, my = (y1 + y2) / 2;
    edges += `<path class="edge" d="M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}"/>`;
  }));
  PROBLEMS.forEach((p) => {
    const c = TRACKS[p.track].color, s = isSolved(p.id);
    nodes += `<a href="#/p/${p.id}"><g class="node ${s ? "solved" : ""}" transform="translate(${cx(p.id) - NW / 2},${cy(p.id) - NH / 2})">
      <title>${esc(p.title)} — ${esc(p.concept)}</title>
      <rect width="${NW}" height="${NH}" rx="8" style="stroke:${c};${s ? `fill:${c}` : ""}"/>
      <text x="${NW / 2}" y="19" text-anchor="middle">${p.id}${s ? " ✓" : ""}</text>
      <text class="sub" x="${NW / 2}" y="34" text-anchor="middle">${esc(p.title.length > 17 ? p.title.slice(0, 16) + "…" : p.title)}</text>
    </g></a>`;
  });
  view.innerHTML = `
    <h1>Problem tree</h1>
    <p class="empty">Arrows point from a problem to the problems it unlocks. Filled boxes are solved.</p>
    <div class="tree-box"><svg viewBox="0 0 ${width} ${height}" width="${width}" role="img" aria-label="Problem dependency tree">${edges}${nodes}</svg></div>
    <div class="legend">${COURSE.order.map((k) => `<span>${trackDot(k)}${TRACKS[k].name}</span>`).join("")}</div>`;
}

// Everything the student typed or picked, in course order, ready to copy
// into the course's quiz.
function answersPage() {
  const shown = (p) => {
    const d = state.drafts[p.id];
    if (d == null || d === "") return '<span class="empty">—</span>';
    if (kindOf(p) === "choice") return [].concat(d).map((i) => p.options[i] && p.options[i].text).filter(Boolean).join("<br>");
    if (kindOf(p) === "query") return `<pre>${esc(d)}</pre>`;
    return esc(d);
  };
  const rows = PROBLEMS.filter((p) => kindOf(p) !== "guide");
  view.innerHTML = `<div class="about">
    <h1>My answers</h1>
    <p>Everything you typed, picked or queried, in course order, so you can copy it into the course quiz. ${COURSE.answersNote || ""}</p>
    <p><button class="btn" id="copy">Copy all as text</button> <span id="copied" class="empty"></span></p>
    <div class="table-scroll"><table class="list answers-list">
      <thead><tr><th>ID</th><th>Question</th><th>Your answer</th><th></th></tr></thead>
      <tbody>${rows.map((p) => `<tr><td class="id">${trackDot(p.track)}<a href="#/p/${p.id}">${p.id}</a></td>
        <td>${p.q ? `<b>Q${p.q}</b> · ` : ""}${esc(p.title)}</td><td>${shown(p)}</td><td>${isSolved(p.id) ? '<span class="solved">✓</span>' : ""}</td></tr>`).join("")}</tbody>
    </table></div></div>`;
  document.getElementById("copy").addEventListener("click", async () => {
    const text = rows.map((p) => {
      const d = state.drafts[p.id];
      const body = d == null ? "" : kindOf(p) === "choice" ? [].concat(d).map((i) => p.options[i] && p.options[i].text.replace(/<[^>]+>/g, "")).join("; ") : d;
      return `${p.q ? "Q" + p.q + " " : ""}${p.id} · ${p.title}${isSolved(p.id) ? " ✓" : ""}\n${body}\n`;
    }).join("\n");
    try { await navigator.clipboard.writeText(text); document.getElementById("copied").textContent = "Copied."; }
    catch { document.getElementById("copied").textContent = "Your browser blocked the clipboard; select the table instead."; }
  });
}

function about() {
  view.innerHTML = `<div class="about">
    <h1>About</h1>
    ${COURSE.about}
    <h2>How checking works</h2>
    <p>For a <b>query</b> problem, your query and a reference query run live on the same endpoint when you press <b>Submit</b>. Your answer is correct when the values in the checked columns match. Column names matter (they're listed under <i>Return</i>); extra columns and row order don't.</p>
    <p>For an <b>answer</b> problem, the expected answer is worked out from the live data when you submit. DBpedia and Wikidata are edited every day, so your numbers may differ from a classmate's last week. Both are right for the moment they were checked.</p>
    <h2>Why "Scopoli"?</h2>
    <p><i>Koetai</i> takes its name from the four-eyed fish <i>Anableps</i>, which sees above and below the waterline at once. The Tyrolean naturalist <a href="https://www.wikidata.org/wiki/Q84181" target="_blank">Giovanni Antonio Scopoli</a> (1723–1788) established the genus <a href="https://www.wikidata.org/wiki/Q1976257" target="_blank"><i>Anableps</i></a> in 1777. Like the fish, this practical keeps two worlds in view: DBpedia and Wikidata.</p>
    <h2>References</h2>
    <ul class="refs">${Object.keys(REFS).map((k) => `<li>${cite(k)}</li>`).join("")}</ul>
    <p>Your progress and answers are stored only in this browser.</p>
    <p><button class="btn" id="reset">Reset my progress</button></p>
  </div>`;
  document.getElementById("reset").addEventListener("click", () => {
    if (confirm("Forget all solved problems and answers?")) { state = { solved: {}, drafts: {} }; save(state); updateProgress(); about(); }
  });
}

// Problems that are open now (prerequisites met, not solved), in course order,
// starting after `p` and preferring its own part.
function openAfter(p) {
  const i = PROBLEMS.indexOf(p);
  const ordered = [...PROBLEMS.slice(i + 1), ...PROBLEMS.slice(0, i)];
  const open = ordered.filter((q) => !isSolved(q.id) && unsolvedPrereqs(q).length === 0);
  return [...open.filter((q) => q.track === p.track), ...open.filter((q) => q.track !== p.track)];
}

function nextLinks(p) {
  const btn = (c) => `<a class="btn" href="#/p/${c.id}">${c.id} · ${esc(c.title)} →</a>`;
  const unlocked = children(p.id).filter((c) => unsolvedPrereqs(c).length === 0 && !isSolved(c.id));
  if (unlocked.length) return `<div class="next">Unlocked: ${unlocked.map(btn).join("")}</div>`;
  const next = openAfter(p)[0];
  if (next) return `<div class="next">Next up: ${btn(next)} <a href="#/tree">or pick from the tree</a></div>`;
  return `<div class="next">That was the last open problem. <a class="btn" href="#/answers">See my answers</a></div>`;
}

// Previous / tree / next bar under every problem, so no page is a dead end.
function pageNav(p) {
  const i = PROBLEMS.indexOf(p), prev = PROBLEMS[i - 1], next = PROBLEMS[i + 1], open = openAfter(p)[0];
  const link = (q, label) => q ? `<a href="#/p/${q.id}">${label}</a>` : "<span></span>";
  return `<nav class="pnav">
    ${link(prev, prev ? `← ${prev.id} · ${esc(prev.title)}` : "")}
    <span class="pnav-mid">${open && !isSolved(p.id) ? "" : open ? `<a class="btn primary" href="#/p/${open.id}">Next open: ${open.id} →</a>` : ""} <a href="#/tree">Tree</a></span>
    ${link(next, next ? `${next.id} · ${esc(next.title)} →` : "")}
  </nav>`;
}

function problem(id) {
  const p = BY_ID[id];
  if (!p) { view.innerHTML = `<p>No problem called ${esc(id)}. <a href="#/problems">Back to the list</a>.</p>`; return; }
  const kind = kindOf(p);
  const missing = unsolvedPrereqs(p);
  view.innerHTML = `
    <div class="crumbs"><a href="#/problems">Problems</a> › ${trackDot(p.track)}${TRACKS[p.track].name}</div>
    <div class="ptitle"><span class="pid">${p.id}</span><h1>${esc(p.title)}</h1></div>
    <div class="meta">
      ${p.q ? `<span>Quiz: <b>Question ${p.q}</b></span>` : ""}
      <span>Concept: <b>${esc(p.concept)}</b></span>
      <span>Where: <b>${esc(toolLabel(p))}</b></span>
      ${p.prereqs.length ? `<span>After: ${p.prereqs.map((q) => `<a href="#/p/${q}">${q}</a>`).join(", ")}</span>` : ""}
      ${isSolved(p.id) ? '<span class="badge solved-badge">✓ solved</span>' : ""}
    </div>
    ${missing.length ? `<div class="note">Recommended first: ${missing.map((q) => `<a href="#/p/${q}">${q} · ${esc(BY_ID[q].title)}</a>`).join(", ")}. You can still try this one.</div>` : ""}
    <div class="cols">
      <div>
        <div class="section"><h2>Background</h2>${p.story}</div>
        ${p.lesson ? `<div class="section"><h2>The concept</h2>${p.lesson}</div>` : ""}
        <div class="section"><h2>${kind === "guide" ? "Your step" : "Problem"}</h2>
          <div class="task">${p.task}${kind === "query" ? `
            <div class="ret"><b>Return:</b> ${p.returns.map((v) => `<code>?${v}</code>`).join(" ")}
            ${p.check.length < p.returns.length ? ` · checked on ${p.check.map((v) => `<code>?${v}</code>`).join(" ")}` : ""}</div>` : ""}
          </div>
          ${p.hint ? `<details><summary>Hint</summary><p>${p.hint}</p></details>` : ""}
          <div id="reveal"></div>
        </div>
        ${p.refs ? `<div class="section"><h2>Further reading</h2><ul class="refs">${p.refs.map((k) => `<li>${cite(k)}</li>`).join("")}</ul></div>` : ""}
      </div>
      <div class="editor-pane" id="pane"></div>
    </div>
    ${pageNav(p)}`;
  const pane = document.getElementById("pane");
  const verdictBox = () => document.getElementById("verdict");
  const solvedNow = (extra = "") => {
    const first = markSolved(p);
    renderReveal(p);
    verdictBox().innerHTML = `<div class="verdict ok"><b>Correct!</b>${extra}${first ? " Problem solved." : ""}${nextLinks(p)}</div>`;
  };

  if (kind === "guide") {
    pane.innerHTML = `<div class="card done-card">
      <p>${isSolved(p.id) ? "You've completed this step." : "Read the background and work through the step, then mark it as done."}</p>
      <button class="btn primary" id="done">${isSolved(p.id) ? "✓ Done" : "Mark as done"}</button>
      <div id="verdict"></div></div>`;
    document.getElementById("done").addEventListener("click", () => {
      markSolved(p);
      document.getElementById("done").textContent = "✓ Done";
      verdictBox().innerHTML = `<div class="verdict ok"><b>Done.</b>${nextLinks(p)}</div>`;
    });
    return;
  }

  if (kind === "answer") {
    pane.innerHTML = `<div class="card done-card">
      <label for="answer">Your answer</label>
      <div class="actions"><input id="answer" type="text" spellcheck="false" autocomplete="off" placeholder="${esc(p.placeholder || "type your answer")}">
      <button class="btn primary" id="submit">Submit answer</button></div>
      <div id="verdict"></div></div>`;
    const input = document.getElementById("answer");
    input.value = state.drafts[p.id] ?? "";
    input.addEventListener("input", () => { state.drafts[p.id] = input.value; save(state); });
    const check = async () => {
      let accepted = p.answers || [], stale = false;
      if (p.live) {
        verdictBox().innerHTML = `<div class="verdict info">Checking against the live data…</div>`;
        try { accepted = await cached("live " + p.id, p.live); } catch { stale = true; }
      }
      const note = stale ? ` <span class="empty">(The endpoint didn't answer, so this was checked against the answer recorded on ${COURSE.checked}.)</span>` : "";
      if (matches(input.value, accepted)) solvedNow(note);
      else verdictBox().innerHTML = `<div class="verdict bad"><b>Not quite.</b> ${p.wrong || "Try again."}${note}</div>`;
    };
    document.getElementById("submit").addEventListener("click", check);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") check(); });
    renderReveal(p);
    return;
  }

  if (kind === "choice") {
    const type = p.multi ? "checkbox" : "radio";
    const picked0 = [].concat(state.drafts[p.id] ?? []);
    pane.innerHTML = `<div class="card done-card">
      <div class="choice-q">${p.multi ? "Select <b>all</b> that apply." : "Select one."}</div>
      ${p.options.map((o, i) => `<label class="opt"><input type="${type}" name="opt" value="${i}" ${picked0.includes(i) ? "checked" : ""}> <span>${o.text}</span></label>`).join("")}
      <div class="actions"><button class="btn primary" id="submit">Submit answer</button></div>
      <div id="verdict"></div></div>`;
    const boxes = () => [...pane.querySelectorAll("input[name=opt]")];
    boxes().forEach((b) => b.addEventListener("change", () => {
      state.drafts[p.id] = boxes().map((x, i) => x.checked ? i : -1).filter((i) => i >= 0);
      save(state);
    }));
    document.getElementById("submit").addEventListener("click", () => {
      const picked = boxes().map((x) => x.checked);
      const wrong = p.options.filter((o, i) => !!o.correct !== picked[i]).length;
      if (!wrong) {
        pane.querySelectorAll(".opt .why").forEach((el) => el.remove());
        pane.querySelectorAll(".opt").forEach((el, i) => { if (p.options[i].why) el.insertAdjacentHTML("beforeend", `<div class="why">${p.options[i].why}</div>`); });
        solvedNow();
      } else {
        verdictBox().innerHTML = `<div class="verdict bad"><b>Not quite.</b> ${p.multi ? `${wrong} option${wrong === 1 ? " is" : "s are"} set wrongly.` : "Try again."}</div>`;
      }
    });
    renderReveal(p);
    return;
  }

  // query: a SPARQL editor, run live; Submit compares with the reference query.
  const ep = ENDPOINTS[p.endpoint];
  pane.innerHTML = `
    <div class="endpoint"><span>Endpoint: <b>${esc(ep.name)}</b></span><a href="#" id="open-ui" target="_blank">open in ${esc(ep.name)} ↗</a></div>
    <textarea id="q"></textarea>
    <div class="actions">
      <button class="btn" id="run">▶ Run</button>
      <button class="btn primary" id="submit">Submit answer</button>
      <span class="spacer"></span>
      <span class="kbd">⌘/Ctrl + Enter to run</span>
      <button class="btn" id="reset-q" title="Restore the starter query">Reset</button>
    </div>
    <div id="verdict"></div>
    <div id="out"></div>`;
  editor = CodeMirror.fromTextArea(document.getElementById("q"), {
    mode: "application/sparql-query", lineNumbers: true, matchBrackets: true, indentUnit: 2, lineWrapping: true,
    extraKeys: { "Cmd-Enter": () => run(false), "Ctrl-Enter": () => run(false) },
  });
  editor.setValue(state.drafts[p.id] ?? p.starter);
  editor.on("change", () => { state.drafts[p.id] = editor.getValue(); save(state); });
  document.getElementById("open-ui").addEventListener("click", (e) => { e.currentTarget.href = ep.ui(editor.getValue()); });
  document.getElementById("run").addEventListener("click", () => run(false));
  document.getElementById("submit").addEventListener("click", () => run(true));
  document.getElementById("reset-q").addEventListener("click", () => {
    if (confirm("Replace your query with the starter query?")) editor.setValue(p.starter);
  });
  renderReveal(p);

  async function run(submit) {
    const runBtn = document.getElementById("run"), subBtn = document.getElementById("submit");
    const out = document.getElementById("out");
    if (!state.drafts[p.id]) { state.drafts[p.id] = editor.getValue(); save(state); }
    runBtn.disabled = subBtn.disabled = true;
    verdictBox().innerHTML = `<div class="verdict info">${submit ? "Running your query and the reference query…" : "Running…"}</div>`;
    const t0 = performance.now();
    try {
      const [mine, ref] = await Promise.all([runQuery(p.endpoint, editor.getValue()), submit ? reference(p) : null]);
      out.innerHTML = renderTable(mine, ((performance.now() - t0) / 1000).toFixed(1));
      verdictBox().innerHTML = submit ? judge(p, mine, ref) : "";
    } catch (e) {
      verdictBox().innerHTML = `<div class="verdict bad"><b>Query failed.</b> ${esc(e.message)}</div>`;
    } finally {
      runBtn.disabled = subBtn.disabled = false;
    }
  }
}

function renderTable(res, secs) {
  if (!res.rows.length) return `<div class="results"><div class="count">No results (${secs}s).</div></div>`;
  const shown = res.rows.slice(0, 500);
  const cell = (b) => {
    if (!b) return "";
    if (b.type === "uri") return `<a href="${esc(b.value)}" target="_blank" title="${esc(b.value)}">${esc(shorten(b.value))}</a>`;
    return esc(b.value) + (b["xml:lang"] ? `<span class="empty">@${esc(b["xml:lang"])}</span>` : "")
      + (b.datatype && !NUMERIC.test(b.datatype) ? `<span class="empty">^^${esc(shorten(b.datatype).replace("http://www.w3.org/2001/XMLSchema#", "xsd:"))}</span>` : "");
  };
  return `<div class="results">
    <div class="count">${res.rows.length} row${res.rows.length === 1 ? "" : "s"} in ${secs}s${res.rows.length > 500 ? " — showing the first 500" : ""}</div>
    <table><thead><tr>${res.vars.map((v) => `<th>?${esc(v)}</th>`).join("")}</tr></thead>
    <tbody>${shown.map((r) => `<tr>${res.vars.map((v) => `<td>${cell(r[v])}</td>`).join("")}</tr>`).join("")}</tbody></table>
  </div>`;
}

function judge(p, mine, ref) {
  const absent = p.check.filter((c) => !mine.vars.includes(c));
  if (absent.length) {
    return `<div class="verdict bad"><b>Not quite.</b> Your result needs a column named ${absent.map((c) => `<code>?${c}</code>`).join(", ")}.</div>`;
  }
  const want = keySet(ref, p.check), got = keySet(mine, p.check);
  const miss = [...want].filter((k) => !got.has(k)), extra = [...got].filter((k) => !want.has(k));
  if (!miss.length && !extra.length) {
    const first = markSolved(p);
    renderReveal(p);
    return `<div class="verdict ok"><b>Correct!</b> ${want.size} expected value${want.size === 1 ? "" : "s"} matched.${first ? " Problem solved." : ""}${nextLinks(p)}</div>`;
  }
  const show = (arr) => arr.slice(0, 3).map((k) => `<li><code>${esc(k.split(" │ ").map(shorten).join(" │ "))}</code></li>`).join("") + (arr.length > 3 ? `<li>… and ${arr.length - 3} more</li>` : "");
  return `<div class="verdict bad"><b>Not quite.</b> Matched ${want.size - miss.length} of ${want.size} expected value${want.size === 1 ? "" : "s"} in ${p.check.map((c) => `<code>?${c}</code>`).join(", ")}.
    ${miss.length ? `<div>Missing:</div><ul>${show(miss)}</ul>` : ""}
    ${extra.length ? `<div>Unexpected:</div><ul>${show(extra)}</ul>` : ""}</div>`;
}

function renderReveal(p) {
  const box = document.getElementById("reveal");
  if (!box || !p.explain) return;
  const body = p.solution ? `<pre>${esc(p.solution)}</pre>`
    : p.options ? `<ul>${p.options.map((o) => `<li>${o.correct ? "✓" : "✗"} ${o.text}${o.why ? ` — <span class="empty">${o.why}</span>` : ""}</li>`).join("")}</ul>`
    : p.answers ? `<p>Answer on ${COURSE.checked}: <code>${esc([].concat(p.answers)[0])}</code></p>` : "";
  if (isSolved(p.id)) box.innerHTML = `<div class="reveal"><h2>${p.solution ? "Reference query" : "Explanation"}</h2>${body}<p>${p.explain}</p></div>`;
  else if (COURSE.giveUp && kindOf(p) !== "guide") box.innerHTML = `<details><summary>Give up and show the answer</summary>${body}<p>${p.explain}</p></details>`;
  else box.innerHTML = "";
}

// ------------------------------------------------------------------ router
function route() {
  const h = location.hash.replace(/^#\/?/, "");
  const [page, arg] = h.split("/");
  document.querySelectorAll("[data-nav]").forEach((a) => a.classList.toggle("on", a.dataset.nav === (page === "p" ? "problems" : page)));
  if (page === "problems") list();
  else if (page === "tree") tree();
  else if (page === "answers") answersPage();
  else if (page === "about") about();
  else if (page === "p") problem(arg?.toUpperCase());
  else home();
  updateProgress();
  window.scrollTo(0, 0);
}
window.addEventListener("hashchange", route);
route();
