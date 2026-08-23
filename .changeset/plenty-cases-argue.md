---
"create-implement-app": patch
---

Scaffold apps with a version range on each implement package instead of `latest`. `latest` resolves at install time, so two runs of the same CLI produced apps built against different releases. The range is a tilde — a floor later patches clear on their own — so a new app still starts on the current release without the CLI having to be told about it.
