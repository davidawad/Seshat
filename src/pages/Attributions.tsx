import { CITATIONS } from '../features/attributions/citations'
import type { Citation, CitationCategory } from '../features/attributions/citations'

const CATEGORY_LABELS: Record<CitationCategory, string> = {
  'learning-science': 'Learning science',
  legibility: 'Legibility & accessibility',
  'prior-art': 'Prior art / inspiration',
}

const CATEGORY_ORDER: readonly CitationCategory[] = ['learning-science', 'legibility', 'prior-art']

const formatYear = (year: Citation['year']): string => (typeof year === 'number' ? String(year) : year)

export const AttributionsPage = () => (
  <section aria-labelledby="attributions-heading">
    <h1 id="attributions-heading">Attributions</h1>
    <p>
      Seshat&rsquo;s study engine, scheduling defaults, and typography system are built on the research below, plus one
      piece of prior art that directly shaped its philosophy. Full write-ups (citation, verified link, and a summary of
      the finding as it applies to Seshat) live in the <code>research/</code> folder of the repository.
    </p>

    {CATEGORY_ORDER.map((category) => {
      const entries = CITATIONS.filter((citation) => citation.category === category)
      const headingId = `attributions-${category}-heading`

      return (
        <section key={category} aria-labelledby={headingId}>
          <h2 id={headingId}>{CATEGORY_LABELS[category]}</h2>
          <ul className="citation-list">
            {entries.map((citation, index) => {
              const titleId = `${headingId}-${index}-title`
              return (
                <li key={citation.title}>
                  <article aria-labelledby={titleId}>
                    <h3 id={titleId}>{citation.title}</h3>
                    <dl>
                      <div>
                        <dt>Authors</dt>
                        <dd>{citation.authors}</dd>
                      </div>
                      <div>
                        <dt>Year</dt>
                        <dd>{formatYear(citation.year)}</dd>
                      </div>
                      <div>
                        <dt>Summary</dt>
                        <dd>{citation.summary}</dd>
                      </div>
                      {citation.link !== null && (
                        <div>
                          <dt>Link</dt>
                          <dd>
                            <a href={citation.link} target="_blank" rel="noopener noreferrer">
                              {citation.link}
                            </a>
                          </dd>
                        </div>
                      )}
                    </dl>
                  </article>
                </li>
              )
            })}
          </ul>
        </section>
      )
    })}
  </section>
)
