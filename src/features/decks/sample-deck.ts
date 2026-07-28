import type { ExportedDeck } from '../../types'

/**
 * The starter deck offered on the empty deck list. Meta and on-brand: it
 * teaches real, citable facts about spaced repetition and retrieval
 * practice using the app itself. Full citations live on the Attributions
 * page — the `sourceRef` fields here are short pointers, not full cites.
 */
export const SAMPLE_DECK: ExportedDeck = {
  seshatExportVersion: 1,
  name: 'How Spaced Repetition Actually Works',
  description:
    'A short, evidence-based tour of why spaced repetition and retrieval practice work — learn Seshat by using it.',
  tags: ['learning-science', 'meta'],
  cards: [
    {
      prompt: 'What is the spacing effect?',
      content: {
        kind: 'short-answer',
        answer:
          'Distributing study or practice sessions over time produces better long-term retention than massing them together (cramming).',
        acceptableAnswers: ['distributed practice beats massed practice'],
      },
      explanation: 'This is the core mechanism spaced-repetition schedulers like FSRS are built to exploit.',
      sourceRef: 'Cepeda et al., 2006, Psychological Bulletin meta-analysis',
      tags: ['spacing'],
    },
    {
      prompt:
        'Of all commonly studied learning techniques, which has the largest average effect size in meta-analysis?',
      content: {
        kind: 'short-answer',
        answer: 'Distributed practice (spacing)',
        acceptableAnswers: ['spacing', 'spaced practice'],
      },
      explanation:
        'Reported effect size is large, around d≈0.85 — bigger than highlighting, rereading, or summarizing.',
      sourceRef: 'Donoghue & Hattie, 2021 meta-analysis of ten learning techniques',
      tags: ['spacing', 'effect-size'],
    },
    {
      prompt: 'Retrieval practice fill-in-the-blank',
      content: {
        kind: 'cloze',
        text: 'Retrieval practice works because {{effortful recall}} strengthens memory more than passive review.',
      },
      explanation: null,
      sourceRef: null,
      tags: ['retrieval-practice'],
    },
    {
      prompt: 'What does FSRS (Free Spaced Repetition Scheduler) optimize for?',
      content: {
        kind: 'mcq',
        options: [
          'Maximizing the number of cards reviewed per day',
          "Predicting each card's personal forgetting curve to schedule reviews near a target retention",
          'Grouping cards by topic for blocked practice',
          'Randomizing review order to prevent pattern memorization',
        ],
        correctIndex: 1,
      },
      explanation:
        'FSRS fits a memory-stability model per card/user from your review history, then times reviews to hit a target recall probability.',
      sourceRef: null,
      tags: ['fsrs'],
    },
    {
      prompt: 'What is "desirable difficulty" in learning?',
      content: {
        kind: 'short-answer',
        answer:
          "A level of challenge during learning that's hard enough to require effort — which boosts long-term retention — but not so hard it causes failure and disengagement.",
        acceptableAnswers: [],
      },
      explanation: null,
      sourceRef: 'Bjork & Bjork, 1992',
      tags: ['desirable-difficulty'],
    },
    {
      prompt: 'Stability fill-in-the-blank',
      content: {
        kind: 'cloze',
        text: 'In the FSRS model, {{stability}} represents how long a memory is expected to last before recall probability decays to a given threshold.',
      },
      explanation: null,
      sourceRef: null,
      tags: ['fsrs'],
    },
    {
      prompt: 'What is the "testing effect" (retrieval practice effect)?',
      content: {
        kind: 'short-answer',
        answer:
          'Actively retrieving information from memory (e.g. self-testing, flashcards) produces better long-term retention than passively re-reading or re-studying the same material.',
        acceptableAnswers: ['retrieval practice effect'],
      },
      explanation:
        'Reported effect size is moderate, around d≈0.50 — smaller than spacing, but still one of the highest-utility techniques studied.',
      sourceRef: 'Rowland, 2014, Psychological Bulletin meta-analysis',
      tags: ['testing-effect', 'retrieval-practice'],
    },
    {
      prompt: 'Which of these is a popular study technique rated LOW-utility in the evidence, despite widespread use?',
      content: {
        kind: 'mcq',
        options: [
          'Highlighting or underlining text',
          'Practice testing',
          'Distributed practice',
          'Interleaved practice',
        ],
        correctIndex: 0,
      },
      explanation:
        'Highlighting shows little to no benefit over normal reading in most studies — it feels productive but does little on its own.',
      sourceRef: 'Dunlosky et al., 2013',
      tags: ['effect-size'],
    },
    {
      prompt: 'What is interleaving, as a study technique?',
      content: {
        kind: 'short-answer',
        answer:
          'Mixing different topics or problem types within a single study session, instead of blocking practice by topic — it improves discrimination between concepts and long-term transfer.',
        acceptableAnswers: ['mixed practice'],
      },
      explanation: null,
      sourceRef: null,
      tags: ['interleaving'],
    },
    {
      prompt: 'Retrievability fill-in-the-blank',
      content: {
        kind: 'cloze',
        text: "A card's {{retrievability}} is the scheduler's real-time estimate of the probability you could successfully recall it right now, and it decays continuously between reviews.",
      },
      explanation: null,
      sourceRef: null,
      tags: ['fsrs'],
    },
  ],
}
