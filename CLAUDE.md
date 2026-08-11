# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

An instructor's tool for the Swedish Armed Forces competence tests — pistol (Delmoment 14, BAS
"PILEN") and rifle (Delmoment 12, Kompetensprov Bas). A web app built for the range: one hand, in
the dark, without coverage. Plain HTML, CSS and JavaScript, no dependencies, no framework, no CDN.

**It is not an official Armed Forces product.** That caveat appears in four places — README, the
user guide, the help text and the instruction view — and must stay in all of them.

## Read the playbook first

**[PLAYBOOK.md](PLAYBOOK.md) is the real documentation**: how the rules are encoded as data, why
the interface has two sweeps instead of a form per shooter, how the export formats are written by
hand, the view map, and the traps that already cost time. This file carries only what you need
before touching anything.

[README.md](README.md) describes how the app is used.

## The two things that break most easily

**Build before you test.** The flow tests run jsdom against `dist/index.html`, not against `src/`:

```bash
python3 bygg.py     # bundles src/ into one self-contained file
npm test            # 74 tests: rules, export, full flow
```

Editing `src/` and running `npm test` tests the *previous* build, which passes happily and tells
you nothing.

**The app must stay one file with zero external requests.** `bygg.py` refuses to build if an
`http(s)` `src`/`href` slipped in, because a fetch at runtime means a blank app on a range without
coverage. The same file is what GitHub Pages serves and what can be mailed as an attachment.

## Publishing

```bash
python3 bygg.py
./publicera.sh -m "what you did"     # copies dist/ to the public repo and pushes
```

Source lives in `steeriks/fm-kompetensprov-kalla` (private); the built app is served from
`steeriks/fm-kompetensprov` (public) at `steeriks.github.io/fm-kompetensprov/`. `bygg.py` stamps
the service-worker cache name with the file's fingerprint, so a publish takes effect by itself —
don't hand-edit that value in `src/sw.js`.

GitHub Pages usually lags the push by half a minute. Compare checksums before concluding that a
change didn't make it.
