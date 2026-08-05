# CodeReview BOT

> A code review robot powered by ChatGPT

Translation Versions: [ENGLISH](./README.md) | [简体中文](./README.zh-CN.md) | [繁體中文](./README.zh-TW.md) | [한국어](./README.ko.md) | [日本語](./README.ja.md)

## Bot Usage

❗️⚠️ `Due to cost considerations, BOT is only used for testing purposes and is currently deployed on AWS Lambda with ratelimit restrictions. Therefore, unstable situations are completely normal. It is recommended to deploy an app by yourself.`

### Install

Install: [apps/cr-gpt](https://github.com/apps/cr-gpt);

### Configuration

1. Go to the repo homepage which you want integrate this bot
2. click `settings`
3. click `actions` under `secrets and variables`
4. Change to `Variables` tab, create a new variable `OPENAI_API_KEY` with the value of your open api key (For Github Action integration, set it in secrets)
   <img width="1465" alt="image" src="https://user-images.githubusercontent.com/13167934/218533628-3974b70f-c423-44b0-b096-d1ec2ace85ea.png">

### Start using

1. The robot will automatically do the code review when you create a new Pull request, the review information will show in the pr timeline / file changes part.
2. After `git push` update the pull request, cr bot will re-review the changed files

example:

[ChatGPT-CodeReview/pull/21](https://github.com/anc95/ChatGPT-CodeReview/pull/21)

<img width="1052" alt="image" src="https://user-images.githubusercontent.com/13167934/218999459-812206e1-d8d2-4900-8ce8-19b5b6e1f5cb.png">

## Using GitHub Actions

[actions/chatgpt-codereviewer](https://github.com/marketplace/actions/chatgpt-codereviewer)

The upstream-compatible environment variables remain available. The managed fork also provides an evidence-backed two-stage review and final merge verdict. GitHub Actions is the supported orchestration layer because it receives the immutable PR event SHA, can post a review on that SHA, and can become a required branch check without moving repository data through an external n8n service.

The public fork contains only generic review rules. Put organization-specific policy in the private caller repository (for example `.github/ai-review-policy.yml`) and pass its repository-relative path through `policy_path`. Policy text, raw model payloads, targeted GitNexus context, and source excerpts are not written to logs or Action outputs.

Callers that publish one trusted final summary can set `publish_review_comment: false` in both stages. Persist the initial `review_run_json` output as a private GitHub Actions artifact named for the pull request and exact head SHA, download that exact artifact during the final run, and pass its repository-relative location through `previous_review_run_path`. A missing, malformed, mismatched, or workspace-external artifact is rejected, so final review fails closed instead of approving without its initial evidence.

GitNexus is pinned to `1.6.9`. The Action accepts a caller-prepared binary through `gitnexus_binary_path`, verifies that it is inside `GITHUB_WORKSPACE` and reports the permitted version, then attempts native `status --json`. For the known 1.6.9 compatibility case it normalizes human status plus the full metadata SHA. A stale seed receives one incremental update followed by at most one forced rebuild; a stale result always returns `insufficient_evidence`.

GitHub-only callers may supply a hash-verified Architecture Hub manifest through `trusted_context_manifest_path` and exact-SHA GitHub Checks/Statuses through `ci_evidence_path`. The documents and CI records are untrusted model data and are never emitted in public Action outputs. Routine validation stays on Luna; `context_validation_model` is used only for targeted context or material disagreement, and Sol remains limited to unresolved high/critical findings.

### Initial review

Use an immutable managed release SHA in a caller repository:

```yml
name: Initial evidence review

permissions:
  contents: read
  pull-requests: write
  models: read

on:
  pull_request:
    types: [opened, reopened, synchronize]

jobs:
  evidence-review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event.pull_request.head.sha }}
          fetch-depth: 0
      - id: review
        uses: marketingcraze/ChatGPT-CodeReview@<FULL_MANAGED_RELEASE_SHA>
        with:
          review_mode: initial
          policy_path: .github/ai-review-policy.yml
          publish_review_comment: false
          trusted_context_manifest_path: .trusted-context/context-manifest.json
          ci_evidence_path: .trusted-context/ci-evidence.json
          gitnexus_binary_path: ${{ github.workspace }}/.trusted-gitnexus/node_modules/.bin/gitnexus
          gitnexus_version: 1.6.9
          fail_on_verdict: false
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          USE_GITHUB_MODELS: true
```

### Final advisory review on close

During the PWA-LIVE pilot, keep `fail_on_verdict: false`. The final run compares the structured initial findings, later developer comments and completion claims, current exact-SHA code, tests visible in the submitted repository, and targeted GitNexus context.

```yml
name: Final evidence review

permissions:
  contents: read
  pull-requests: write
  models: read

on:
  pull_request:
    types: [closed]

jobs:
  final-review:
    if: github.event.pull_request.merged == false
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event.pull_request.head.sha }}
          fetch-depth: 0
      - id: review
        uses: marketingcraze/ChatGPT-CodeReview@<FULL_MANAGED_RELEASE_SHA>
        with:
          review_mode: final
          policy_path: .github/ai-review-policy.yml
          previous_review_run_path: .trusted-state/initial-review.json
          publish_review_comment: false
          trusted_context_manifest_path: .trusted-context/context-manifest.json
          ci_evidence_path: .trusted-context/ci-evidence.json
          gitnexus_binary_path: ${{ github.workspace }}/.trusted-gitnexus/node_modules/.bin/gitnexus
          gitnexus_version: 1.6.9
          fail_on_verdict: false
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          USE_GITHUB_MODELS: true
```

The Action exposes `verdict`, `reviewed_sha`, `gitnexus_status`, `gitnexus_restore_source`, `findings_json`, `review_run_json`, `timings_json`, and `model_usage_json`. When Action publication is suppressed, the caller owns the sole final comment and label update. Enforcement can set `fail_on_verdict: true` only after the documented 20-PR/14-day pilot. `approved_to_merge`, `changes_required`, and `insufficient_evidence` are the only verdicts.

### Maintenance

Before importing upstream changes, read [UPSTREAM_MAINTENANCE.md](UPSTREAM_MAINTENANCE.md). Managed `main` is never updated directly or automatically. The daily workflow reports drift in one issue; every import uses a reviewed `maintenance/upstream-<version>` branch, semantic conflict resolution, invariant fixtures, and packaged-Action parity.

## Self-hosting

1. clone code
2. copy `.env.example` to `.env`, and fill the env variables
3. install deps and run

```sh
npm i
npm i -g pm2
npm run build
pm2 start pm2.config.cjs
```

[probot](https://probot.github.io/docs/development/) for more detail

## Dev

### Setup

```sh
# Install dependencies
npm install

# Build code
npm run build

# Run the bot
npm run start
```

### Docker

```sh
# 1. Build container
docker build -t cr-bot .

# 2. Start container
docker run -e APP_ID=<app-id> -e PRIVATE_KEY=<pem-value> cr-bot
```

## Contributing

If you have suggestions for how cr-bot could be improved, or want to report a bug, open an issue! We'd love all and any contributions.

For more, check out the [Contributing Guide](CONTRIBUTING.md).

## Credit

this project is inpired by [codereview.gpt](https://github.com/sturdy-dev/codereview.gpt)

## License

[ISC](LICENSE) © 2023 anc95
