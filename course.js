// Scopoli · MAM04 — course content. The practical "SPARQL with food data —
// curry edition" for a master's course on clinical decision support
// (Practical Reasoning with Health Data), as a tree of small problems.
// Problems carry `q`, the question number in the course quiz.

const ENDPOINTS = {
  dbpedia: {
    name: "DBpedia",
    url: "https://dbpedia.org/sparql",
    ui: (q) => "https://dbpedia.org/sparql?qtxt=" + encodeURIComponent(q),
  },
  wikidata: {
    name: "Wikidata",
    url: "https://query.wikidata.org/sparql",
    ui: (q) => "https://query.wikidata.org/#" + encodeURIComponent(q),
  },
};

const COURSE = {
  checked: "15 November 2026",
  // The course quiz is graded, so students can't reveal answers before solving.
  giveUp: false,
  hero: {
    title: "SPARQL with food data — curry edition",
    text: "A Thai green curry, a chicken tikka masala, a Japanese karē and a Goan vindaloo are all called “curry”, yet they differ in ingredients, origin and allergens. Query them live in DBpedia and Wikidata, meet the mess of crowd-sourced data, see why ontologies matter, and finish by reasoning about which curries can trigger a food allergy — the kind of inference a clinical decision support system makes.",
  },
  order: ["one", "all", "cmp", "wd", "alg"],
  blurbs: {
    one: "Triples, predicates, resources and literals: everything DBpedia knows about green curry.",
    all: "Find all curries with a triple pattern; prefixes, literals, language tags.",
    cmp: "Joins, labels in many languages, GROUP BY and COUNT — and why DBpedia's raw data needs an ontology.",
    wd: "Wikidata's identifiers, the label service and subclass hierarchies with property paths.",
    alg: "Assignment: link curries to food allergies, count them, and reflect on using such data for clinical decisions.",
  },
  answersNote: "Counts come from live data. If yours differs from what classmates found, add one line explaining why.",
  about: `
    <p><b>Scopoli · MAM04</b> is the SPARQL practical of the master's course <i>Practical Reasoning with Health Data</i> (MAM04), rebuilt as a tree of small problems in the style of <a href="https://rosalind.info" target="_blank">Rosalind</a>. It replaces the earlier walk-through about David Bowie and causes of death, which stopped working when DBpedia changed how it types musicians.</p>
    <p>The questions follow the course quiz: each problem shows its quiz question number. Work through the problems here, where you get immediate feedback, then copy your answers from <a href="#/answers">My answers</a> into the quiz.</p>
    <p>For help, see pages 38–46 of <i>Semantics for Dummies</i> and the SPARQL lecture slides.</p>
    <h2>Attention</h2>
    <ul>
      <li>The point is understanding the syntax, not clicking to the right number.</li>
      <li>When a question asks you to <b>find</b> something, search the results (CTRL+F or CMD+F); you don't need a new query.</li>
      <li>When asked to <b>devise</b> a query, a small adaptation or combination of recent queries is enough. Only the allergy assignment asks for a largely self-made query.</li>
      <li>Both sources are crowd-sourced. Expect missing results, duplicates, inconsistent representations and contradictions. That is fine here (you will meet several), but a real challenge in practice.</li>
    </ul>`,
};

const TRACKS = {
  one: { name: "One curry in DBpedia", color: "var(--t-find)" },
  all: { name: "All curries", color: "var(--t-nav)" },
  cmp: { name: "Comparing curries", color: "var(--t-map)" },
  wd: { name: "Wikidata", color: "var(--t-auth)" },
  alg: { name: "Allergy assignment", color: "var(--t-lic)" },
};

const REFS = {
  sparql11: { authors: "Harris S, Seaborne A", year: 2013, title: "SPARQL 1.1 Query Language", venue: "W3C Recommendation", url: "https://www.w3.org/TR/sparql11-query/" },
  rdf11: { authors: "Cyganiak R, Wood D, Lanthaler M", year: 2014, title: "RDF 1.1 Concepts and Abstract Syntax", venue: "W3C Recommendation", url: "https://www.w3.org/TR/rdf11-concepts/" },
  dbpedia: { authors: "Lehmann J, Isele R, Jakob M, et al.", year: 2015, title: "DBpedia – A large-scale, multilingual knowledge base extracted from Wikipedia", venue: "Semantic Web 6(2):167–195", doi: "10.3233/SW-140134" },
  wikidata: { authors: "Vrandečić D, Krötzsch M", year: 2014, title: "Wikidata: a free collaborative knowledgebase", venue: "Communications of the ACM 57(10):78–85", doi: "10.1145/2629489" },
  ancker: { authors: "Ancker JS, Edwards A, Nosal S, et al.", year: 2017, title: "Effects of workload, work complexity, and repeated alerts on alert fatigue in a clinical decision support system", venue: "BMC Medical Informatics and Decision Making 17:36", doi: "10.1186/s12911-017-0430-8" },
};

// ------------------------------------------------------------ query helpers
const DBP = "PREFIX dbo: <http://dbpedia.org/ontology/>\nPREFIX dbp: <http://dbpedia.org/property/>\nPREFIX dbr: <http://dbpedia.org/resource/>\n";
const LABEL = 'SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }';
const pre = (q) => `<pre>${q.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</pre>`;
const ui = (ep, q, text) => `<a href="${ENDPOINTS[ep].ui(q)}" target="_blank">${text}</a>`;

// Live answers: worked out from the endpoint when the student submits.
const rowCount = (ep, q) => async () => [String((await runQuery(ep, q)).rows.length)];
const values = (ep, q) => async () => {
  const r = await runQuery(ep, q);
  return r.rows.flatMap((row) => r.vars.map((v) => row[v] && row[v].value).filter(Boolean));
};
// Rows with ?n; accept the item and label of every row tied for the maximum.
const topRows = (ep, q) => async () => {
  const r = await runQuery(ep, q);
  const n = (row) => Number(row.n.value);
  const max = Math.max(...r.rows.map(n));
  return r.rows.filter((row) => n(row) === max).flatMap((row) => r.vars.filter((v) => v !== "n").map((v) => row[v] && row[v].value).filter(Boolean));
};

// Queries used in several problems.
const Q = {
  green: "select ?p ?o\nwhere { <http://dbpedia.org/resource/Green_curry> ?p ?o }",
  allCurries: "select ?s ?country\nWHERE {\n  ?s <http://dbpedia.org/ontology/type> <http://dbpedia.org/resource/Curry> .\n  ?s <http://dbpedia.org/ontology/country> ?country .\n}\nORDER BY ?country",
  thaiLiteral: DBP + 'select ?s\nWHERE {\n  ?s dbo:type dbr:Curry .\n  ?s dbp:country "Thailand"@en .\n}',
  thaiResource: DBP + "select ?s\nWHERE {\n  ?s dbo:type dbr:Curry .\n  ?s dbp:country dbr:Thailand .\n}",
  join: "PREFIX dbo: <http://dbpedia.org/ontology/>\nPREFIX dbr: <http://dbpedia.org/resource/>\nselect ?ingredient\nWHERE {\n  dbr:Green_curry dbo:ingredient ?ingredient .\n  dbr:Red_curry   dbo:ingredient ?ingredient .\n}",
  peanut: "PREFIX dbo: <http://dbpedia.org/ontology/>\nPREFIX dbr: <http://dbpedia.org/resource/>\nselect ?s\nWHERE {\n  ?s dbo:ingredient dbr:Peanut .\n  ?s dbo:ingredient dbr:Coconut_milk .\n}",
  labels: "select ?label\nWHERE { <http://dbpedia.org/resource/Curry> <http://www.w3.org/2000/01/rdf-schema#label> ?label }",
  byCountry: DBP + "select (count(?s) as ?n) ?country\nWHERE {\n  ?s dbo:type dbr:Curry .\n  ?s dbp:country ?country .\n}\nGROUP BY ?country\nORDER BY DESC(?n)",
  sub: `SELECT ?curry ?curryLabel\nWHERE {\n  ?curry wdt:P279 wd:Q164606 .\n  ${LABEL}\n}\nORDER BY ?curryLabel`,
  subStar: `SELECT ?curry ?curryLabel\nWHERE {\n  ?curry wdt:P279* wd:Q164606 .\n  ${LABEL}\n}\nORDER BY ?curryLabel`,
  wdCountry: `SELECT ?country ?countryLabel (COUNT(DISTINCT ?curry) AS ?n)\nWHERE {\n  ?curry wdt:P279* wd:Q164606 .\n  ?curry wdt:P495 ?country .\n  ${LABEL}\n}\nGROUP BY ?country ?countryLabel\nORDER BY DESC(?n)`,
  wdIngredient: `SELECT ?ingredient ?ingredientLabel (COUNT(DISTINCT ?curry) AS ?n)\nWHERE {\n  ?curry wdt:P279* wd:Q164606 .\n  ?curry wdt:P186 ?ingredient .\n  ${LABEL}\n}\nGROUP BY ?ingredient ?ingredientLabel\nORDER BY DESC(?n)`,
  allergies: `SELECT ?allergy ?allergyLabel ?cause ?causeLabel\nWHERE {\n  ?allergy wdt:P279* wd:Q769815 .\n  ?allergy wdt:P828 ?cause .\n  ${LABEL}\n}\nORDER BY ?allergyLabel`,
  curryAllergy: `SELECT DISTINCT ?curry ?curryLabel ?ingredientLabel ?allergy ?allergyLabel\nWHERE {\n  ?curry wdt:P279* wd:Q164606 .\n  ?curry wdt:P186 ?ingredient .\n  ?allergy wdt:P279* wd:Q769815 .\n  ?allergy wdt:P828 ?ingredient .\n  ${LABEL}\n}\nORDER BY ?curryLabel`,
  perAllergy: `SELECT ?allergy ?allergyLabel (COUNT(DISTINCT ?curry) AS ?n)\nWHERE {\n  ?curry wdt:P279* wd:Q164606 .\n  ?curry wdt:P186 ?ingredient .\n  ?allergy wdt:P279* wd:Q769815 .\n  ?allergy wdt:P828 ?ingredient .\n  ${LABEL}\n}\nGROUP BY ?allergy ?allergyLabel\nORDER BY DESC(?n)`,
  perAllergyPath: `SELECT ?allergy ?allergyLabel (COUNT(DISTINCT ?curry) AS ?n)\nWHERE {\n  ?curry wdt:P279* wd:Q164606 .\n  ?curry wdt:P186 ?ingredient .\n  ?ingredient wdt:P279* ?cause .\n  ?allergy wdt:P279* wd:Q769815 .\n  ?allergy wdt:P828 ?cause .\n  ${LABEL}\n}\nGROUP BY ?allergy ?allergyLabel\nORDER BY DESC(?n)`,
};

const PROBLEMS = [
  // ------------------------------------------------ Part 1: one curry in DBpedia
  {
    id: "GREN", track: "one", kind: "query", endpoint: "dbpedia", prereqs: [], title: "Everything about green curry",
    concept: "Triple patterns",
    story: `<p>DBpedia is a crowd-sourced effort to extract structured information from Wikipedia and publish it as linked data. Every fact is a <b>triple</b>: subject, predicate, object. In <i>Semantics for Dummies</i> (p. 39) a query asks for all predicates and objects of one subject. We do the same for Thai green curry.</p>`,
    lesson: `<p>In <code>?p ?o</code> the question marks make <i>variables</i>. The subject is fixed: the DBpedia resource for green curry. The endpoint returns every predicate–object pair it has for that subject.</p>
      <p>Among the results is this line:</p>${pre("http://www.w3.org/1999/02/22-rdf-syntax-ns#type   http://dbpedia.org/ontology/Food")}
      <p>It means: green curry <i>is a</i> (has type) Food. All predicates and most objects are links; click a few. An object that is not a link is a <b>literal</b>: a piece of text or a number.</p>`,
    task: `<p><b>Run the query in the editor</b> (▶ Run), look through the results, then press <b>Submit answer</b>.</p>`,
    returns: ["p", "o"], check: ["p", "o"],
    starter: Q.green, solution: Q.green,
    explain: "You asked for every triple whose subject is dbr:Green_curry. Keep these results open: the next three questions are about them.",
    refs: ["rdf11", "dbpedia"],
  },
  {
    id: "INGR", q: 1, track: "one", kind: "choice", multi: true, prereqs: ["GREN"], title: "Three ways to say ingredient",
    concept: "Resources and literals",
    story: `<p>Green curry's ingredients are described with three different predicates. That is typical of DBpedia: some predicates come from its curated ontology, others are copied straight from Wikipedia infoboxes.</p>`,
    lesson: `<p>An object is a <b>resource</b> when it is a link (an IRI, shown as <code>http://…</code>) and a <b>literal</b> when it is text or a number. A literal may carry a language tag such as <code>@en</code>.</p>`,
    task: `<p>In the results of <a href="#/p/GREN">GREN</a>, <b>find</b> the predicates that describe green curry's ingredients. Which three are they?</p>`,
    options: [
      { text: "<code>dbo:ingredient</code>", correct: true, why: "Links (resources), for example <code>dbr:Coconut_milk</code>." },
      { text: "<code>dbp:mainIngredient</code>", correct: true, why: "A mix: some links, some text such as “green curry paste”@en." },
      { text: "<code>dbo:ingredientName</code>", correct: true, why: "Text only (literals), for example “palm sugar”." },
      { text: "<code>dbo:servingTemperature</code>", why: "How it's served (“Hot”), not what's in it." },
      { text: "<code>dbp:alternateName</code>", why: "Other names for the dish." },
      { text: "<code>dct:subject</code>", why: "The Wikipedia category, <code>Category:Thai_curries</code>." },
    ],
    explain: "Three predicates for one kind of fact, with three kinds of objects. Someone searching only dbo:ingredient misses what only dbp:mainIngredient says, and text such as “kaffir limeleaves” can't be linked to anything.",
  },
  {
    id: "CTRY", q: 2, track: "one", kind: "choice", multi: true, prereqs: ["GREN"], title: "Where is it from?",
    concept: "Consistency",
    story: `<p>Origin matters in nutrition research: a “curry” from Thailand and one from the United Kingdom are different dishes. Let's see how consistently DBpedia records it.</p>`,
    lesson: `<p>To look at another dish, change only the subject. Replace <code>Green_curry</code> with <code>Chicken_tikka_masala</code> in the <a href="#/p/GREN">GREN</a> query: ${ui("dbpedia", Q.green.replace("Green_curry", "Chicken_tikka_masala"), "run it on DBpedia ↗")}.</p>`,
    task: `<p>Which predicates give the country of green curry, and what is the value? Now <b>run the same query for <code>Chicken_tikka_masala</code></b>. Which statements are true?</p>`,
    options: [
      { text: "Green curry: <code>dbo:country</code> and <code>dbp:country</code> both give <code>dbr:Thailand</code>.", correct: true, why: "Consistent: two predicates, one value." },
      { text: "Chicken tikka masala: <code>dbp:country</code> gives <code>dbr:United_Kingdom</code> and <code>dbr:Indian_subcontinent</code>, both resources.", correct: true, why: "Defensible (a British-Indian invention), but it mixes a country and a region." },
      { text: "Chicken tikka masala: <code>dbo:country</code> gives <code>dbr:India</code>.", why: "It has no <code>dbo:country</code> at all, only the raw <code>dbp:country</code>." },
      { text: "Chicken tikka masala is typed <code>dbo:Food</code>, just like green curry.", why: "Its only type is <code>owl:Thing</code>. A query for all Food would miss it." },
    ],
    explain: "One dish is described with both curated and raw predicates; the other only with raw ones, and it isn't even typed as Food. Queries that rely on one predicate or one type silently miss data.",
  },
  {
    id: "TYPE", q: 3, track: "one", prereqs: ["GREN"], title: "What type of curry?",
    concept: "Object of a triple", placeholder: "e.g. dbr:Something",
    story: `<p>Besides <code>rdf:type</code>, DBpedia has its own predicate <code>http://dbpedia.org/ontology/type</code> (<code>dbo:type</code>), copied from the “type” field of Wikipedia's food infobox.</p>`,
    task: `<p>In the results of <a href="#/p/GREN">GREN</a>, what is the value of <code>http://dbpedia.org/ontology/type</code> for green curry? Remember it: it matters in <a href="#/p/GRNI">GRNI</a>.</p>`,
    live: values("dbpedia", DBP + "select ?t WHERE { dbr:Green_curry dbo:type ?t }"),
    answers: ["dbr:Thai_curry"],
    wrong: "Search the results for “ontology/type” (not the rdf:type lines).",
    explain: "Green curry's dbo:type is Thai curry, not Curry. Hold on to that.",
  },

  // ------------------------------------------------------- Part 2: all curries
  {
    id: "ALLC", track: "all", kind: "query", endpoint: "dbpedia", prereqs: ["TYPE"], title: "Find all curries",
    concept: "Variables in subject position",
    story: `<p>Now we want other curries. We keep the predicate and object fixed and search for subjects, which we call <code>?s</code>. The name is arbitrary (<code>?dish</code>, <code>?qwerty</code>); the question mark makes it an unbound variable.</p>`,
    lesson: `<p>Each triple ends with a period, “.”. Read the period as AND: we want subjects whose type is Curry <b>and</b> that have a country. <code>ORDER BY</code> sorts the results by country.</p>`,
    task: `<p><b>Run the query</b>, look at the results and <b>Submit</b>. Keep the results open for the next questions.</p>`,
    returns: ["s", "country"], check: ["s", "country"],
    starter: Q.allCurries, solution: Q.allCurries,
    explain: "Two triple patterns share the variable ?s, so only subjects that match both are returned.",
    refs: ["sparql11"],
  },
  {
    id: "SAFR", q: 4, track: "all", prereqs: ["ALLC"], title: "A curry from South Africa",
    concept: "Reading results", placeholder: "the curry's name",
    story: `<p>Curry travelled with the Indian diaspora, and some of its descendants are national dishes far from India.</p>`,
    task: `<p>Which curry comes from South Africa? (<b>find</b> it in the results of <a href="#/p/ALLC">ALLC</a>)</p>`,
    live: values("dbpedia", DBP + "select ?s WHERE { ?s dbo:type dbr:Curry . ?s dbo:country dbr:South_Africa }"),
    answers: ["Bunny chow"],
    explain: "Bunny chow: a hollowed-out loaf of bread filled with curry, from Durban.",
  },
  {
    id: "INDI", q: 5, track: "all", prereqs: ["ALLC"], title: "Curries from India",
    concept: "Counting by search", placeholder: "a number",
    story: `<p>India has the most curries in DBpedia, but how many exactly?</p>`,
    task: `<p>How many rows have <code>http://dbpedia.org/resource/India</code> as country? (search the results of <a href="#/p/ALLC">ALLC</a> and count the matches)</p>`,
    hint: "Search for “resource/India” followed by the end of the cell; Indian_subcontinent doesn't count.",
    live: rowCount("dbpedia", DBP + "select ?s WHERE { ?s dbo:type dbr:Curry . ?s dbo:country dbr:India }"),
    answers: ["21"],
    explain: "Only rows with exactly dbr:India count. In a later problem you'll let SPARQL do the counting.",
  },
  {
    id: "GRNI", q: 6, track: "all", kind: "choice", prereqs: ["ALLC"], title: "Where did green curry go?",
    concept: "Hierarchy",
    story: `<p>Green curry is a curry, and it has a country. So it should be in the results of <a href="#/p/ALLC">ALLC</a>… shouldn't it?</p>`,
    task: `<p>Is green curry among the results? Use your answer to <a href="#/p/TYPE">TYPE</a> to explain why.</p>`,
    options: [
      { text: "True: it has a country, so it's listed." },
      { text: "False: its <code>dbo:type</code> is <code>dbr:Thai_curry</code>, not <code>dbr:Curry</code>, and the query only matches the exact value.", correct: true },
      { text: "False: green curry has no country in DBpedia." },
    ],
    explain: "SPARQL matches exactly what is written. Knowing that a Thai curry is a kind of curry takes a hierarchy — an ontology — and a query that follows it. You'll do that in Wikidata.",
  },
  {
    id: "PREF", track: "all", kind: "query", endpoint: "dbpedia", prereqs: ["GRNI"], title: "Prefixes and literals",
    concept: "PREFIX, literals",
    story: `<p>Long IRIs are tiring, so we define shorthands with <code>PREFIX</code>. A prefix covers everything up to the last <code>#</code> or <code>/</code>. Its name, ending in a colon, can be anything, but usually it's a recognisable abbreviation.</p>`,
    lesson: `<p>DBpedia uses two namespaces for predicates. <code>dbo:</code> (<code>http://dbpedia.org/ontology/</code>) holds curated ontology properties. <code>dbp:</code> (<code>http://dbpedia.org/property/</code>) holds raw properties copied straight from Wikipedia infoboxes. Raw properties often give text where you'd expect a link.</p>
      <p>An object can be a literal: text in quotes with a language tag, such as <code>"Thailand"@en</code>. Numbers and dates carry a datatype instead, shown with <code>^^</code>: a year appears as <code>"2016"^^xsd:gYear</code>.</p>`,
    task: `<p><b>Devise</b> a query, using the prefixes in the editor, for all curries (<code>dbo:type dbr:Curry</code>) whose raw country <code>dbp:country</code> is the literal <code>"Thailand"@en</code>.</p>`,
    returns: ["s"], check: ["s"],
    starter: DBP + "select ?s\nWHERE {\n  \n}",
    solution: Q.thaiLiteral,
    explain: "With prefixes, dbr:Curry stands for &lt;http://dbpedia.org/resource/Curry&gt;. The object \"Thailand\"@en is a literal, not a link.",
  },
  {
    id: "THAI", q: 7, track: "all", prereqs: ["PREF"], title: "Thailand as text",
    concept: "Literal matching", placeholder: "a number",
    story: `<p>In the raw data, some curries have Thailand as a link and some as text.</p>`,
    task: `<p>How many curries have the literal <code>"Thailand"@en</code> as <code>dbp:country</code>?</p>`,
    live: rowCount("dbpedia", Q.thaiLiteral),
    answers: ["3"],
    explain: "These are curries where the Wikipedia infobox gave plain text rather than a link.",
  },
  {
    id: "THRS", q: 7, track: "all", prereqs: ["PREF"], title: "Thailand as a link",
    concept: "Resource matching", placeholder: "a number",
    story: `<p>Now look for the resource instead of the text.</p>`,
    task: `<p>In your <a href="#/p/PREF">PREF</a> query, replace <code>"Thailand"@en</code> by the resource <code>dbr:Thailand</code>. How many results now?</p>`,
    live: rowCount("dbpedia", Q.thaiResource),
    answers: ["4"],
    explain: "A different set of curries. To get all Thai curries you would need both, plus regions such as Central Thailand. That's the problem an ontology solves.",
  },
  {
    id: "NOLA", q: 8, track: "all", kind: "choice", prereqs: ["THAI"], title: "Lose the language tag",
    concept: "Language tags",
    story: `<p>What if you leave the language tag off?</p>`,
    task: `<p>Remove the <code>@en</code> so the line reads <code>?s dbp:country "Thailand" .</code> How many results do you get, and why?</p>`,
    options: [
      { text: "0: a literal without a language tag is a different value from the same text tagged <code>@en</code>.", correct: true },
      { text: "3: the language tag is ignored when matching." },
      { text: "7: the plain string matches both the literals and the resources." },
      { text: "An error: every string needs a language tag." },
    ],
    explain: "\"Thailand\" and \"Thailand\"@en are different RDF terms. To match text regardless of language, you'd use FILTER(STR(?country) = \"Thailand\").",
  },

  // ------------------------------------------------ Part 3: comparing curries
  {
    id: "JOIN", track: "cmp", kind: "query", endpoint: "dbpedia", prereqs: ["THRS"], title: "Green meets red",
    concept: "Joins",
    story: `<p>What do green curry and red curry have in common? We reuse one variable in two triples: <code>?ingredient</code> must be an ingredient of both.</p>`,
    lesson: `<p>Because the same variable appears in both triples, only values that satisfy both are returned. This is called a <b>join</b>.</p>`,
    task: `<p><b>Run the query</b> and <b>Submit</b>.</p>`,
    returns: ["ingredient"], check: ["ingredient"],
    starter: Q.join, solution: Q.join,
    explain: "A join on ?ingredient: the intersection of two ingredient lists.",
    refs: ["sparql11"],
  },
  {
    id: "SHAR", q: 9, track: "cmp", prereqs: ["JOIN"], title: "How many shared?",
    concept: "Reading results", placeholder: "a number",
    story: `<p>Green and red curry differ mainly in their chillies. What else differs?</p>`,
    task: `<p>How many ingredients do green and red curry share?</p>`,
    live: rowCount("dbpedia", Q.join),
    answers: ["3"],
    explain: "Coconut milk and kaffir lime make sense. The third one is odd.",
  },
  {
    id: "ODDI", q: 9, track: "cmp", kind: "choice", prereqs: ["SHAR"], title: "The odd ingredient",
    concept: "Data quality",
    story: `<p>One of the shared ingredients looks wrong at first sight.</p>`,
    task: `<p>Which shared ingredient is odd, and why?</p>`,
    options: [
      { text: "<code>dbr:Coconut_milk</code>: Thai curries are made with water." },
      { text: "<code>dbr:Kaffir_lime</code>: it's a garnish, not an ingredient." },
      { text: "<code>dbr:Curry</code>: a curry as an ingredient of a curry. It stands for curry paste, linked to the wrong page.", correct: true },
    ],
    explain: "The infobox said “curry paste”, and the extraction linked it to the page about curry, the dish. Data like this makes a curry an ingredient of itself.",
  },
  {
    id: "PNUT", q: 10, track: "cmp", kind: "query", endpoint: "dbpedia", prereqs: ["SHAR"], title: "Peanuts and coconut milk",
    concept: "Joins with fixed objects",
    story: `<p>Peanuts are a common and dangerous allergen, and they appear in some curries. For patients with a peanut allergy, which dishes should raise a flag?</p>`,
    task: `<p><b>Devise a query</b> that lists all dishes in DBpedia that contain both <code>dbr:Peanut</code> and <code>dbr:Coconut_milk</code> as <code>dbo:ingredient</code>.</p>`,
    returns: ["s"], check: ["s"],
    starter: "PREFIX dbo: <http://dbpedia.org/ontology/>\nPREFIX dbr: <http://dbpedia.org/resource/>\nselect ?s\nWHERE {\n  \n}",
    solution: Q.peanut,
    hint: "Two triple patterns with the same subject ?s, each with a fixed object.",
    explain: "Same idea as JOIN, but now the subject is the variable and both objects are fixed.",
  },
  {
    id: "PNTN", q: 11, track: "cmp", prereqs: ["PNUT"], title: "How many dishes?",
    concept: "Reading results", placeholder: "a number",
    story: `<p>Count the dishes your query found.</p>`,
    task: `<p>How many dishes did you find?</p>`,
    live: rowCount("dbpedia", Q.peanut),
    answers: ["6"],
    explain: "Most of them are Southeast Asian dishes, where peanut and coconut milk often go together.",
  },
  {
    id: "MASS", q: 11, track: "cmp", prereqs: ["PNUT"], title: "Which one is a curry?",
    concept: "Reading results", placeholder: "the curry's name",
    story: `<p>Only one of these dishes is a curry. You'll meet it again in the allergy assignment.</p>`,
    task: `<p>Which of the dishes from <a href="#/p/PNUT">PNUT</a> is a curry?</p>`,
    answers: ["Massaman curry"],
    explain: "Massaman curry, a Thai curry made with peanuts. Remember that DBpedia records the peanuts.",
  },
  {
    id: "LABL", q: 12, track: "cmp", prereqs: ["SHAR"], title: "Curry in many languages",
    concept: "Labels and language tags", placeholder: "a number",
    story: `<p>Next, strings and languages. Every resource has labels (<code>rdfs:label</code>), often one per Wikipedia language.</p>`,
    lesson: `<p><b>Run:</b></p>${pre(Q.labels)}<p>${ui("dbpedia", Q.labels, "Run it on DBpedia ↗")}. Each label is a string followed by a language tag, for example <code>"Curry"@en</code>.</p>`,
    task: `<p>How many labels does curry have? (count the @-signs or read the result count)</p>`,
    live: rowCount("dbpedia", Q.labels),
    answers: ["21"],
    explain: "One label per language. In a multilingual health record system, labels like these let you show the same concept in each user's language.",
  },
  {
    id: "DUTC", q: 13, track: "cmp", prereqs: ["LABL"], title: "Curry in Dutch",
    concept: "Language tags", placeholder: "the Dutch label",
    story: `<p>Labels come from Wikipedia page titles, and page titles must be unique.</p>`,
    task: `<p>What is the Dutch (<code>@nl</code>) label? Why does it contain more than just the word “curry”?</p>`,
    live: values("dbpedia", 'select ?label WHERE { <http://dbpedia.org/resource/Curry> <http://www.w3.org/2000/01/rdf-schema#label> ?label FILTER(lang(?label) = "nl") }'),
    answers: ["Curry (gerecht)"],
    explain: "“Curry (gerecht)” is the title of the Dutch Wikipedia page. The addition “gerecht” (dish) tells it apart from curry the spice mix. A label is meant for people; an identifier is meant for machines.",
  },
  {
    id: "GRPC", track: "cmp", kind: "query", endpoint: "dbpedia", prereqs: ["LABL"], title: "Counting curries per country",
    concept: "GROUP BY, COUNT",
    story: `<p>Finally, let's see why we need ontologies.</p>`,
    lesson: `<p>This query takes all curries that have a (raw) country, groups them by country, and counts the curries per group, largest group first. The country column mixes resources and strings, a side effect of how DBpedia is extracted from Wikipedia.</p>`,
    task: `<p><b>Run the query</b> and <b>Submit</b>.</p>`,
    returns: ["n", "country"], check: ["n", "country"],
    starter: Q.byCountry, solution: Q.byCountry,
    explain: "COUNT with GROUP BY: one row per distinct ?country, with the number of curries in it.",
  },
  {
    id: "THAL", q: 14, track: "cmp", prereqs: ["GRPC"], title: "All of Thailand",
    concept: "Why ontologies", placeholder: "a number",
    story: `<p>Thailand appears in the results of <a href="#/p/GRPC">GRPC</a> in several forms.</p>`,
    task: `<p>How many different rows refer to Thailand in some way (as resource, as string, or as a region of Thailand)? How many curries do they cover in total? Enter the number of curries.</p>`,
    live: rowCount("dbpedia", DBP + 'select ?s ?c WHERE { ?s dbo:type dbr:Curry . ?s dbp:country ?c FILTER(CONTAINS(LCASE(STR(?c)), "thai")) }'),
    answers: ["8"],
    explain: "Three rows (dbr:Thailand, \"Thailand\"@en and dbr:Central_Thailand) for one country. An analysis that groups by the raw value splits Thailand into three. Wikidata avoids this, as you'll see.",
  },

  // --------------------------------------------------------- Part 4: Wikidata
  {
    id: "WDID", track: "wd", prereqs: ["THAL"], title: "Curry's identifier",
    concept: "Opaque identifiers", placeholder: "Q…",
    story: `<p>DBpedia's country and ingredient data turned out messy. Let's try another SPARQL endpoint: <a href="https://query.wikidata.org" target="_blank">Wikidata</a>, the structured knowledge base behind Wikipedia. It is more consistent than DBpedia, but also more complex.</p>`,
    lesson: `<p>Wikidata uses meaningless identifiers: items start with Q, properties with P. So first we look them up.</p>`,
    task: `<p><b>Go to <a href="https://www.wikidata.org" target="_blank">wikidata.org</a> and search for “curry”</b>. Pick the dish, not the surname or a person called Curry. What is its identifier? (it's in the URL and after the title)</p>`,
    answers: ["Q164606"],
    explain: "Curry, the dish, is Q164606. An identifier that means nothing doesn't change when the label is corrected or translated.",
    refs: ["wikidata"],
  },
  {
    id: "SUBC", track: "wd", kind: "query", endpoint: "wikidata", prereqs: ["WDID"], title: "Kinds of curry",
    concept: "Label service",
    story: `<p>In Wikidata, most kinds of curry are <i>classes</i>: green curry is a subclass of Thai curry, which is a subclass of curry. On a curry's page, hover over property names to find their IDs:</p>
      <table class="mini"><tr><th>Property</th><th>ID</th></tr><tr><td>subclass of</td><td>P279</td></tr><tr><td>country of origin</td><td>P495</td></tr><tr><td>made from material (ingredient)</td><td>P186</td></tr></table>`,
    lesson: `<p>The <code>SERVICE</code> line adds a label variable for every variable: <code>?curry</code> gives the identifier, <code>?curryLabel</code> its English label. Capitalisation matters. Prefixes such as <code>wd:</code> (items), <code>wdt:</code> (direct properties), <code>wikibase:</code> and <code>bd:</code> are predefined in Wikidata.</p>`,
    task: `<p><b>Run the query</b> and <b>Submit</b>.</p>`,
    returns: ["curry", "curryLabel"], check: ["curry"],
    starter: Q.sub, solution: Q.sub,
    explain: "The direct subclasses of curry: one step down the hierarchy.",
  },
  {
    id: "SUBN", q: 15, track: "wd", prereqs: ["SUBC"], title: "How many kinds?",
    concept: "Reading results", placeholder: "a number",
    story: `<p>Count the direct subclasses.</p>`,
    task: `<p>How many direct subclasses of curry are there?</p>`,
    live: rowCount("wikidata", "SELECT ?curry WHERE { ?curry wdt:P279 wd:Q164606 }"),
    answers: ["30"],
    explain: "These are the first level of the curry hierarchy: Thai curry, Indian curry, Japanese curry and others.",
  },
  {
    id: "DIRC", q: 15, track: "wd", kind: "choice", prereqs: ["SUBC"], title: "Missing favourites",
    concept: "Hierarchy depth",
    story: `<p>Look for two famous curries in the results of <a href="#/p/SUBC">SUBC</a>.</p>`,
    task: `<p>Are green curry and chicken tikka masala among the direct subclasses?</p>`,
    options: [
      { text: "Both are." },
      { text: "Only green curry." },
      { text: "Only chicken tikka masala." },
      { text: "Neither: they sit one level lower, under Thai curry and Indian curry.", correct: true },
    ],
    explain: "Same problem as in DBpedia (GRNI): one step isn't enough. But in Wikidata the hierarchy is explicit, so the query can follow it.",
  },
  {
    id: "STAR", track: "wd", kind: "query", endpoint: "wikidata", prereqs: ["DIRC"], title: "All the way down",
    concept: "Property paths",
    story: `<p>To also get subclasses of subclasses, add an asterisk: <code>wdt:P279*</code> follows the subclass-of relation zero or more steps (recursively).</p>`,
    task: `<p><b>Change <code>wdt:P279</code> into <code>wdt:P279*</code></b>, run again and <b>Submit</b>.</p>`,
    returns: ["curry", "curryLabel"], check: ["curry"],
    starter: Q.sub, solution: Q.subStar,
    explain: "Zero or more steps, so curry itself is in the list too (zero steps).",
    refs: ["sparql11"],
  },
  {
    id: "STRN", q: 16, track: "wd", prereqs: ["STAR"], title: "How many now?",
    concept: "Reading results", placeholder: "a number",
    story: `<p>Count again.</p>`,
    task: `<p>How many results now?</p>`,
    live: rowCount("wikidata", "SELECT ?curry WHERE { ?curry wdt:P279* wd:Q164606 }"),
    answers: ["171"],
    explain: "Many more, including curry itself. This is what an ontology buys you: ask for “curry” and get every kind of curry.",
  },
  {
    id: "PATH", q: 16, track: "wd", prereqs: ["STAR"], title: "Green curry's route",
    concept: "Subclass chains", placeholder: "class name or Q-id",
    story: `<p>Find green curry in the list. It isn't a direct subclass of curry, so it must reach curry through another class.</p>`,
    task: `<p>Through which class does green curry reach curry? (open its Wikidata page if needed)</p>`,
    live: values("wikidata", `SELECT ?sup ?supLabel WHERE { ?g rdfs:label "green curry"@en ; wdt:P279 ?sup . ?sup wdt:P279* wd:Q164606 . ${LABEL} }`),
    answers: ["Thai curry", "Q1144927"],
    explain: "Green curry → Thai curry → curry. Compare DBpedia, where dbo:type pointed at Thai curry but nothing said that Thai curry is a curry.",
  },
  {
    id: "CTMP", q: 16, track: "wd", prereqs: ["STAR"], title: "Tikka masala's route",
    concept: "Subclass chains", placeholder: "class name or Q-id",
    story: `<p>Chicken tikka masala was invented in Britain but is classed with the dishes of another country.</p>`,
    task: `<p>Through which class does chicken tikka masala reach curry?</p>`,
    live: values("wikidata", `SELECT ?sup ?supLabel WHERE { ?g rdfs:label "chicken tikka masala"@en ; wdt:P279 ?sup . ?sup wdt:P279* wd:Q164606 . ${LABEL} }`),
    answers: ["Indian curry", "Q28099834"],
    explain: "Chicken tikka masala → Indian curry → curry. Classification is a modelling choice; DBpedia said “United Kingdom and Indian subcontinent”.",
  },
  {
    id: "CNTR", track: "wd", kind: "query", endpoint: "wikidata", prereqs: ["STRN"], title: "Curries per country",
    concept: "Aggregation over a hierarchy",
    story: `<p>Now count curries per country of origin, over the whole hierarchy.</p>`,
    task: `<p><b>Run the query</b> and <b>Submit</b>.</p>`,
    returns: ["country", "countryLabel", "n"], check: ["country", "n"],
    starter: Q.wdCountry, solution: Q.wdCountry,
    explain: "COUNT(DISTINCT ?curry) so a curry reached along two paths is counted once.",
  },
  {
    id: "TOPC", q: 17, track: "wd", prereqs: ["CNTR"], title: "Most curries",
    concept: "Reading results", placeholder: "a country",
    story: `<p>Which country has the most curries in Wikidata?</p>`,
    task: `<p>Which country of origin has the most curries?</p>`,
    live: topRows("wikidata", `SELECT ?country ?countryLabel (COUNT(DISTINCT ?curry) AS ?n) WHERE { ?curry wdt:P279* wd:Q164606 . ?curry wdt:P495 ?country . ${LABEL} } GROUP BY ?country ?countryLabel`),
    answers: ["India", "Q668"],
    explain: "India, followed by Indonesia, Thailand and Japan when this was checked.",
  },
  {
    id: "DBPW", q: 17, track: "wd", kind: "choice", prereqs: ["CNTR"], title: "What Wikidata avoids",
    concept: "Identifiers vs strings",
    story: `<p>Compare the Wikidata counts with your answer to <a href="#/p/THAL">THAL</a>.</p>`,
    task: `<p>Which problem from DBpedia does Wikidata avoid here?</p>`,
    options: [
      { text: "Countries are items with one identifier each, so Thailand isn't split into a resource, a string and a region.", correct: true },
      { text: "Wikidata has more curries, so the counts are more reliable." },
      { text: "Wikidata leaves out regions, so there are fewer rows." },
      { text: "Wikidata compares labels, so “Thailand” and dbr:Thailand become the same." },
    ],
    explain: "Grouping only works when the same thing always has the same identifier. That is the job of a controlled vocabulary.",
  },
  {
    id: "INGQ", q: 18, track: "wd", kind: "query", endpoint: "wikidata", prereqs: ["CNTR"], title: "Most used ingredients",
    concept: "Adapting a query",
    story: `<p>Which ingredients appear in the most curries?</p>`,
    task: `<p><b>Adapt</b> the query from <a href="#/p/CNTR">CNTR</a> to count the most used ingredients (<code>wdt:P186</code>) across all curries instead of countries. Return every ingredient (no <code>LIMIT</code>).</p>`,
    returns: ["ingredient", "ingredientLabel", "n"], check: ["ingredient", "n"],
    starter: Q.wdCountry, solution: Q.wdIngredient,
    hint: "Replace P495 by P186, and rename ?country to ?ingredient everywhere (also in GROUP BY).",
    explain: "Only the property and the variable names change; the pattern stays the same.",
  },
  {
    id: "TOPI", q: 19, track: "wd", prereqs: ["INGQ"], title: "The top ingredient",
    concept: "Reading results", placeholder: "an ingredient",
    story: `<p>Look at the top of your results.</p>`,
    task: `<p>What is the most used ingredient?</p>`,
    live: topRows("wikidata", `SELECT ?ingredient ?ingredientLabel (COUNT(DISTINCT ?curry) AS ?n) WHERE { ?curry wdt:P279* wd:Q164606 . ?curry wdt:P186 ?ingredient . ${LABEL} } GROUP BY ?ingredient ?ingredientLabel`),
    answers: ["coconut milk"],
    explain: "Coconut milk, when this was checked. Notice what else is high up: some ingredients appear twice.",
  },
  {
    id: "GARL", q: 20, track: "wd", kind: "choice", prereqs: ["INGQ"], title: "Garlic, twice",
    concept: "Food vs organism",
    story: `<p>Two different rows near the top of your ingredient list both mean garlic.</p>`,
    task: `<p>Which two items are they, and why does Wikidata have two?</p>`,
    options: [
      { text: "“garlic” is the food and “Allium sativum” the plant species. Some curries link the food, others the plant.", correct: true },
      { text: "One is a duplicate that should be merged." },
      { text: "One is fresh garlic, the other garlic powder." },
    ],
    explain: "Wikidata separates the organism (a taxon) from the food made from it. Both are correct items, but editors choose differently, so counts get split. Allergy data usually points at the food.",
  },

  // ----------------------------------------------- Part 5: allergy assignment
  {
    id: "FALG", q: 21, track: "alg", kind: "query", endpoint: "wikidata", prereqs: ["TOPI", "GARL"], title: "Food allergies and their causes",
    concept: "Medical knowledge in Wikidata",
    story: `<p>Wikidata also holds medical knowledge. Food allergies are modelled as diseases, with a property that names what causes them. You will combine this with the curry data.</p>
      <ul><li>“food allergy” is <code>wd:Q769815</code>; “has cause” is <code>wdt:P828</code>. Specific allergies (peanut allergy, fish allergy, …) are subclasses of food allergy.</li>
      <li>In the Wikidata query editor, type <code>wdt:</code> and press CTRL+space to search properties by label.</li></ul>`,
    task: `<p>Write a query that lists all food allergies (including subtypes, recursively) together with their cause, with English labels.</p>`,
    returns: ["allergy", "allergyLabel", "cause", "causeLabel"], check: ["allergy", "cause"],
    starter: `SELECT ?allergy ?allergyLabel ?cause ?causeLabel\nWHERE {\n  \n  ${LABEL}\n}`,
    solution: Q.allergies,
    hint: "Two triples: one with a property path to food allergy, one with has cause.",
    explain: "Some allergies have two causes, so there are more rows than allergies.",
  },
  {
    id: "CURA", q: 22, track: "alg", kind: "query", endpoint: "wikidata", prereqs: ["FALG"], title: "Curries that can trigger an allergy",
    concept: "Joining two domains",
    story: `<p>This is the heart of the assignment: connect the dish to the disease through the ingredient.</p>`,
    task: `<p>Expand your query to show which curries contain an ingredient (<code>wdt:P186</code>) that is the cause of a food allergy. Show curry, ingredient and allergy. Use <code>SELECT DISTINCT</code> to avoid duplicate rows.</p>`,
    returns: ["curry", "curryLabel", "ingredientLabel", "allergy", "allergyLabel"], check: ["curry", "allergy"],
    starter: Q.allergies,
    solution: Q.curryAllergy,
    hint: "The join variable is the ingredient: it is the object of P186 and of P828.",
    explain: "Without DISTINCT you get many more rows, because one curry can reach curry, and one allergy can reach food allergy, along several paths.",
  },
  {
    id: "CNTA", q: 23, track: "alg", kind: "query", endpoint: "wikidata", prereqs: ["CURA"], title: "Curries per allergy",
    concept: "GROUP BY on a join",
    story: `<p>For an allergist, the question turns around: for each allergy, how many curries are risky?</p>`,
    task: `<p>Adapt the query to show, for each allergy, the number of different curries that can trigger it, in descending order.</p>`,
    returns: ["allergy", "allergyLabel", "n"], check: ["allergy", "n"],
    starter: Q.curryAllergy,
    solution: Q.perAllergy,
    explain: "COUNT(DISTINCT ?curry) per allergy.",
  },
  {
    id: "TOPA", q: 24, track: "alg", prereqs: ["CNTA"], title: "The riskiest allergy",
    concept: "Reading results", placeholder: "an allergy",
    story: `<p>Look at the top of your results.</p>`,
    task: `<p>Which allergy is triggered by the most curries?</p>`,
    live: topRows("wikidata", Q.perAllergy),
    answers: ["garlic allergy"],
    explain: "Garlic allergy, when this was checked: rare in patients, but garlic is in almost every curry. A count of curries says nothing about how often the allergy occurs.",
  },
  {
    id: "POUL", q: 25, track: "alg", kind: "query", endpoint: "wikidata", prereqs: ["TOPA"], title: "Where is the chicken?",
    concept: "Reasoning over subclasses",
    story: `<p>Chicken is a common curry ingredient and Wikidata has a “poultry allergy”, yet it is missing from your results. Look up “chicken as food” on Wikidata: why does your query miss the link?</p>`,
    task: `<p>Add one triple with a property path, <code>?ingredient wdt:P279* ?cause .</code>, and let the allergy's cause be <code>?cause</code> instead of the ingredient itself. Keep the counts per allergy.</p>`,
    returns: ["allergy", "allergyLabel", "n"], check: ["allergy", "n"],
    starter: Q.perAllergy,
    solution: Q.perAllergyPath,
    explain: "Chicken as food is a subclass of poultry meat, which is the cause of poultry allergy. Matching only the exact item misses it; one property path finds it.",
  },
  {
    id: "POLN", q: 25, track: "alg", prereqs: ["POUL"], title: "Poultry allergy",
    concept: "Reading results", placeholder: "a number",
    story: `<p>Find poultry allergy in your new results.</p>`,
    task: `<p>How many curries now trigger poultry allergy?</p>`,
    live: async () => {
      const r = await runQuery("wikidata", Q.perAllergyPath);
      return r.rows.filter((row) => /poultry/i.test(row.allergyLabel && row.allergyLabel.value)).map((row) => row.n.value);
    },
    answers: ["7"],
    explain: "From zero to several curries by one reasoning step. Look further down too: generic “food allergy” (cause: food) now matches nearly every curry.",
  },
  {
    id: "MSWD", q: 25, track: "alg", kind: "choice", multi: true, prereqs: ["POUL"], title: "Massaman's peanuts",
    concept: "Open-world assumption",
    story: `<p>In DBpedia, massaman curry lists peanuts (<a href="#/p/MASS">MASS</a>). ${ui("wikidata", `SELECT ?ingredient ?ingredientLabel WHERE { wd:Q301587 wdt:P186 ?ingredient . ${LABEL} }`, "Check its ingredients in Wikidata ↗")}.</p>`,
    task: `<p>Does Wikidata record the peanuts? What does this mean if someone wanted to use such data for allergy warnings? Select all that are true.</p>`,
    options: [
      { text: "Wikidata does not list peanut as an ingredient of massaman curry.", correct: true, why: "When this was checked, it listed only meat." },
      { text: "So according to Wikidata, massaman curry is safe for people with a peanut allergy.", why: "No: missing data is not a “no”." },
      { text: "Linked data follows the open-world assumption: a missing triple means “unknown”, not “false”.", correct: true },
      { text: "Allergy warnings built on this data would silently miss real risks; they need curated sources and provenance.", correct: true },
    ],
    explain: "In a clinical decision support system, silence is dangerous: an empty result looks like “safe”. Before such data can support decisions it needs curation, provenance and a way to say “not known”.",
  },
  {
    id: "CDSS", track: "alg", kind: "choice", prereqs: ["POLN", "MSWD"], title: "How far should reasoning go?",
    concept: "Alert fatigue",
    story: `<p>With the property path, the generic “food allergy” (cause: food) matches nearly every curry, and “vegetable allergy” matches dozens. Imagine these results drive an alert in a hospital meal-ordering system.</p>`,
    task: `<p>Which design gives the most useful alerts?</p>`,
    options: [
      { text: "Alert on every curry for every patient with any recorded food allergy." },
      { text: "Follow subclass links from ingredient to allergen, but only match the patient's specific allergen, and flag dishes whose ingredients are unknown.", correct: true },
      { text: "Drop subclass reasoning and match only exact ingredients." },
    ],
    explain: "Too little reasoning misses chicken → poultry (POUL). Too much fires on everything and teaches users to click alerts away (alert fatigue). Good clinical decision support reasons as far as the clinical question needs, and is honest about unknowns (MSWD).",
    refs: ["ancker"],
  },
];
