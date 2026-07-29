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
        Seshat has no account, no backend, no database, no tracking. Everything — your sets, your cards, your review
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
        browser profile — export your sets periodically if you care about them surviving a cleared cache.
      </p>
      <p>
        Image-occlusion cards store a downscaled, compressed copy of the image directly in that same{' '}
        <code>localStorage</code> blob, so a set with heavy image use will run into the browser&rsquo;s storage ceiling
        faster than a text-only set will.
      </p>
    </section>

    <section aria-labelledby="docs-schema-heading">
      <h2 id="docs-schema-heading">The set JSON format — and how to upload one that works</h2>
      <p>
        On the <Link to="/sets">Sets</Link> page, the upload icon in the header opens a file picker that accepts
        either of two JSON shapes below. It tries Seshat&rsquo;s own format first, then falls back to the simple
        term/definition format — you don&rsquo;t have to tell it which one you&rsquo;re giving it.
      </p>

      <h3>The simple format (Quizlet-style term/definition pairs)</h3>
      <p>
        The easiest thing that works: a JSON array of <code>{'{term, definition}'}</code> objects. Every entry
        imports as a short-answer card (prompt = term, answer = definition).
      </p>
      <pre>
        <code>{`[
  { "term": "Mitochondria", "definition": "The powerhouse of the cell" },
  { "term": "Ribosome", "definition": "Synthesizes proteins" }
]`}</code>
      </pre>
      <p>
        To give the set a name on import instead of being prompted for one, wrap it — <code>name</code> or{' '}
        <code>title</code> both work:
      </p>
      <pre>
        <code>{`{
  "name": "Cell Biology",
  "terms": [
    { "term": "Mitochondria", "definition": "The powerhouse of the cell" }
  ]
}`}</code>
      </pre>
      <p>
        Each entry also accepts <code>question</code>/<code>answer</code> or <code>front</code>/<code>back</code> in
        place of <code>term</code>/<code>definition</code>, so files from other tools usually import unmodified.
      </p>

      <h3>The full Seshat format (round-trips every card kind)</h3>
      <p>
        The simple format only knows about term/definition pairs. Seshat&rsquo;s own export format additionally
        preserves cloze deletions, multiple-choice options, explanations, source citations, and tags. Every card
        has a <code>content</code> object discriminated by <code>kind</code>: <code>short-answer</code>,{' '}
        <code>cloze</code>, <code>mcq</code>, or <code>image-occlusion</code>.
      </p>
      <pre>
        <code>{`{
  "seshatExportVersion": 1,
  "name": "Cell Biology",
  "description": "Intro cell biology vocabulary",
  "tags": ["biology"],
  "cards": [
    {
      "prompt": "What is the powerhouse of the cell?",
      "content": { "kind": "short-answer", "answer": "Mitochondria", "acceptableAnswers": [] },
      "explanation": null,
      "sourceRef": null,
      "tags": []
    },
    {
      "prompt": "Fill in the blank",
      "content": { "kind": "cloze", "text": "The {{mitochondria}} is the powerhouse of the cell." },
      "explanation": null,
      "sourceRef": null,
      "tags": []
    },
    {
      "prompt": "Which organelle synthesizes proteins?",
      "content": {
        "kind": "mcq",
        "options": ["Ribosome", "Golgi apparatus", "Lysosome"],
        "correctIndex": 0
      },
      "explanation": "Ribosomes translate mRNA into protein chains.",
      "sourceRef": null,
      "tags": []
    }
  ]
}`}</code>
      </pre>
      <p>
        <code>image-occlusion</code> cards additionally carry <code>imageDataUrl</code> (a <code>data:</code> URL —
        keep it small, see the storage note above) and <code>occlusions</code>, an array of labeled regions
        expressed as percentages of the image&rsquo;s own dimensions:{' '}
        <code>{'{ id, xPct, yPct, widthPct, heightPct, label }'}</code>.
      </p>
      <p>
        Every field is validated with <a href="https://zod.dev">Zod</a> at the import boundary — a file that
        doesn&rsquo;t match either shape gets a specific error message telling you what&rsquo;s wrong, not a silent
        failure or a corrupted set. The schemas themselves are the source of truth in the repository, at{' '}
        <code>src/types.ts</code> (<code>exportedSetSchema</code>) and <code>src/features/sets/simple-json.ts</code>.
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
