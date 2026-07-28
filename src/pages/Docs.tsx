import { Link } from 'react-router-dom'

export const DocsPage = () => (
  <section aria-labelledby="docs-heading">
    <h1 id="docs-heading">Docs</h1>

    <section aria-labelledby="docs-origin-heading">
      <h2 id="docs-origin-heading">Why Seshat exists</h2>
      <p>
        I made my own flashcards in Quizlet — the actual studying material, the actual work — and then Quizlet put my
        own flashcards behind a paywall. That&rsquo;s the whole origin story. So I built Seshat: free, open source, and
        grounded in the cognitive-science literature on how people actually learn, instead of streaks, hearts, and other
        engagement-optimized gamification bolted onto a study tool. It&rsquo;s named after Seshat, the ancient Egyptian
        goddess of writing, libraries, record-keeping, and architecture — the patron of exactly the kind of durable,
        well-organized knowledge this app is trying to help you build.
      </p>
    </section>

    <section aria-labelledby="docs-evidence-heading">
      <h2 id="docs-evidence-heading">Why it&rsquo;s evidence-based</h2>
      <p>
        Seshat is <strong>recall-first</strong>: short-answer and cloze cards ask you to produce an answer, not just
        recognize one, because generating an answer yourself produces more durable memory than reading or recognizing it
        does. Scheduling runs on <strong>FSRS</strong> (Free Spaced Repetition Scheduler), which fits a
        difficulty/stability model per card and per learner instead of applying one fixed interval table to everyone,
        and defaults to a 90% desired-retention target — enough spacing to actually forget a little between reviews
        (that&rsquo;s where the learning happens) without making the workload unbearable. After you answer, Seshat also
        asks how confident you were, and tracks whether that confidence was justified — a{' '}
        <strong>confidence calibration</strong> check against the well-documented gap between feeling like you know
        something and actually knowing it.
      </p>
      <p>
        None of this is asserted from vibes. Every one of these design decisions is backed by a citation, a summary of
        the finding, and — wherever one exists — a verified link to the source. See{' '}
        <Link to="/attributions">Attributions</Link> for the full bibliography, or the <code>research/</code> folder in
        the repository for the underlying write-ups.
      </p>
    </section>

    <section aria-labelledby="docs-storage-heading">
      <h2 id="docs-storage-heading">How your data is stored</h2>
      <p>
        Seshat has no account, no backend, no database, no tracking. Everything — your decks, your cards, your review
        history, your settings — lives in your browser&rsquo;s <code>localStorage</code>. Nothing is sent to a server,
        because there is no server.
      </p>
      <p>
        We initially said &ldquo;stores everything in cookies&rdquo; — but cookies cap out around 4KB and get
        transmitted on every single request, which is exactly wrong for this use case. <code>localStorage</code> is the
        actual correct browser-native primitive for local-only app data, so that&rsquo;s what we use — same &ldquo;stays
        on your machine, no server involved&rdquo; guarantee, just the storage mechanism that&rsquo;s actually built for
        it.
      </p>
      <p>
        Practically, this means: your data is yours, it never leaves your device, and it&rsquo;s only as durable as that
        browser profile — export your decks periodically if you care about them surviving a cleared cache.
      </p>
      <p>
        Image-occlusion cards store a downscaled, compressed copy of the image directly in that same{' '}
        <code>localStorage</code> blob, so a deck with heavy image use will run into the browser&rsquo;s storage ceiling
        faster than a text-only deck will.
      </p>
    </section>

    <section aria-labelledby="docs-license-heading">
      <h2 id="docs-license-heading">Open source</h2>
      <p>
        Seshat is free and open source software, licensed under the{' '}
        <a href="/LICENSE" target="_blank" rel="noopener noreferrer">
          MIT License
        </a>
        . Use it, fork it, self-host it, read every line of it — there&rsquo;s nothing hidden and nothing to pay for.
      </p>
    </section>
  </section>
)
