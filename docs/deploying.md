# Deploying

Seshat is a static site on GitLab Pages: <https://davidawad.gitlab.io/seshat>. The `pages` job in
`.gitlab-ci.yml` builds `dist/` and publishes it, but only on the default branch (`master`) and only after
the `test` job (`pnpm run ci`) passes. Every push to `master` therefore deploys by itself.

## Manual deploy

```sh
just deploy     # from master: install, run the full CI gate locally, push master to the gitlab remote
just redeploy   # republish what is already on master (starts a new pipeline; pushes nothing)
```

`just deploy` refuses to run off `master` or with uncommitted tracked changes, and stops if the local gate
fails, so a broken build never reaches the remote. `just redeploy` is the command-line version of the
"Run pipeline" button on GitLab (CI/CD, Pipelines). Both use `glab` (already logged in on this machine).

Watch a deploy with `glab ci status --repo davidawad/seshat --branch master`, or open the pipelines page
at <https://gitlab.com/davidawad/seshat/-/pipelines>.

## Notes

- The build's base path is `/seshat/` (from `package.json`'s `name`), because Pages serves the project under
  that path. `dist/index.html` is copied to `404.html` so direct hits on client-side routes load the app.
- Release notes are built from git history and tags, so jobs fetch the full history (`GIT_DEPTH: '0'`).
