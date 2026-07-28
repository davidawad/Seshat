# Anki Deck Options (FSRS) and FSRS Algorithm Documentation

**Citation:** Anki Manual — "Deck Options" (Desired Retention / FSRS section), ankitects/Anki project. https://docs.ankiweb.net/deck-options.html — and — open-spaced-repetition contributors, "The Algorithm" and "The Optimal Retention," fsrs4anki Wiki, https://github.com/open-spaced-repetition/fsrs4anki/wiki.

**Link:** https://docs.ankiweb.net/deck-options.html ; https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-Algorithm ; https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-optimal-retention

## Summary

These are the current, canonical documentation sources for FSRS (Free Spaced Repetition Scheduler), the algorithm underlying Seshat's scheduling engine. The Anki manual describes "desired retention" as the single most important FSRS setting — the target probability of successful recall at the moment a card is due — and explicitly recommends keeping it below 97% (default 90%) because workload rises very quickly above 90% and can become overwhelming near 97–100%. The FSRS wiki's "Algorithm" and "Optimal Retention" pages describe the underlying difficulty/stability/retrievability model (FSRS-6, 21 parameters) and note that 80–95% is a reasonable target range, with 90% working well for most users and empirically observed workload-minimizing values often landing near 85%.

**Effect size:** Not applicable (documentation, not an empirical study); stated recommendation is desired retention in the 80–95% range, with 90% as the common/default target
