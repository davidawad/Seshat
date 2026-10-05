import type { ExportedCard, ExportedSet } from '../../types'

const short = (
  prompt: string,
  answer: string,
  sourceRef: string,
  acceptable: readonly string[] = [],
): ExportedCard => ({
  prompt,
  promptImage: null,
  content: { kind: 'short-answer', answer, acceptableAnswers: [...acceptable], answerImage: null },
  explanation: null,
  sourceRef,
  tags: [],
})

/**
 * The first-run "Try a 10-card sample" deck: neutral general knowledge that suits any
 * learner, so nobody has to care about a niche subject to try the app. Every fact carries
 * a short source pointer. It mixes the three everyday card kinds so the first session
 * shows typing, a multiple-choice question and a fill-in-the-blank.
 */
export const TRY_SAMPLE_SET: ExportedSet = {
  seshatExportVersion: 1,
  name: 'Try Seshat: 10 general cards',
  description: 'Ten quick facts to try typing, rating yourself and spaced review. Delete the set any time.',
  tags: ['sample'],
  cards: [
    short('What is the capital of Australia?', 'Canberra', 'Australian Government, australia.gov.au'),
    short('Which chemical element has the symbol Au?', 'Gold', 'IUPAC periodic table of the elements', [
      'gold (aurum)',
    ]),
    short('Which planet is the largest in the Solar System?', 'Jupiter', 'NASA Solar System Exploration'),
    {
      prompt: 'Which planet is closest to the Sun?',
      promptImage: null,
      content: { kind: 'mcq', options: ['Venus', 'Mercury', 'Mars', 'Earth'], correctIndex: 1 },
      explanation: null,
      sourceRef: 'NASA Solar System Exploration',
      tags: [],
    },
    {
      prompt: 'Cell energy fill-in-the-blank',
      promptImage: null,
      content: { kind: 'cloze', text: 'The {{mitochondrion}} produces most of a cell’s ATP.' },
      explanation: null,
      sourceRef: 'Alberts et al., Molecular Biology of the Cell, 6th ed.',
      tags: [],
    },
    short(
      'How fast does light travel in a vacuum?',
      '299,792,458 metres per second',
      'BIPM, The International System of Units (SI Brochure), 9th ed.',
      ['about 300,000 km/s', '299792458 m/s'],
    ),
    short(
      'Who published On the Origin of Species, and in what year?',
      'Charles Darwin, 1859',
      'Darwin, On the Origin of Species, John Murray, 1859',
    ),
    short(
      'At sea-level pressure, at what temperature in degrees Celsius does water boil?',
      '100 °C',
      'NIST Chemistry WebBook, water (phase change data)',
      ['100', '100 degrees'],
    ),
    {
      prompt: 'Skeleton fill-in-the-blank',
      promptImage: null,
      content: { kind: 'cloze', text: 'An adult human skeleton has {{206}} bones.' },
      explanation: null,
      sourceRef: 'Gray, Gray’s Anatomy, 42nd ed.',
      tags: [],
    },
    short('In which year did the Berlin Wall fall?', '1989', 'German Federal Archives (Bundesarchiv)'),
  ],
}
