# Managed repository instructions

Before importing an upstream commit, release, or tag, read and follow `UPSTREAM_MAINTENANCE.md` completely.

- Make managed changes on a feature or maintenance branch, never directly on `main`.
- Keep caller policy content outside this public repository and load it through `policy_path`.
- Update the managed customization inventory and invariant tests whenever managed behaviour changes.
- Regenerate and commit `action/index.cjs` after source changes.
