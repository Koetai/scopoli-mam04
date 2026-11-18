# Scopoli · MAM04

A [Koetai](https://koetai.github.io/) product. The SPARQL practical of the master's course
*Practical Reasoning with Health Data* (MAM04), rebuilt in the style of
[Rosalind](https://rosalind.info) as a tree of small problems:
**SPARQL with food data — curry edition**.

Students query live curry data in DBpedia and Wikidata, meet the mess of crowd-sourced
data, see why ontologies matter, and finish by reasoning about which curries can trigger
a food allergy, the kind of inference a clinical decision support system makes.

Live at <https://koetai.github.io/scopoli-mam04/>. For Canvas, use the single-file build below.

## Parts

1. **One curry in DBpedia**: triples, resources and literals (quiz Q1–3)
2. **All curries**: variables, prefixes, literals and language tags (Q4–8)
3. **Comparing curries**: joins, labels, GROUP BY and COUNT (Q9–14)
4. **The curry ontology**: classes, properties and individuals in WebProtégé; OWL as
   triples, queried in the browser with [Comunica](https://comunica.dev); doing a reasoner's
   work in SPARQL; the open-world assumption (Protégé quiz P1–6)
5. **Wikidata**: identifiers, the label service, property paths (Q15–20)
6. **Allergy assignment**: curries × food allergies, open-world reasoning, alert fatigue (Q21–25)

Each problem shows its question number in the SPARQL quiz (Q) or the Protégé quiz (P). *My answers* collects everything a
student typed, so they can copy it into the course quiz.

## How checking works

- **Query problems**: the student's query and a reference query run live on the same
  endpoint; the checked columns must hold the same values.
- **Answer problems**: the expected answer is computed from the live data when the student
  submits, so answers keep up as DBpedia and Wikidata change. If an endpoint is down, the
  answer recorded on 15 November 2026 is used instead.
- **Quiz problems**: multiple choice with an explanation per option.

Because the course quiz is graded, students can't reveal answers before solving a problem.
Set `COURSE.giveUp = true` in `course.js` to allow it.

## The curry ontology

`curry.ttl` is a small OWL ontology modelled on the Manchester pizza ontology: nine named
curries as classes with `hasBase` and `hasMainIngredient` restrictions, an ingredient
hierarchy, countries as the only individuals, and defined classes (`NutCurry`,
`GlutenCurry`, `VegetarianCurry`, …) for a reasoner to fill. After editing it, run

```bash
python3 prepare/build_ontology.py   # checks it, writes curry.owl and ontology.js
```

`ontology.js` embeds the text so Comunica can query it without fetching anything.
Comunica does no OWL reasoning; the problems use that on purpose.

## Run locally

```bash
python3 -m http.server 8000
```

Open <http://localhost:8000>. No build step; content lives in `course.js`, the engine in `app.js`.

## Use in Canvas

Build one self-contained file and upload it to the course **Files**:

```bash
python3 prepare/build_single.py   # writes dist/scopoli-mam04.html
```

It has the styles, the CodeMirror editor and all course content inlined, so it doesn't
depend on neighbouring files (Canvas breaks relative links). It still needs internet access
to query DBpedia and Wikidata; the ontology problems work offline. Link it from a module or page. Progress is kept in the
student's browser.
