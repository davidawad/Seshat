# Research

This folder is the primary-source backing for Seshat's product decisions: recall-first study (short-answer/cloze over passive review), FSRS-based spaced scheduling with a 90%-default desired-retention target, confidence calibration, the card-type mix, and the typography/legibility system (typeface choices, body size, line height, measure). Every claim made in the in-app [`/docs`](../src/pages/Docs.tsx) page and every citation rendered on the in-app [`/attributions`](../src/pages/Attributions.tsx) page traces back to a file here — see [`src/features/attributions/citations.ts`](../src/features/attributions/citations.ts) for the machine-readable mirror of this same data.

Each file contains: a full citation, a verified link where one could be confirmed (a small number of paywalled/blocked sources are honestly marked "No verified open-access link found" or note that the summary was reconstructed from search snippets rather than a direct fetch — never fabricated), and a 2-4 sentence summary of the finding as it applies to Seshat specifically. A few entries in the original source bibliography had incorrect authors or publication years; where that happened, the file is named after the *verified* citation and the correction is noted inline.

## Learning science

Evidence for retrieval practice, spacing, generation, multimedia design, and metacognition — the basis for Seshat's study engine.

| File | Description |
| --- | --- |
| [`dunlosky-2013.md`](learning-science/dunlosky-2013.md) | Foundational review rating practice testing and distributed practice "high utility" vs. low-utility techniques like rereading and highlighting. |
| [`donoghue-hattie-2021.md`](learning-science/donoghue-hattie-2021.md) | Meta-analysis quantifying Dunlosky et al.'s ten techniques: distributed practice d=0.85, practice testing d=0.74, elaborative interrogation d=0.56. |
| [`cepeda-2006.md`](learning-science/cepeda-2006.md) | Canonical spacing-effect synthesis (317 experiments): the optimal inter-study gap grows as the desired retention interval grows. |
| [`cepeda-2008.md`](learning-science/cepeda-2008.md) | The spacing "temporal ridgeline": optimal gap is ~20-40% of a 1-week retention delay, ~5-10% of a 1-year delay — no single magic interval. |
| [`rowland-2014.md`](learning-science/rowland-2014.md) | Testing-effect meta-analysis: testing beats restudy (d≈0.50), and recall-based tests beat recognition-based (MCQ) tests. |
| [`adesope-2017.md`](learning-science/adesope-2017.md) | Broad practice-testing meta-analysis (272 effect sizes) with moderator breakdowns by test format, feedback, and retention interval. |
| [`latimier-2021.md`](learning-science/latimier-2021.md) | Spaced retrieval practice beats massed retrieval practice (g=0.74); expanding-interval schedules are not automatically better than uniform ones. |
| [`brunmair-richter-2019.md`](learning-science/brunmair-richter-2019.md) | Interleaving meta-analysis (g=0.42 overall): strong for visual/perceptual material, weak/negative for word-list vocabulary learning. |
| [`bertsch-2007.md`](learning-science/bertsch-2007.md) | The generation effect meta-analysis (d≈0.40, 86 studies): producing an answer beats reading it. |
| [`schindler-richter-2023.md`](learning-science/schindler-richter-2023.md) | Text-generation meta-analysis (g=0.41): generating to-be-learned content improves learning over passive reading. Corrects a misattributed author list in the original source bibliography (originally listed as "Kasper et al. 2020"). |
| [`cromley-chen-2025.md`](learning-science/cromley-chen-2025.md) | Meta-analysis of Mayer's multimedia-learning principles (g=0.37 overall); largest effects for removing seductive detail and the modality principle. Year corrected from 2021 to the verified 2025 publication. |
| [`noetel-2022.md`](learning-science/noetel-2022.md) | Meta-meta-analysis of 29 reviews on multimedia design principles (signaling, contiguity, coherence, segmentation). |
| [`bjork-bjork-2011.md`](learning-science/bjork-bjork-2011.md) | The foundational "desirable difficulties" framework: in-session performance is an unreliable proxy for durable learning. |
| [`de-boer-2018.md`](learning-science/de-boer-2018.md) | Metacognitive-strategy-instruction meta-analysis: g=0.50 immediately, g=0.63 at long-term follow-up. Year corrected from 2014 to the verified 2018 publication. |
| [`janssen-lazonder-2024.md`](learning-science/janssen-lazonder-2024.md) | Confidence/monitoring-accuracy intervention meta-analysis (g=0.25): calibration prompts should be paired with substantive feedback. Author list and year corrected. |
| [`settles-meeder-2016.md`](learning-science/settles-meeder-2016.md) | Duolingo's half-life regression paper — the direct intellectual predecessor of FSRS-style trainable spaced-repetition scheduling. |
| [`anki-manual-fsrs.md`](learning-science/anki-manual-fsrs.md) | Anki manual + FSRS docs: recommends 80-95% desired retention, 90% as the common default — why Seshat defaults `desiredRetention` to 0.9. |
| [`smith-karpicke-recall-vs-recognition.md`](learning-science/smith-karpicke-recall-vs-recognition.md) | Short-answer only beats MCQ once retrieval success is high enough — the target is "difficult but successful retrieval," justifying Seshat's hint/difficulty-adjustment behavior. |

## Legibility & accessibility

Evidence for Seshat's typography system: typeface options, body size, line height, and measure.

| File | Description |
| --- | --- |
| [`wallace-2022.md`](legibility/wallace-2022.md) | Large crowdsourced study: reading speed varies 35% between a reader's fastest and slowest font; no single font wins for everyone. |
| [`wallace-2020.md`](legibility/wallace-2020.md) | Readers' preferred font is rarely their fastest-reading font; up to 117 WPM difference between a person's best and worst typeface. |
| [`kadner-2021.md`](legibility/kadner-2021.md) | AdaptiFont: a generative, Bayesian-optimized font model that personalizes typeface per reader and measurably improves reading speed. |
| [`arditi-cho-2005.md`](legibility/arditi-cho-2005.md) | Serif size has only a negligible legibility effect; letter spacing matters more than serifs per se. |
| [`dobres-2016.md`](legibility/dobres-2016.md) | Humanist typefaces (open letterforms) are more glance-legible than square grotesque ones, especially for older readers and at small sizes. |
| [`reimer-2014.md`](legibility/reimer-2014.md) | Automotive-UI study: humanist typeface reduced glance time, response time, and errors vs. a geometric/grotesque typeface. |
| [`vecino-2022.md`](legibility/vecino-2022.md) | No significant reading-speed/comprehension difference between serif and sans-serif on a web usability study; women preferred serif. |
| [`minakata-2023.md`](legibility/minakata-2023.md) | For low-vision readers, low stroke contrast (not just sans-serif) was the more decisive legibility variable — relevant to Atkinson Hyperlegible's design. |
| [`kaspar-2015.md`](legibility/kaspar-2015.md) | Sans-serif reads faster, but serif text was rated more favorably — reading speed and perceived quality trade off. |
| [`beymer-2008.md`](legibility/beymer-2008.md) | Eye-tracking study: smaller font sizes slow fixation durations more than serif-vs-sans-serif does. |
| [`text-accessibility-standards-2025.md`](legibility/text-accessibility-standards-2025.md) | Review finding a gap between known typographic accessibility best practice and what font-selection tools actually support — motivates Seshat's explicit typography controls. |
| [`font-matters-review-2024.md`](legibility/font-matters-review-2024.md) | Serif fonts improved visual-attention task performance but font type didn't affect working-memory accuracy — typeface affects scanning, not necessarily recall. |
| [`w3c-text-spacing.md`](legibility/w3c-text-spacing.md) | WCAG 2.1 SC 1.4.12: minimum line height 1.5x, paragraph spacing 2x, letter spacing 0.12x, word spacing 0.16x font size. |
| [`section-508-typography.md`](legibility/section-508-typography.md) | U.S. Section 508 guidance: sans-serif for body text, 11-12pt+ minimum for adjustable digital content, 4.5:1 contrast, 200% resize support. |

### Seshat's synthesized typography defaults

David's own synthesis of the above, which the typography/legibility track implements in-app (see `src/features/settings` and `src/styles`):

- **Atkinson Hyperlegible** for maximum character distinction (low-vision-oriented, uniform stroke contrast).
- **Verdana** for general-purpose screen reading.
- **Inter** for a modern UI/web-app feel.
- **Georgia** or **Source Serif 4** for long-form reading.
- **Century Schoolbook**, **Charter**, or **Source Serif 4** for printed legal documents.
- Body text **11.5-13pt**, line spacing **~1.4-1.5**, measure **55-75 characters per line**.
- Font choice varies materially by reader — there is no universal winner. This isn't a hedge; it's the empirical finding of Wallace et al. (2022, 2020) and AdaptiFont (Kadner et al. 2021) specifically: individual differences in optimal typeface dominate any population-level "best font" effect. That's why Seshat exposes typeface as a first-class user setting instead of hard-coding one.
