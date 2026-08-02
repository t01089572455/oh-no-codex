# Publish process (Owner-gated)

This is the **smallest honest path** used for `oh-no-codex@0.1.7`. It is not
permission to automate releases, invent a second current-state file, or expand
product scope so a review looks greener.

Authority order (same as the product):

1. Owner explicit words (push / publish / tag are separate authorizations)
2. `docs/PRODUCT-CONTRACT.md`
3. `docs/DESIGN.md` + `docs/COCKPIT-DESIGN-CONTRACT.md`
4. `docs/ACCEPTANCE.md`
5. `docs/IMPLEMENTATION-PLAN.md` unique next

Reviewer opinions, handoffs, and chat summaries cannot add acceptance rows.

## What must already be true

- Version in `package.json` is the release version (e.g. `0.1.7`).
- Product stays inside the hard complexity budget (one package, one CLI, sole
  authority `.ohno/state.json`, cooperative hooks, one local Cockpit).
- Cockpit refresh cadence matches the locked design (**100–125 ms**).
- Same-batch **LIVE** P01–P06 on three disposable real-project copies
  (different stacks), 30 samples + warm-up, real browser for P06.
- P06 start clock is harness observation of sole authority `state.json`
  (post atomic rename). **Do not** add `.ohno/state.saved-at` or any second
  current-state authority.
- Public EN/ZH README evidence table shows **exact p95** (and P04 bytes),
  `TRIAL_PASS` / `LIVE` wording, and honest labels (never invent
  `V1_TRIAL_ACCEPTED` without contract).
- Performance gate binds digests: `dist_cli`, full `package_subject`, and
  `runtime_subject` (packed package **excluding** README* so documenting p95
  does not rebind samples). After filling README, recompute **package_subject
  only**; do not remeasure solely for README text.
- Evidence `implementation.head` is an **ancestor** of the release tip (measure
  on a frozen base tree, then one scoped commit is fine).

## Gate (clean worktree, once)

From a clean checkout of the exact candidate (see `docs/ACCEPTANCE.md`):

```bash
npm ci
npm run typecheck
npm run build
npm test
npm run test:acceptance
npm run test:performance
npm pack --dry-run
git diff --check
git status --short
```

All must exit 0; last two produce no output. Gate is **not** a network or
publish side effect.

## Git push (only with Owner words)

```bash
git status -sb          # expect clean, on intended branch
git log origin/main..HEAD --oneline
git push -u origin main
```

Do not force-push `main`. Do not push other remotes unless Owner named them.

## npm publish (only with Owner words)

This machine may default to a **mirror** registry. Publish must target the
public registry that owns the package:

```bash
npm whoami --registry https://registry.npmjs.org
npm view oh-no-codex version --registry https://registry.npmjs.org
npm run build
npm publish --registry https://registry.npmjs.org --access public
```

`prepublishOnly` already runs `npm run build`. Confirm after a short delay:

```bash
npm view oh-no-codex version --registry https://registry.npmjs.org
npm view oh-no-codex dist-tags --registry https://registry.npmjs.org
```

Expect `version` and `dist-tags.latest` equal to the release version.

### Install / upgrade after publish

Mirrors can lag. Prefer the public registry when upgrading immediately:

```bash
npm install -g oh-no-codex@<version> --registry https://registry.npmjs.org
ohno --help
# Windows: ensure global npm bin is on PATH (see README)
```

## Public docs after Owner authorizes publish

In the same release line (or the immediate follow-up docs commit):

- README EN/ZH: npm row and status badges must not still say “unpublished” /
  “await Owner publish” once publish is authorized and performed.
- Ledger unique next: leave **`STOP`** (or equivalent single next). Do not leave
  `OWNER_AUTHORIZE_NPM_PUBLISH_*` after that authorization was used.
- Refresh `package_subject` digests if README packed bytes changed; re-run
  `npm run test:performance` only.

## Explicit non-goals

- Tagging, GitHub Releases, or CI publish automation unless Owner asks.
- Republishing the same version, or unpublishing, without new Owner words.
- Expanding acceptance with batch-id religion, CPU admission platforms,
  Chromium port blocklists in product code, or second state markers.
- Claiming universal speed or `V1_TRIAL_ACCEPTED` from local `TRIAL_PASS`.

## 0.1.7 record (worked example)

| Step | Result |
| --- | --- |
| Design-minimal product delta | Cockpit 100 ms + `puppeteer-core` (dev) |
| LIVE batch | `live-20260802T072712Z-660743f7` |
| Release tip (before publish docs) | `f572c6c` |
| Publish-status docs tip | `33a60a9` |
| `git push origin main` | Owner-authorized |
| `npm publish` → npmjs.org | `oh-no-codex@0.1.7` (`latest`) |
| Ledger next after | `STOP` |
