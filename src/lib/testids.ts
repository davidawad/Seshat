/**
 * Stable `data-testid` selectors: the single source of truth.
 *
 * Convention: kebab-case, `<area>-<thing>`, where `<area>` is the page or
 * feature the element lives on (home, sets, set, edit, study, flashcard,
 * test, games, match, blast, blocks, stats, footer, nav, modal, ...) and
 * `<thing>` is what it is or does (`study-continue`, `flashcard-know`).
 *
 * Rules:
 *  - Never rename an id once published (agents and tests depend on it).
 *    Add a new one instead.
 *  - Use these constants in components (`data-testid={TESTIDS.studyContinue}`),
 *    never string literals, so a typo cannot silently desync UI and tests.
 *  - A page's root region is `<page>-page`. Repeated items (cards, rows,
 *    tiles) share one id; scope them with the surrounding region or the
 *    accessible name.
 *  - Prefer role + accessible name where it is unambiguous; testids are for
 *    when several controls share a name or a region has no role.
 *
 * Ids that pre-date this file (settings, backup, nav presets) keep their
 * original values and are listed under "Existing" so docs stay complete.
 */
export const TESTIDS = {
  // Layout, nav, footer
  layoutMain: 'layout-main',
  layoutSaveError: 'layout-save-error',
  layoutSaveErrorSettings: 'layout-save-error-settings',
  navHome: 'nav-home',
  navSets: 'nav-sets',
  navStats: 'nav-stats',
  footerAbout: 'footer-about',
  footerAgents: 'footer-agents',
  footerDocs: 'footer-docs',
  footerAttributions: 'footer-attributions',
  footerLicense: 'footer-license',
  shortcutsOpen: 'shortcuts-open',
  settingsOpen: 'settings-open',

  // Modals
  settingsModal: 'settings-modal',
  shortcutsModal: 'shortcuts-modal',
  flashcardOptionsModal: 'flashcard-options-modal',
  modalClose: 'modal-close',
  settingsModalClose: 'settings-modal-close',
  shortcutsModalClose: 'shortcuts-modal-close',
  flashcardOptionsModalClose: 'flashcard-options-modal-close',
  shortcutsPresetGroup: 'shortcuts-preset-group',

  // Home
  homePage: 'home-page',
  homeSetCard: 'home-set-card',
  homeSetLink: 'home-set-link',
  homeStudyLink: 'home-study-link',
  homeStarterLoad: 'home-starter-load',
  homeManageSets: 'home-manage-sets',
  homeNewSet: 'home-new-set',
  homeViewToggle: 'home-view-toggle',
  homeViewGrid: 'home-view-grid',
  homeViewTable: 'home-view-table',
  homeSetTable: 'home-set-table',
  homeSetRow: 'home-set-row',

  // Sets list
  setsPage: 'sets-page',
  setsSearch: 'sets-search',
  setsList: 'sets-list',
  setsListItem: 'sets-list-item',
  setsEditLink: 'sets-edit-link',
  setsStarterLoad: 'sets-starter-load',
  setsNewButton: 'sets-new-button',
  importSetButton: 'import-set-button',

  // Create a set (/sets/new)
  createPage: 'create-page',
  createBack: 'create-back',
  createTitle: 'create-title',
  createTitleError: 'create-title-error',
  createDescription: 'create-description',
  createTags: 'create-tags',
  createCardList: 'create-card-list',
  createCardRow: 'create-card-row',
  createTerm: 'create-term',
  createDefinition: 'create-definition',
  createDeleteCard: 'create-delete-card',
  createAddCard: 'create-add-card',
  createSubmit: 'create-submit',
  createSubmitPractice: 'create-submit-practice',
  createDraftStatus: 'create-draft-status',
  createProblems: 'create-problems',

  // Import a set (/sets/import)
  importPage: 'import-page',
  importBack: 'import-back',
  importDropzone: 'import-dropzone',
  importFile: 'import-file',
  importFileName: 'import-file-name',
  importPasteName: 'import-paste-name',
  importPasteText: 'import-paste-text',
  importPreview: 'import-preview',
  importError: 'import-error',
  importPasteSubmit: 'import-paste-submit',

  // Set detail (hub)
  setPage: 'set-page',
  setEditLink: 'set-edit-link',
  setExport: 'set-export',
  setModeStudy: 'set-mode-study',
  setModeFlashcards: 'set-mode-flashcards',
  setModeTest: 'set-mode-test',
  setModeGames: 'set-mode-games',
  setPreviewFlip: 'set-preview-flip',
  setTermList: 'set-term-list',

  // Set edit
  editPage: 'edit-page',
  editName: 'edit-name',
  editTags: 'edit-tags',
  editDescription: 'edit-description',
  editGoalDate: 'edit-goal-date',
  editCardList: 'edit-card-list',
  editAddTerm: 'edit-add-term',
  editAddDefinition: 'edit-add-definition',
  editAddOtherKind: 'edit-add-other-kind',
  editCardEdit: 'edit-card-edit',
  editCardDelete: 'edit-card-delete',
  editDeleteSet: 'edit-delete-set',

  // Study
  studyPage: 'study-page',
  studyProgress: 'study-progress',
  studyAnswerInput: 'study-answer-input',
  studyShowOptions: 'study-show-options',
  studyMcqOptions: 'study-mcq-options',
  studyContinue: 'study-continue',
  studyConfidenceGuessed: 'study-confidence-guessed',
  studyConfidenceUnsure: 'study-confidence-unsure',
  studyConfidenceSure: 'study-confidence-sure',
  studyResult: 'study-result',
  studySelfExplanation: 'study-self-explanation',
  studyGradeAgain: 'study-grade-again',
  studyGradeHard: 'study-grade-hard',
  studyGradeGood: 'study-grade-good',
  studyGradeEasy: 'study-grade-easy',
  studySummary: 'study-summary',
  studyEmpty: 'study-empty',

  // Flashcards
  flashcardsPage: 'flashcards-page',
  flashcardFace: 'flashcard-face',
  flashcardKnow: 'flashcard-know',
  flashcardStillLearning: 'flashcard-still-learning',
  flashcardUndo: 'flashcard-undo',
  flashcardShuffle: 'flashcard-shuffle',
  flashcardOptions: 'flashcard-options',
  flashcardProgress: 'flashcard-progress',
  flashcardTally: 'flashcard-tally',
  flashcardTallyKnow: 'flashcard-tally-know',
  flashcardTallyLearning: 'flashcard-tally-learning',
  flashcardGradeBadge: 'flashcard-grade-badge',
  flashcardsAnnouncer: 'flashcards-announcer',
  flashcardTrackProgress: 'flashcard-track-progress',
  flashcardFront: 'flashcard-front',
  flashcardRestart: 'flashcard-restart',
  flashcardComplete: 'flashcard-complete',
  flashcardRestudyUnknown: 'flashcard-restudy-unknown',
  flashcardRestartFull: 'flashcard-restart-full',
  flashcardUndoLast: 'flashcard-undo-last',

  // Test mode
  testPage: 'test-page',
  testForm: 'test-form',
  testQuestion: 'test-question',
  testAnswerInput: 'test-answer-input',
  testSubmit: 'test-submit',
  testScore: 'test-score',
  testRetryMissed: 'test-retry-missed',
  testImageNote: 'test-image-note',
  testNoTextCards: 'test-no-text-cards',

  // Games
  gamesPage: 'games-page',
  gamesImageNote: 'games-image-note',
  gamesOpenMatch: 'games-open-match',
  gamesOpenBlast: 'games-open-blast',
  gamesOpenBlocks: 'games-open-blocks',
  gamePage: 'game-page',
  matchTile: 'match-tile',
  matchFeedback: 'match-feedback',
  matchPlayAgain: 'match-play-again',
  blastOption: 'blast-option',
  blastFeedback: 'blast-feedback',
  blastPlayAgain: 'blast-play-again',
  blocksOption: 'blocks-option',
  blocksColumn: 'blocks-column',
  blocksFeedback: 'blocks-feedback',
  blocksPlayAgain: 'blocks-play-again',

  // Stats, docs, about, attributions, license
  statsPage: 'stats-page',
  statsSummary: 'stats-summary',
  statsCalibrationTable: 'stats-calibration-table',
  statsCalibrationEmpty: 'stats-calibration-empty',
  docsPage: 'docs-page',
  aboutPage: 'about-page',
  attributionsPage: 'attributions-page',
  licensePage: 'license-page',

  // Existing (pre-date this file; values unchanged)
  themeField: 'theme-field',
  paletteField: 'palette-field',
  paletteReset: 'palette-reset',
  accentColor: 'accent-color',
  accentHex: 'accent-hex',
  accentStatus: 'accent-status',
  backupDownload: 'backup-download',
  backupModeMerge: 'backup-mode-merge',
  backupModeReplace: 'backup-mode-replace',
  backupFile: 'backup-file',
  backupConfirm: 'backup-confirm',
  backupConfirmReplace: 'backup-confirm-replace',
  backupConfirmCancel: 'backup-confirm-cancel',
  backupStatus: 'backup-status',
} as const

/** Existing dynamic id: `nav-preset-arrows`, `nav-preset-wasd`, `nav-preset-hjkl`. */
export const navPresetTestId = (preset: string): string => `nav-preset-${preset}`
