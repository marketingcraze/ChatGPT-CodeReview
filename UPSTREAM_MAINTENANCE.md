---
schema_version: 1
upstream_repository: anc95/ChatGPT-CodeReview
managed_repository: marketingcraze/ChatGPT-CodeReview
upstream_base_sha: 08174796256372e73e488990625313bbfa4be046
managed_release_sha: 08174796256372e73e488990625313bbfa4be046
managed_release: pre-managed-baseline
last_verified_at: 2026-08-04T11:10:00Z
---

# Upstream maintenance for the managed evidence-review Action

## 1. Purpose and safety rules

This repository imports public fixes from `anc95/ChatGPT-CodeReview` while preserving the managed evidence-review behaviour used by caller repositories. Never update `main` directly. Never resolve a conflict by choosing an entire upstream or managed file without understanding both sides. Never update `upstream_base_sha` until all required builds, fixtures, integration checks, and packaged-Action parity checks pass. Stop and report the ambiguity when upstream changes a managed contract, input, output, evidence rule, event mode, GitNexus receipt, or verdict.

Never force-push, rewrite managed release history, use destructive recovery commands, or commit private LottoSocial/PWA-LIVE policy content. A developer statement, an AI review, or a green syntax check is not evidence that a managed invariant survived.

## 2. Repository model

- `upstream/main` is the public source from `anc95/ChatGPT-CodeReview`.
- `origin/main` is the protected managed production Action.
- `maintenance/upstream-<version>` is a temporary integration branch created from current `origin/main`.
- `feature/evidence-review-v1` is the first managed implementation branch.
- Immutable managed release tags and full SHAs are the only references PWA-LIVE may consume.
- `archive/pre-upstream-sync-26625e4` preserves the pre-sync fork state.

## 3. Managed customization inventory

The inventory is machine-read by `scripts/check-upstream-guide.mjs`. Paths and invariant tests must exist. It intentionally contains no private caller prompt or policy content.

<!-- managed-customizations:start -->
```json
[
  {"path":"src/config.ts","symbols":["loadReviewConfig","PERMITTED_GITNEXUS_VERSION"],"purpose":"Pin runtime configuration, trusted evidence paths, publication behaviour, and the permitted GitNexus release.","invariants":["Only initial/final modes are accepted.","GitNexus must be exactly 1.6.9.","Luna handles routine validation, Terra handles targeted context or disagreement, and Sol handles only unresolved high/critical escalation.","Timeline review publication remains backward compatible but can be explicitly suppressed."],"tests":["test/config.test.ts","test/bot-invariants.test.ts"],"inputs":["review_mode","previous_review_run_path","trusted_context_manifest_path","ci_evidence_path","gitnexus_binary_path","publish_review_comment","gitnexus_version","initial_model","validation_model","context_validation_model","escalation_model","max_patch_length","max_context_requests","fail_on_verdict"],"outputs":[],"generated":["action/index.cjs","action/src/config.d.ts"]},
  {"path":"src/contracts.ts","symbols":["ReviewRun","Finding","EvidenceRef","ContextRequest","ContextBundle","FinalVerdict","TrustedContextReceipt","CiEvidence","StageTiming","ModelUsage"],"purpose":"Provide stable structured review, trusted-context, CI-evidence, timing, and model-usage contracts.","invariants":["Verdicts use only approved_to_merge, changes_required, or insufficient_evidence.","Material findings carry exact-SHA evidence.","ReviewRun records exact-SHA successful, pending, failed, and missing CI evidence, Architecture Hub hashes, index provenance, stage timings, and model usage without raw prompts or excerpts."],"tests":["test/review-engine.test.ts","test/trusted-inputs.test.ts"],"inputs":[],"outputs":["findings_json","review_run_json","verdict","timings_json","model_usage_json"],"generated":["action/index.cjs"]},
  {"path":"src/policy.ts","symbols":["loadPolicy"],"purpose":"Load caller-owned private policy without publishing it in this fork.","invariants":["policy_path cannot escape the checkout.","Policy text is never placed in logs or structured outputs."],"tests":["test/policy.test.ts"],"inputs":["policy_path"],"outputs":[],"generated":["action/index.cjs"]},
  {"path":"src/previous-review.ts","symbols":["loadPreviousReviewRun"],"purpose":"Load a trusted private initial ReviewRun artifact for exact-SHA final validation.","invariants":["The artifact must remain inside the caller checkout.","Repository, pull request, head SHA, schema, and initial mode must match.","Missing or invalid artifacts return no previous run so final review fails closed."],"tests":["test/previous-review.test.ts","test/review-engine.test.ts"],"inputs":["previous_review_run_path"],"outputs":[],"generated":["action/index.cjs","action/src/previous-review.d.ts"]},
  {"path":"src/trusted-inputs.ts","symbols":["loadTrustedContext","loadCiEvidence"],"purpose":"Load caller-generated Architecture Hub and exact-SHA GitHub CI evidence from trusted checkout paths.","invariants":["Every path must resolve inside the exact checkout.","Context documents are hash-verified and size-bounded.","CI repository and head SHA must match the review.","Raw context and CI payloads are never added to public outputs."],"tests":["test/trusted-inputs.test.ts"],"inputs":["trusted_context_manifest_path","ci_evidence_path"],"outputs":[],"generated":["action/index.cjs","action/src/trusted-inputs.d.ts"]},
  {"path":"src/evidence.ts","symbols":["validateCandidateFinding","extractChangedLines","sha256Text"],"purpose":"Bind every material assertion to exact repository evidence.","invariants":["Evidence has an exact SHA, file, line range, and SHA-256 excerpt hash.","A finding outside changed evidence cannot pass."],"tests":["test/evidence.test.ts"],"inputs":[],"outputs":["findings_json"],"generated":["action/index.cjs"]},
  {"path":"src/gitnexus.ts","symbols":["ensureGitNexusFresh","requestGitNexusContext"],"purpose":"Prove exact-head graph freshness, invoke a verified caller-supplied binary, and retrieve only targeted context.","invariants":["Incremental validation is attempted before one forced rebuild.","Stale or incomplete context can never approve.","Native status JSON is preferred and 1.6.9 metadata is normalized when unavailable.","The binary path cannot escape the caller checkout and its version must be exactly 1.6.9."],"tests":["test/gitnexus.test.ts"],"inputs":["gitnexus_version","gitnexus_binary_path","max_context_requests"],"outputs":["gitnexus_status","gitnexus_restore_source"],"generated":["action/index.cjs"]},
  {"path":"src/review-engine.ts","symbols":["runEvidenceReview"],"purpose":"Run initial discovery, routine validation, targeted context/disagreement validation, and selective escalation.","invariants":["Luna performs initial review and routine validation.","Terra is used only when context is insufficient or reviewers disagree.","Sol is used only for unresolved high/critical findings.","Model, context, policy, CI, or evidence failure returns insufficient_evidence.","Developer completion claims are independently checked in final mode."],"tests":["test/review-engine.test.ts"],"inputs":["review_mode","initial_model","validation_model","context_validation_model","escalation_model","trusted_context_manifest_path","ci_evidence_path"],"outputs":["verdict","review_run_json","findings_json","timings_json","model_usage_json"],"generated":["action/index.cjs"]},
  {"path":"src/report.ts","symbols":["formatReviewBody","parseReviewRunMarker","writeActionOutputs"],"purpose":"Publish discrete findings and a reusable structured run without raw model/policy/context payloads.","invariants":["Reports never serialize source excerpts.","Duplicate events can recover the prior run marker.","Stage timings, model usage, and GitNexus restore source are separately exposed for workflow summaries."],"tests":["test/report.test.ts"],"inputs":[],"outputs":["verdict","reviewed_sha","gitnexus_status","gitnexus_restore_source","findings_json","review_run_json","timings_json","model_usage_json"],"generated":["action/index.cjs"]},
  {"path":"src/bot.ts","symbols":["robot","publishReviewRun"],"purpose":"Bind exact PR events and trusted caller evidence to the managed engine while allowing caller-owned final publication.","invariants":["Initial mode handles opened, reopened, and synchronize.","Final mode handles only closed unmerged PRs.","No excluded, oversized, binary, missing, or deleted-source file can cause approval.","Duplicate published events do not post a second run.","Silent mode never creates a submitted pull-request review.","Final mode can consume the exact-SHA private initial artifact without publishing intermediate state.","Trusted context and CI evidence are validated before model use.","Missing or stale Architecture Hub context is advisory; exact-SHA code and GitNexus evidence remain authoritative."],"tests":["test/bot-invariants.test.ts","test/previous-review.test.ts","test/trusted-inputs.test.ts"],"inputs":["previous_review_run_path","trusted_context_manifest_path","ci_evidence_path","gitnexus_binary_path","publish_review_comment","TARGET_LABEL","IGNORE_PATTERNS","INCLUDE_PATTERNS"],"outputs":["verdict","review_run_json","timings_json","model_usage_json"],"generated":["action/index.cjs","action/src/bot.d.ts"]},
  {"path":"src/chat.ts","symbols":["Chat.completeJson","Chat.codeReview","Chat.getUsage"],"purpose":"Add staged JSON model calls and aggregate model usage while retaining the upstream review method.","invariants":["Responses must parse as JSON.","Usage totals are recorded by model without model payloads.","Upstream codeReview remains available for compatibility."],"tests":["test/chat.test.ts","test/review-engine.test.ts"],"inputs":["OPENAI_API_KEY","USE_GITHUB_MODELS","REASONING_EFFORT"],"outputs":["model_usage_json"],"generated":["action/index.cjs"]},
  {"path":"action.yml","symbols":["inputs","outputs","runs"],"purpose":"Expose the managed Action contract on Node 24.","invariants":["Inputs have safe backward-compatible defaults.","Silent publication, trusted evidence, caller binary, and previous-run artifact inputs are declared.","All structured, timing, usage, and restore-source outputs are declared."],"tests":["test/action-metadata.test.ts"],"inputs":["review_mode","policy_path","previous_review_run_path","trusted_context_manifest_path","ci_evidence_path","gitnexus_binary_path","publish_review_comment","gitnexus_version","initial_model","validation_model","context_validation_model","escalation_model","max_patch_length","max_context_requests","fail_on_verdict"],"outputs":["verdict","reviewed_sha","gitnexus_status","gitnexus_restore_source","findings_json","review_run_json","timings_json","model_usage_json"],"generated":[]},
  {"path":"scripts/check-upstream-guide.mjs","symbols":["main"],"purpose":"Fail CI on stale metadata, missing inventory paths/tests, or undocumented managed changes.","invariants":["Baseline and managed release SHAs exist.","Managed path changes update this guide."],"tests":["test/upstream-maintenance.test.ts"],"inputs":[],"outputs":[],"generated":[]},
  {"path":"scripts/check-upstream-freshness.mjs","symbols":["main"],"purpose":"Compare the recorded upstream baseline to the live public main SHA.","invariants":["Upstream movement fails the release check instead of merging automatically."],"tests":["test/upstream-maintenance.test.ts"],"inputs":[],"outputs":[],"generated":[]},
  {"path":"package.json","symbols":["scripts"],"purpose":"Expose deterministic typecheck, test, guide, upstream, and package build commands.","invariants":["Dependencies install from the committed yarn.lock with --frozen-lockfile.","Validation commands are reproducible in CI."],"tests":["test/action-metadata.test.ts"],"inputs":[],"outputs":[],"generated":["action/index.cjs"]},
  {"path":"tsconfig.check.json","symbols":["compilerOptions"],"purpose":"Type-check managed TypeScript without unrelated legacy CommonJS diagnostics.","invariants":["All managed TypeScript is strict-checked without emitting files."],"tests":["test/action-metadata.test.ts"],"inputs":[],"outputs":[],"generated":[]},
  {"path":"jest.config.js","symbols":["default"],"purpose":"Run TypeScript tests under the repository ESM contract and resolve NodeNext .js specifiers.","invariants":["Upstream and managed fixtures run under Node 24."],"tests":["test/index.test.ts"],"inputs":[],"outputs":[],"generated":[]},
  {"path":".env.example","symbols":["managed environment variables"],"purpose":"Document self-hosted managed configuration without real secrets or private policy.","invariants":["No credential or private policy content is committed.","Silent publication, trusted evidence, caller binary, model routing, and previous-run artifact configuration are documented."],"tests":["test/action-metadata.test.ts"],"inputs":["REVIEW_MODE","POLICY_PATH","PREVIOUS_REVIEW_RUN_PATH","TRUSTED_CONTEXT_MANIFEST_PATH","CI_EVIDENCE_PATH","GITNEXUS_BINARY_PATH","PUBLISH_REVIEW_COMMENT","GITNEXUS_VERSION","INITIAL_MODEL","VALIDATION_MODEL","CONTEXT_VALIDATION_MODEL","ESCALATION_MODEL","MAX_CONTEXT_REQUESTS","FAIL_ON_VERDICT"],"outputs":[],"generated":[]},
  {"path":"README.md","symbols":["Using GitHub Actions"],"purpose":"Document immutable-SHA caller workflows, trusted evidence inputs, direct GitNexus runtime, exact-SHA private artifacts, and caller-owned final publication.","invariants":["Examples use exact PR checkout and private policy injection.","Silent stages preserve initial evidence through a private exact-SHA artifact.","No public example points PWA-LIVE to a floating managed branch.","Trusted context and CI files remain caller-owned and private."],"tests":["test/action-metadata.test.ts","test/previous-review.test.ts","test/trusted-inputs.test.ts"],"inputs":[],"outputs":[],"generated":[]},
  {"path":"AGENTS.md","symbols":["mandatory upstream instruction"],"purpose":"Require future LLMs to read this guide before importing upstream.","invariants":["The mandatory sentence remains exact."],"tests":["test/upstream-maintenance.test.ts"],"inputs":[],"outputs":[],"generated":[]},
  {"path":"UPSTREAM_MAINTENANCE.md","symbols":["frontmatter","managed customization inventory"],"purpose":"Provide the complete semantic upstream import and recovery procedure.","invariants":["Metadata, inventory, tests, parity, release evidence, and rollback remain machine-verifiable."],"tests":["test/upstream-maintenance.test.ts"],"inputs":[],"outputs":[],"generated":[]},
  {"path":"action/index.cjs","symbols":["packaged Action"],"purpose":"Commit the runnable Node 24 artifact consumed by immutable Action SHAs.","invariants":["The committed bundle exactly matches source build output."],"tests":["test/action-metadata.test.ts"],"inputs":[],"outputs":[],"generated":["action/index.cjs"]},
  {"path":".github/workflows/cr.yml","symbols":["evidence-review"],"purpose":"Exercise the managed local Action on its own pull requests without using upstream main.","invariants":["The workflow checks out the exact PR head and runs the local managed Action in advisory mode.","Every third-party Action is pinned by full commit SHA."],"tests":["test/action-metadata.test.ts"],"inputs":[],"outputs":[],"generated":[]},
  {"path":".github/workflows/ci.yml","symbols":["jobs"],"purpose":"Enforce build, tests, guide, package parity, secrets, and upstream freshness.","invariants":["Committed Action matches source output.","Required checks are reproducible from the lockfile.","Every third-party Action is pinned by full commit SHA."],"tests":["test/action-metadata.test.ts"],"inputs":[],"outputs":[],"generated":[]},
  {"path":".github/workflows/upstream-drift.yml","symbols":["jobs"],"purpose":"Maintain one daily upstream drift issue without automatic merging.","invariants":["Upstream changes are reported, never auto-merged.","Every third-party Action is pinned by full commit SHA."],"tests":["test/upstream-maintenance.test.ts"],"inputs":[],"outputs":[],"generated":[]}
]
```
<!-- managed-customizations:end -->

## 4. Preflight procedure

1. Confirm valid GitHub authentication and a clean worktree with `gh auth status` and `git status --short`.
2. Add or verify `upstream` points to `https://github.com/anc95/ChatGPT-CodeReview.git`.
3. Run `git fetch origin --prune --tags` and `git fetch upstream --prune --tags`.
4. Read upstream release notes, tags, and every commit from `upstream_base_sha..selected-release-sha`.
5. Verify the recorded base exists: `git cat-file -e <upstream_base_sha>^{commit}`.
6. Record upstream changes with `git diff --name-status <old-base>..<new-upstream>` and managed changes with `git diff --name-status <old-base>..origin/main`.
7. Identify files and symbols touched by both sides. Explicitly inspect dependency, OpenAI SDK, Node runtime, `action.yml`, lockfile, Probot event, GitHub API, and Action input/output changes.
8. Before changing code, produce this overlap/risk table in the maintenance PR:

| File/symbol | Upstream intent | Managed invariant | Overlap | Risk | Resolution owner |
| --- | --- | --- | --- | --- | --- |
| `<path>:<symbol>` | `<summary>` | `<inventory invariant>` | yes/no | low/medium/high/critical | `<name>` |

Stop if authentication, the recorded base, release identity, or an overlapping contract cannot be proven.

## 5. Integration procedure

1. Create `maintenance/upstream-<version>` from current managed `origin/main`, never from upstream.
2. Run `git merge --no-commit --no-ff <selected-upstream-sha>`.
3. Accept upstream normally for files with no managed overlap.
4. For each managed file, understand the upstream intent, preserve the documented behavioural invariant, and reapply that invariant on the new design. Never restore an obsolete whole-file managed copy.
5. Re-run the overlap analysis after resolving conflicts and explain every manual resolution in the PR.
6. If intent or safety cannot be resolved, run `git merge --abort`, preserve the branch for evidence if useful, and report the ambiguity. Do not use reset, checkout-overwrite, clean, or force-push as recovery.

## 6. Required semantic checks

- The selected upstream release SHA is an ancestor of the integration head: `git merge-base --is-ancestor <selected-sha> HEAD`.
- `git rev-list <selected-sha> --not HEAD` returns no commits.
- Every inventory path, symbol, invariant, and regression test remains present.
- Action inputs and outputs remain backward compatible unless a reviewed major release explicitly changes them.
- Exact-SHA evidence, structured findings, GitNexus freshness, staged validation, and fail-closed verdicts remain intact.
- PWA-LIVE can still inject its private policy through `policy_path`; no private context exists in this public fork.
- No skipped, excluded, binary, deleted-source, or oversized file can cause approval.
- No repository content, policy, model payload, key, token, or targeted context is printed to logs.

## 7. Build and test sequence

Run from a clean checkout with the supported Node runtime:

```bash
yarn install --frozen-lockfile
npm run typecheck
npm run lint
npm test
npm run check:guide
npm run build
git diff --exit-code -- action/index.cjs
```

The required Gitleaks job scans `origin/main..HEAD` with a pinned open-source scanner. The selected upstream baseline contains nine historical detections in upstream test/generated artifacts; rewriting those public commits is prohibited. The managed range must contain zero findings. Every future upstream integration is still scanned because its new commits and merge commit are inside the maintenance branch range.

Then run baseline upstream fixtures and managed evidence-review fixtures. Run the upstream-conflict fixture. From a test caller repository, run both modes at an exact PR SHA and exercise `approved_to_merge`, `changes_required`, and `insufficient_evidence`. Explicitly test stale GitNexus, one failed forced rebuild, developer completion claims, prompt injection in repository content/comments, model/API failure, duplicate deliveries, deleted PR branches, excluded files, and oversized patches. Inspect logs to confirm no payload leakage.

## 8. Parity and release verification

Compare the integration branch against the old upstream base, the selected new upstream release, and the previous managed release. Explain every delta that remains relative to the selected upstream release. Require zero commits behind the selected upstream version. If upstream `main` advanced beyond the selected release, report that separately and block release unless the release decision explicitly selects and records the newer SHA.

Only after validation, update the frontmatter baseline and compatibility notes. Open a managed PR containing the old upstream SHA, new upstream SHA, previous managed SHA, overlap table, conflicts and resolutions, full test evidence, packaged-Action parity evidence, and rollback point. Create an immutable managed release tag and record its full SHA. PWA-LIVE must reference that full SHA, not a branch or floating tag.

## 9. Recovery

- Abort an uncommitted import with `git merge --abort`.
- Close a failed maintenance branch without changing managed `main`.
- Revert an already merged import through a new reviewed revert PR.
- Keep the previous immutable managed release SHA available to PWA-LIVE until the replacement passes the pilot and release gate.

## 10. Guide maintenance

Any PR that adds, removes, or materially changes managed behaviour must update this inventory and its invariant tests. Every upstream-sync PR must update baseline metadata, compatibility notes, and verification evidence. CI fails when an inventory path or test is missing, metadata is invalid, the baseline commit is unavailable, or a managed path changes without this guide changing or an explicit unchanged-invariant confirmation supplied through the documented CI input.

The initial `managed_release_sha` records the upstream-current pre-managed baseline because no managed release exists yet. The release PR must replace it with the immutable `lottosocial-v1.0.0` target SHA after validation and before PWA-LIVE adoption.
