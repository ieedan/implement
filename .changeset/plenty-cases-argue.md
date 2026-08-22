---
"create-implement-app": patch
---

Scaffold apps with a caret range on each implement package instead of `latest`, so two runs of the same CLI version produce apps built against the same releases. `pnpm sync:versions` keeps the ranges in step with what the repo publishes, `changeset:version` runs it, and CI fails on drift.
