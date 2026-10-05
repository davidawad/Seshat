# Releasing

Release notes are generated from the commit history at build time. Nothing generated is committed:
the `/releases` page, `/releases.txt` and `/CHANGELOG.md` are rebuilt from conventional commits and
`vX.Y.Z` tags on every build (`vite-plugins/release-notes.ts`, logic in `src/lib/releases.ts`).
Commits after the latest tag appear under **Unreleased**.

## Baseline

`package.json` starts at `0.1.0`. Tag the baseline once, at the commit you want to call 0.1.0
(nothing is tagged automatically):

```sh
git tag -a v0.1.0 <commit> -m "Release v0.1.0"
git push origin v0.1.0
```

## Cutting a release

```sh
just release patch --dry-run   # preview the version bump and changelog entry
just release minor             # bump package.json, prepend CHANGELOG.md, commit, tag vX.Y.Z
git push origin HEAD vX.Y.Z    # publishing is always your call: the script never pushes
```

`just release` refuses to run on a dirty tree, before the baseline tag exists, or when there are no
changes since the last tag. The committed `CHANGELOG.md` is written by this recipe only; the site's
`/CHANGELOG.md` is a separate, always-current build output.

## CI

`.gitlab-ci.yml` sets `GIT_DEPTH: '0'` and fetches tags so the build sees the full history. With a
shallow clone or no git, the build still succeeds and the Release notes page says what is missing.
