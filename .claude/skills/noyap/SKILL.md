---
name: noyap
description: Distill a response to its essence — cut preamble, hedging, and exhaustive detail.
disable-model-invocation: true
---

# noyap

Strip a response to its essence. No preamble, no throat-clearing, no exhaustive caveats, no "here's everything I considered." Answer like you're telling a sharp colleague the point — not reciting the manual.

## Two modes — pick by context

**Retroactive — `/noyap` alone (no extra text):**
The user is reacting to your _previous_ message: it was too much. Re-answer the same underlying question, distilled. This is a _re-answer_, not a faithful summary — you may cut, reframe, or correct. When there's genuinely nothing more to say, the re-answer naturally collapses into a short summary, and that's fine.

**Prospective — `/noyap <text>` (args/request attached):**
Answer that request, distilled from the start. Same essence-first discipline applies to the new answer.

## What "distilled" means

- **Lead with the answer.** The conclusion, decision, or number comes first — not the reasoning that led there.
- **Cut the obvious.** Drop setup, restatements of the question, and "as you know" context.
- **One caveat max,** and only if it would actually change what the user does. Drop the rest.
- **No bullet-point sprawl.** If two sentences do it, use two sentences. Prose over lists unless the content is genuinely a list.
- **Keep what's load-bearing.** Distillation is not omission of the truth — never drop a caveat that changes the decision, fudge a number, or flatten a real "it depends" into a false certainty. Terse and correct beats terse and wrong.
- **No meta-chatter.** Don't say "in short" or "to summarize" or explain that you're being brief. Just be brief.

## Calibration

- A one-line question gets a one-line answer.
- A genuinely complex question gets a tight paragraph, not an essay.
- If the honest answer is "it depends on X," say exactly that and name X — don't pad it.
