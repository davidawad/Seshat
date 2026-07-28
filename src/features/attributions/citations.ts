/**
 * Hand-maintained citation data backing the /attributions page.
 *
 * Every entry here mirrors a file in `research/learning-science/` or
 * `research/legibility/` (or, for prior art, is verified directly against
 * the linked project) — see `research/README.md` for the full index and
 * longer-form summaries. This file is deliberately simple and hand-written:
 * no markdown-parsing build step, just a typed constant.
 */

export type CitationCategory = 'learning-science' | 'legibility' | 'prior-art'

export interface Citation {
  readonly category: CitationCategory
  readonly title: string
  readonly authors: string
  readonly year: number | string
  readonly summary: string
  readonly link: string | null
}

export const CITATIONS: readonly Citation[] = [
  // ---------------------------------------------------------------------
  // Learning science
  // ---------------------------------------------------------------------
  {
    category: 'learning-science',
    title:
      "Improving Students' Learning With Effective Learning Techniques: Promising Directions from Cognitive and Educational Psychology",
    authors: 'Dunlosky, J., Rawson, K. A., Marsh, E. J., Nathan, M. J., & Willingham, D. T.',
    year: 2013,
    summary:
      'Foundational review rating practice testing and distributed practice "high utility," and rereading, highlighting, and summarization "low utility" — the basis for pairing FSRS-based spacing with active-recall card formats instead of passive review.',
    link: 'https://doi.org/10.1177/1529100612453266',
  },
  {
    category: 'learning-science',
    title: 'A Meta-Analysis of Ten Learning Techniques',
    authors: 'Donoghue, G. M., & Hattie, J. A. C.',
    year: 2021,
    summary:
      "Quantifies Dunlosky et al.'s ten techniques across 242 studies: distributed practice (d=0.85) and practice testing (d=0.74) are the most effective, directly supporting Seshat's pairing of FSRS scheduling with active-recall card types.",
    link: 'https://doi.org/10.3389/feduc.2021.581216',
  },
  {
    category: 'learning-science',
    title: 'Distributed Practice in Verbal Recall Tasks: A Review and Quantitative Synthesis',
    authors: 'Cepeda, N. J., Pashler, H., Vul, E., Wixted, J. T., & Rohrer, D.',
    year: 2006,
    summary:
      'Canonical spacing-effect meta-analysis (317 experiments): the inter-study interval that maximizes retention grows as the desired retention interval grows, justifying expanding-interval scheduling over fixed or shrinking cadences.',
    link: 'https://escholarship.org/content/qt3rr6q10c/qt3rr6q10c.pdf',
  },
  {
    category: 'learning-science',
    title: 'Spacing Effects in Learning: A Temporal Ridgeline of Optimal Retention',
    authors: 'Cepeda, N. J., Vul, E., Rohrer, D., Wixted, J. T., & Pashler, H.',
    year: 2008,
    summary:
      'The optimal gap between study sessions is not a fixed number: it runs ~20-40% of the eventual retention delay for a 1-week test, shrinking to ~5-10% for a 1-year test. Supports per-card FSRS scheduling over any single static interval-growth ratio.',
    link: 'https://doi.org/10.1111/j.1467-9280.2008.02209.x',
  },
  {
    category: 'learning-science',
    title: 'The Effect of Testing Versus Restudy on Retention: A Meta-Analytic Review of the Testing Effect',
    authors: 'Rowland, C. A.',
    year: 2014,
    summary:
      "Testing beats restudy overall (d≈0.50), and recall-based tests beat recognition-based tests (multiple-choice) by a wide margin — the core justification for Seshat's recall-first short-answer/cloze card types over passive review.",
    link: 'https://doi.org/10.1037/a0037559',
  },
  {
    category: 'learning-science',
    title: 'Rethinking the Use of Tests: A Meta-Analysis of Practice Testing',
    authors: 'Adesope, O. O., Trevisan, D. A., & Sundararajan, N.',
    year: 2017,
    summary:
      'Broad practice-testing synthesis (272 effect sizes) showing test format, feedback presence, and retention interval all moderate the testing effect — supporting post-answer feedback and spaced (not same-day) review in Seshat.',
    link: 'https://doi.org/10.3102/0034654316689306',
  },
  {
    category: 'learning-science',
    title: 'A Meta-Analytic Review of the Benefit of Spacing out Retrieval Practice Episodes on Retention',
    authors: 'Latimier, A., Peyre, H., & Ramus, F.',
    year: 2021,
    summary:
      'Spaced retrieval practice beats massed retrieval practice (g=0.74); expanding-interval schedules show no reliable advantage over well-calibrated uniform ones overall — a caution against assuming ever-expanding intervals are automatically superior.',
    link: 'https://doi.org/10.1007/s10648-020-09572-8',
  },
  {
    category: 'learning-science',
    title: 'Similarity Matters: A Meta-Analysis of Interleaved Learning and Its Moderators',
    authors: 'Brunmair, M., & Richter, T.',
    year: 2019,
    summary:
      'Interleaving helps overall (g=0.42) but is strongly moderated by material type: large benefit for visual/perceptual discrimination, small for math, ambiguous for expository text, and reversed (blocking wins) for word-list vocabulary — interleaving should not be applied uniformly.',
    link: 'https://doi.org/10.1037/bul0000209',
  },
  {
    category: 'learning-science',
    title: 'The Generation Effect: A Meta-Analytic Review',
    authors: 'Bertsch, S., Pesta, B. J., Wiscott, R., & McDaniel, M. A.',
    year: 2007,
    summary:
      'Producing an answer yourself beats passively reading it (d≈0.40 across 86 studies) — the core justification for recall-oriented card types (short-answer, cloze) over recognition-only formats like MCQ.',
    link: 'https://doi.org/10.3758/BF03193441',
  },
  {
    category: 'learning-science',
    title: 'Text Generation Benefits Learning: A Meta-Analytic Review',
    authors: 'Schindler, J., & Richter, T.',
    year: 2023,
    summary:
      'Generating to-be-learned text content improves learning over passive reading (g=0.41), robust across narrative and expository text. Directly relevant to cloze/short-answer cards, which require active production rather than recognition.',
    link: 'https://doi.org/10.1007/s10648-023-09758-w',
  },
  {
    category: 'learning-science',
    title: "A Meta-Analysis of Richard Mayer's Multimedia Learning Research",
    authors: 'Cromley, J. G., & Chen, R.',
    year: 2025,
    summary:
      'Meta-analysis of 591 effect sizes from multimedia-learning research: largest effects for removing seductive detail, the modality principle, personalization, and coherence — informing which card-authoring choices Seshat should encourage.',
    link: 'https://doi.org/10.1016/j.edurev.2025.100730',
  },
  {
    category: 'learning-science',
    title: 'Multimedia Design for Learning: An Overview of Reviews With Meta-Meta-Analysis',
    authors:
      'Noetel, M., Griffith, S., Delaney, O., Harris, N. R., Sanders, T., Parker, P., del Pozo Cruz, B., & Lonsdale, C.',
    year: 2022,
    summary:
      'Meta-meta-analysis of 29 reviews finding robust evidence for signaling, contiguity, coherence, and segmentation design principles in multimedia instructional content.',
    link: 'https://doi.org/10.3102/00346543211052329',
  },
  {
    category: 'learning-science',
    title: 'Making Things Hard on Yourself, but in a Good Way: Creating Desirable Difficulties to Enhance Learning',
    authors: 'Bjork, E. L., & Bjork, R. A.',
    year: 2011,
    summary:
      'The foundational "desirable difficulties" framework: spacing, interleaving, and retrieval practice slow performance during initial learning but improve durable retention, while performance that looks good in the moment (massed practice) often underperforms later — the theoretical basis for scheduling by a forgetting-curve model rather than in-session ease.',
    link: 'https://bjorklab.psych.ucla.edu/wp-content/uploads/sites/13/2016/04/EBjork_RBjork_2011.pdf',
  },
  {
    category: 'learning-science',
    title: 'Long-Term Effects of Metacognitive Strategy Instruction on Student Academic Performance: A Meta-Analysis',
    authors: 'de Boer, H., Donker, A. S., Kostons, D. D. N. M., & van der Werf, G. P. C.',
    year: 2018,
    summary:
      'Metacognitive strategy instruction improves academic performance (g=0.50 immediately, g=0.63 at long-term follow-up) — supports explicit metacognitive scaffolding rather than treating confidence-rating as an isolated bolt-on.',
    link: 'https://doi.org/10.1016/j.edurev.2018.03.002',
  },
  {
    category: 'learning-science',
    title: 'Meta-analysis of Interventions for Monitoring Accuracy in Problem Solving',
    authors: 'Janssen, N., & Lazonder, A. W.',
    year: 2024,
    summary:
      "Confidence/monitoring-accuracy interventions produce a small, reliable improvement (g=0.25) — most effective when paired with substantive feedback, informing how Seshat's confidence-calibration prompts should be surfaced.",
    link: 'https://doi.org/10.1007/s10648-024-09936-4',
  },
  {
    category: 'learning-science',
    title: 'A Trainable Spaced Repetition Model for Language Learning',
    authors: 'Settles, B., & Meeder, B.',
    year: 2016,
    summary:
      "Duolingo's half-life regression paper: a trainable, per-learner recall-probability model beats fixed-interval heuristics and improved live engagement 12% in an A/B test — the direct intellectual predecessor of FSRS-style scheduling used by Seshat.",
    link: 'https://aclanthology.org/P16-1174/',
  },
  {
    category: 'learning-science',
    title: 'Anki Manual (Deck Options) & FSRS Algorithm Documentation',
    authors: 'Anki / open-spaced-repetition contributors',
    year: 'n.d.',
    summary:
      "The current canonical implementation reference for FSRS desired-retention scheduling: recommends 80-95% target retention, with 90% as the common default — why Seshat's default `desiredRetention` is 0.9 and its presets are 0.85/0.90/0.93.",
    link: 'https://docs.ankiweb.net/deck-options.html',
  },
  {
    category: 'learning-science',
    title: 'Retrieval Practice with Short-Answer, Multiple-Choice, and Hybrid Tests',
    authors: 'Smith, M. A., & Karpicke, J. D.',
    year: 2014,
    summary:
      'No reliable short-answer-over-multiple-choice advantage when short-answer retrieval success was too low; the advantage appeared once success improved. The design target is "difficult but successful retrieval," not maximum difficulty — why Seshat supports hints and difficulty adjustment.',
    link: 'https://learninglab.psych.purdue.edu/downloads/2014/2014_Smith_Karpicke_Memory.pdf',
  },

  // ---------------------------------------------------------------------
  // Legibility & accessibility
  // ---------------------------------------------------------------------
  {
    category: 'legibility',
    title: 'Towards Individuated Reading Experiences: Different Fonts Increase Reading Speed for Different Individuals',
    authors:
      'Wallace, S., Bylinskii, Z., Dobres, J., Kerr, B., Berlow, S., Treitman, R., Kumawat, N., Arpin, K., Miller, D. B., Huang, J., & Sawyer, B. D.',
    year: 2022,
    summary:
      'Reading speed varies 35% between a reader\'s fastest and slowest font with no comprehension loss, and optimal font differs by individual — "one font does not fit all." Directly supports offering multiple typeface choices rather than one default.',
    link: 'https://dl.acm.org/doi/full/10.1145/3502222',
  },
  {
    category: 'legibility',
    title: 'Accelerating Adult Readers with Typeface: A Study of Individual Preferences and Effectiveness',
    authors: 'Wallace, S., Treitman, R., Huang, J., Sawyer, B. D., & Bylinskii, Z.',
    year: 2020,
    summary:
      "A reader's preferred typeface is seldom their best-performing one; reading speed varied by ~117 WPM between each participant's worst and best font — user-selectable typeface should not be assumed to match stated preference to actual effectiveness.",
    link: 'https://dl.acm.org/doi/pdf/10.1145/3334480.3382985',
  },
  {
    category: 'legibility',
    title: "AdaptiFont: Increasing Individuals' Reading Speed with a Generative Font Model and Bayesian Optimization",
    authors: 'Kadner, F., Keller, Y., & Rothkopf, C. A.',
    year: 2021,
    summary:
      'A generative, Bayesian-optimized font-personalization system measurably improves individual reading speed, and optimized fonts differ significantly across readers — corroborates that per-user typeface choice has a real, individualized effect.',
    link: 'https://arxiv.org/abs/2104.10741',
  },
  {
    category: 'legibility',
    title: 'Serifs and Font Legibility',
    authors: 'Arditi, A., & Cho, J.',
    year: 2005,
    summary:
      'Serif size produces only a negligible legibility effect; inter-letter spacing has a much larger effect than serif presence itself — the serif/sans-serif distinction is not a strong legibility driver on its own.',
    link: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4612630/',
  },
  {
    category: 'legibility',
    title:
      'Utilising Psychophysical Techniques to Investigate the Effects of Age, Type Design, Size and Display Polarities on Glance Legibility',
    authors: 'Dobres, J., Chahine, N., Reimer, B., Gould, D., Mehler, B., & Coughlin, J. F.',
    year: 2016,
    summary:
      'Humanist typefaces (open letterforms) are more glance-legible than square grotesque ones, especially for older readers and at small sizes; dark-text-on-light background substantially outperforms the inverse polarity.',
    link: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5213401/',
  },
  {
    category: 'legibility',
    title: 'Assessing the Impact of Typeface Design in a Text-Rich Automotive User Interface',
    authors:
      'Reimer, B., Mehler, B., Dobres, J., Coughlin, J. F., Matteson, S., Gould, D., Chahine, N., & Levantovsky, V.',
    year: 2014,
    summary:
      'A humanist typeface reduced glance time, response time, and error rate versus a geometric/grotesque typeface in a driving-simulator UI study — open letterforms and spacing reduce visual processing demand.',
    link: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4267594/',
  },
  {
    category: 'legibility',
    title: 'How Does Serif vs. Sans Serif Typeface Impact the Usability of E-Commerce Websites?',
    authors: 'Vecino, S., Mehtali, J., de Andrés, J., Gonzalez-Rodriguez, M., & Fernandez-Lanvin, D.',
    year: 2022,
    summary:
      'No significant difference in comprehension, completion time, or reading speed between serif and sans-serif on a web usability study; women showed a significant preference for serif — supports leaving typeface as user preference rather than a fixed "optimal" default.',
    link: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC9680897/',
  },
  {
    category: 'legibility',
    title: 'The Effect of Serifs and Stroke Contrast on Low-Vision Reading',
    authors: 'Minakata, K., Eckmann-Hansen, C., Larsen, M., Bek, T., & Beier, S.',
    year: 2023,
    summary:
      "For low-vision readers, low stroke contrast (uniform stroke width) — not the presence or absence of serifs — was the more decisive legibility variable, relevant to Atkinson Hyperlegible's uniform-stroke design.",
    link: 'https://pubmed.ncbi.nlm.nih.gov/36563495/',
  },
  {
    category: 'legibility',
    title: 'The Effect of Serifs on the Evaluation of Scientific Abstracts',
    authors: 'Kaspar, K., Wehlitz, T., von Knobelsdorff, S., Wulf, T., & von Saldern, M. A. O.',
    year: 2015,
    summary:
      'Sans-serif fonts read faster, but serif fonts were rated more favorably on every dimension — reading speed and perceived quality trade off, supporting typeface as a user-selectable preference rather than one "optimal" font.',
    link: 'https://pubmed.ncbi.nlm.nih.gov/25704872/',
  },
  {
    category: 'legibility',
    title: 'An Eye Tracking Study of How Font Size and Type Influence Online Reading',
    authors: 'Beymer, D., Russell, D. M., & Orton, P. Z.',
    year: 2008,
    summary:
      'Smaller font sizes produced significantly longer fixation durations than larger sizes; serif vs. sans-serif made no significant difference to reading speed — font size is a stronger lever than typeface family.',
    link: 'https://dl.acm.org/doi/10.5555/1531826.1531831',
  },
  {
    category: 'legibility',
    title: 'A Review of Text Accessibility Standards, Guidelines, and Font Tool Limitations',
    authors: 'Somai, M. S., Peiris, R. L., & Tigwell, G. W.',
    year: 2025,
    summary:
      'Reviewing 24 typographic accessibility guidelines against 7 widely-used font tools found most give little or no accessibility guidance — motivates Seshat exposing explicit typeface, size, line-height, and measure controls rather than relying on defaults.',
    link: 'https://dl.acm.org/doi/10.1145/3663547.3759692',
  },
  {
    category: 'legibility',
    title: 'Font Matters: Deciphering the Impact of Font Types on Attention and Reading',
    authors: 'Gadhvi, M. A., Baranwal, A., Chalakapure, A., & Dixit, A.',
    year: 2024,
    summary:
      'Serif fonts improved performance on a visual-attention (letter-cancellation) task, but font type had no significant effect on working-memory accuracy — typeface likely affects scanning/proofreading more than memory encoding during study itself.',
    link: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11156575/',
  },
  {
    category: 'legibility',
    title: 'Understanding Success Criterion 1.4.12: Text Spacing (WCAG 2.1)',
    authors: 'W3C Web Accessibility Initiative (WAI)',
    year: 2018,
    summary:
      "WCAG 2.1 AA requires content to remain functional at line height ≥1.5x font size, paragraph spacing ≥2x, letter spacing ≥0.12x, and word spacing ≥0.16x — the floor Seshat's adjustable line-height range (1.4-1.5) targets.",
    link: 'https://www.w3.org/WAI/WCAG21/Understanding/text-spacing',
  },
  {
    category: 'legibility',
    title: 'Fonts & Typography (Section 508 accessibility development guidance)',
    authors: 'U.S. General Services Administration — Section508.gov',
    year: 'n.d.',
    summary:
      "Recommends sans-serif for body text, 11-12pt+ for adjustable digital content, 4.5:1 contrast, and support for 200% text resize — Seshat's 11.5-13pt body range and sans-serif defaults (Atkinson Hyperlegible, Verdana, Inter) sit within this guidance.",
    link: 'https://www.section508.gov/develop/fonts-typography/',
  },

  // ---------------------------------------------------------------------
  // Prior art / inspiration
  // ---------------------------------------------------------------------
  {
    category: 'prior-art',
    title: 'Mentat',
    authors: 'cprass',
    year: 'n.d.',
    summary:
      'An early-stage open-source spaced-repetition tool written in Go, using FSRS scheduling and plain-text Markdown storage, with a terminal-first TUI and experimental automatic Git syncing. Mentat directly inspired Seshat\'s open, inspectable, local-first, "your data is yours" philosophy — Seshat differs by being a browser SPA rather than terminal-first, and by adding a typography/legibility system grounded in research, but the no-lock-in, user-owns-their-data ethos is shared.',
    link: 'https://github.com/cprass/mentat',
  },
] as const
