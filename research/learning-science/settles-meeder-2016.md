# A Trainable Spaced Repetition Model for Language Learning

**Citation:** Settles, B., & Meeder, B. (2016). A Trainable Spaced Repetition Model for Language Learning. In *Proceedings of the 54th Annual Meeting of the Association for Computational Linguistics* (Volume 1: Long Papers), pp. 1848–1858. Association for Computational Linguistics.

**Link:** https://aclanthology.org/P16-1174/

## Summary

This is the primary source for half-life regression (HLR), a trainable model that estimates the "half-life" of a specific word/fact in an individual learner's memory by combining psycholinguistic theory (a Wozniak/Ebbinghaus-style exponential forgetting curve) with machine-learned features, fit on ~13 million Duolingo learning traces. HLR outperformed both a simple exponential-decay baseline and logistic regression at predicting recall probability, and improved measured Duolingo student engagement by 12% in a live A/B test — establishing that recall-probability models trained on individual review histories beat fixed-interval heuristics. This is the direct intellectual predecessor of FSRS-style scheduling and supports Seshat's choice to use a trainable, per-card stability/difficulty model rather than a fixed SM-2-style interval table.

**Effect size:** Not quantified in source bibliography (reports predictive accuracy gains and a 12% engagement lift in a live operational A/B test, not a Cohen's d/Hedges' g effect size)
