# Review of Text Accessibility Standards and Font Tool Limitations

**Citation:** Somai, M. S., Peiris, R. L., & Tigwell, G. W. (2025). A Review of Text Accessibility Standards, Guidelines, and Font Tool Limitations. In Proceedings of the 27th International ACM SIGACCESS Conference on Computers and Accessibility (ASSETS '25).

**Link:** https://dl.acm.org/doi/10.1145/3663547.3759692

## Summary

The authors (Rochester Institute of Technology, School of Information) summarized 24 actionable typographic accessibility guidelines drawn from 10 academic and industry sources and evaluated how well seven widely-used font libraries support them, finding a significant gap between known best practice and actual tool implementation — most font-selection tools give little or no accessibility guidance despite WCAG's own silence on typographic variables like font style, size, and letterform beyond spacing/contrast/scalability. Reported best-practice findings include that sans-serif fonts tend to outperform serif fonts on reading speed and error rate, and that larger x-height, width, and letter spacing improve legibility, especially at small sizes. This validates Seshat's approach of building explicit, user-facing typography controls (typeface choice, size, line height, measure) rather than relying on a font library's defaults, since the paper's core finding is that such defaults are not accessibility-vetted.

**Note:** WebFetch on the ACM DL page returned HTTP 403 (paywalled/blocked). Author names, venue, and abstract/findings above were obtained via web search results (search snippets citing the ACM listing and corroborating secondary sources), not a direct fetch of the ACM page itself.
