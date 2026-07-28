# W3C WCAG 2.1 — Understanding Success Criterion 1.4.12: Text Spacing

**Citation:** W3C Web Accessibility Initiative (WAI). Understanding Success Criterion 1.4.12: Text Spacing (WCAG 2.1, Level AA).

**Link:** https://www.w3.org/WAI/WCAG21/Understanding/text-spacing

## Summary

WCAG 2.1 SC 1.4.12 requires that content remain functional and lose no information when a user applies, simultaneously, all of the following spacing overrides: line height (line spacing) of at least 1.5 times the font size; spacing following paragraphs of at least 2 times the font size; letter spacing (tracking) of at least 0.12 times the font size; and word spacing of at least 0.16 times the font size. The criterion applies to markup-based technologies (HTML/CSS) and excludes PDFs/images of text, with an exception for scripts/languages where a given spacing property doesn't apply (e.g., paragraph spacing in Japanese). For Seshat, whose default line height is 1.4-1.5, this means the app sits at or just below the WCAG minimum of 1.5x — worth setting the default (or at least the maximum user-adjustable value) to 1.5 or higher, and worth confirming that letter/word spacing and paragraph spacing can be increased by the user without breaking card layout, to fully satisfy this criterion.
