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

**Build before you test.** The flow tests run jsdom against `docs/index.html`, not against `src/`:

```bash
python3 bygg.py     # bundles src/ into one self-contained file
npm test            # 79 tests: rules, export, full flow, outbound-traffic guards
```

Editing `src/` and running `npm test` tests the *previous* build, which passes happily and tells
you nothing.

**The app must stay one file with zero external requests.** A fetch at runtime means a blank app
on a range without coverage — and the app holds names, units and service numbers of serving
personnel, so nothing may leave the phone unless the instructor presses export. Three things
enforce this together, and all three must stay:

- `bygg.py` → `kontrollera_inga_utgaende()` fails the build on an unknown address anywhere in the
  file (not just in `src=`/`href=`), a protocol-relative address, a network API by name, or a
  missing/weakened CSP. Permitted addresses live in `TILLATNA_URLER`, each with its reason.
- The CSP meta tag in `src/index.html` (`connect-src 'none'`, `form-action 'none'`) — the browser
  closes the door even if the code tries.
- `test/utgaende.test.mjs` repeats the checks against the built file, so they still hold if
  `bygg.py` itself is changed.

The same file is what GitHub Pages serves and what can be mailed as an attachment.

## Publishing

```bash
python3 bygg.py
git commit -am "what you did" && git push     # that is the whole publish
```

One repository. Source and built app both live in `steeriks/fm-kompetensprov` (public), and
Pages serves `main` + `/docs` at `steeriks.github.io/fm-kompetensprov/`. Building and pushing
*is* publishing — there is no second repo to copy into, so the two cannot drift apart. Until
2026-08-12 the source was private in `fm-kompetensprov-kalla` and `publicera.sh` copied the
build across; making the source public removed the reason for the split. `bygg.py` stamps
the service-worker cache name with the file's fingerprint, so a publish takes effect by itself —
don't hand-edit that value in `src/sw.js`.

GitHub Pages usually lags the push by half a minute. Compare checksums before concluding that a
change didn't make it.
