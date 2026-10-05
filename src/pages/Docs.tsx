import { Link } from 'react-router-dom'
import { TESTIDS } from '../lib/testids'

export const DocsPage = () => (
  <section aria-labelledby="docs-heading" data-testid={TESTIDS.docsPage}>
    <h1 id="docs-heading">Docs</h1>
    <p>
      Using an AI agent? Read the <a href={`${import.meta.env.BASE_URL}agents.txt`}>agent guide (agents.txt)</a> for URL
      import, the console API, WebMCP tools, the backup format and the JSON Schemas.
    </p>

    <section aria-labelledby="docs-agents-heading">
      <h2 id="docs-agents-heading">For AI agents and scripts</h2>
      <p>
        Everything below runs in your browser; there is no server. Details and examples are in the{' '}
        <a href={`${import.meta.env.BASE_URL}agents.txt`}>agent guide</a>.
      </p>
      <ul>
        <li>
          <strong>URL import:</strong> add <code>?import=</code> with URL-encoded set JSON to any page.
        </li>
        <li>
          <strong>Console API:</strong> <code>window.seshat</code> offers <code>listSets</code>, <code>listCards</code>,{' '}
          <code>exportSet</code>, <code>importSet</code>, <code>exportAll</code> and{' '}
          <code>importAll(json, &apos;merge&apos; | &apos;replace&apos;)</code>; an open tab updates live.
        </li>
        <li>
          <strong>WebMCP:</strong> where the browser supports it, tools such as <code>list_sets</code>,{' '}
          <code>import_set</code>, <code>export_all</code> and <code>update_settings</code> are registered on{' '}
          <code>document.modelContext</code>.
        </li>
        <li>
          <strong>Backup:</strong> Settings &rarr; Backup downloads and restores one file holding settings, keyboard
          remaps, sets, cards and review history. Merge only adds what is missing; Replace overwrites everything.
        </li>
        <li>
          <strong>Command menu:</strong> press <kbd>Ctrl</kbd>/<kbd>Cmd</kbd>+<kbd>K</kbd> anywhere to search and jump
          to a page, a set, its Study, Learn or Flashcards view, or an action like Settings or Toggle theme.
        </li>
        <li>
          <strong>Schemas:</strong> <a href={`${import.meta.env.BASE_URL}schema/set-import.schema.json`}>set import</a>,{' '}
          <a href={`${import.meta.env.BASE_URL}schema/seshat-backup.schema.json`}>backup</a> and{' '}
          <a href={`${import.meta.env.BASE_URL}schema/seshat-settings.schema.json`}>settings</a> (JSON Schema).
        </li>
      </ul>
    </section>

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
        (that&rsquo;s where the learning happens) without making the workload unbearable. After you answer, Seshat shows
        whether you were right and the correct answer, then moves on. Two optional steps are off by default and can be
        switched on in Settings: a <strong>confidence prompt</strong>, which asks how sure you were before the reveal
        and feeds a calibration check on the Stats page against the well-documented gap between feeling like you know
        something and actually knowing it; and a <strong>self-rating</strong> (Again / Hard / Good / Easy). With
        self-rating off, a correct answer counts as Good and a wrong one as Again.
      </p>
      <p>
        <strong>Learn</strong> (a button on each set page, next to Flashcards and Test) is a gentler on-ramp for terms
        you do not know yet. It works in rounds of about six cards. Each card is first asked as multiple choice, with
        wrong options drawn from the same set; get it right and it moves on to typing the answer from memory; type it
        correctly and the card counts as mastered. A miss drops the card back a step, shows the correct answer, and
        brings it up again a couple of questions later. Every round ends with where each card stands (mastered, learning
        or not started), and the session ends with a summary. Typed answers, and misses, are logged and scheduled by
        FSRS exactly like Study reviews, so Stats and the set&rsquo;s progress include them, and the confidence and
        self-rating settings apply to typed answers. The design rests on the testing effect (Rowland, 2014) and
        successive relearning (Rawson &amp; Dunlosky, 2011); see Attributions.
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
        Images are the exception: <code>localStorage</code> is too small for them (about 5MB for the whole app), so each
        image is downscaled and re-encoded in your browser and kept in IndexedDB instead, still entirely on your device.
        Your sets and cards only hold a small reference to it. Settings has a Storage section showing how much room
        images use and a button to remove images nothing uses any more, and full backups include the images.
      </p>
    </section>

    <section aria-labelledby="docs-schema-heading">
      <h2 id="docs-schema-heading">The set JSON format — and how to upload one that works</h2>
      <p>
        The <Link to="/sets/import">Import</Link> page (reached from the empty Home, or Import on the Sets page) takes
        Quizlet-style text first: paste it, or upload a <code>.csv</code>, <code>.tsv</code> or <code>.txt</code> file
        with one term and definition per line, split by a tab (or a comma if the line has no tab). Quoted CSV cells and
        a <code>term,definition</code> header row are handled, and the set name is suggested from the file name. The
        same file box also accepts <code>.json</code>, in either of two shapes below. For JSON it tries Seshat&rsquo;s
        own format first, then falls back to the simple term/definition format — you don&rsquo;t have to tell it which
        one you&rsquo;re giving it.
      </p>

      <h3>The simple format (Quizlet-style term/definition pairs)</h3>
      <p>
        The easiest thing that works: a JSON array of <code>{'{term, definition}'}</code> objects. Every entry imports
        as a short-answer card (prompt = term, answer = definition).
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
        preserves cloze deletions, multiple-choice options, explanations, source citations, and tags. Every card has a{' '}
        <code>content</code> object discriminated by <code>kind</code>: <code>short-answer</code>, <code>cloze</code>,{' '}
        <code>mcq</code>, or <code>image-occlusion</code>.
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
        <code>image-occlusion</code> cards additionally carry <code>image</code> (a reference to an image stored in the
        browser, with its bytes in the file&rsquo;s optional <code>media</code> map) or, in older files,{' '}
        <code>imageDataUrl</code> (a <code>data:</code> URL, which is converted on import), and <code>occlusions</code>,
        an array of labeled regions expressed as percentages of the image&rsquo;s own dimensions:{' '}
        <code>{'{ id, xPct, yPct, widthPct, heightPct, label }'}</code>. A labeled diagram is one such card per label:
        each carries all the regions plus <code>askedRegionId</code> (the region it asks about) and{' '}
        <code>diagramId</code> (shared by the diagram&rsquo;s cards), both optional so older files still import.
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
        <Link to="/licensing">GNU General Public License v3</Link>. Use it, fork it, self-host it, read every line of it
        — there&rsquo;s nothing hidden and nothing to pay for, and any distributed modifications stay free software
        under the same license.
      </p>
    </section>
  </section>
)
