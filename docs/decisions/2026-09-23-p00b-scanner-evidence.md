# P00b — scanner evidence, and what it settles

Date: 23 September 2026. **Status: evidence, tested at the Worthing shop.**
This closes the scanner half of P00b. The printer half is still open, so P00b
as a whole is **not** done.

Source: a characterisation run at the shop on 23 September, reported back by
email. Items below are observed unless marked otherwise; the report marked its
own gaps, and those are carried here rather than smoothed over.

## The device

AURES **PS-50IIBL** (P/N 88H-51HSUB-0AR), USB cable, behaving as a USB
keyboard — it types into whatever field has focus. No driver, no API. Brand
reported by the owner; not printed on the label.

## What it settles

**It is a 1D laser scanner and cannot read QR codes.** Pointed at a printed QR
it produced no beep and no output. It read a printed striped barcode.

This answers a question the Release 1 workshop plan left conditional: "support
QR scanning using a phone camera or agreed 2D reader. Where the shop uses a 1D
scanner, print an additional Code 128 job number; do not assume it can read
QR." The first shop has a 1D scanner, so **the tag must carry Code 128**. That
is already what atlas note 11 changed the tag to, so nothing needs replanning —
the choice is now backed by evidence instead of assumption.

## The input contract

- **Suffix: a single Enter** after each scan. **Prefix: none.**
- A Code 128 test barcode `AbZ-0189` was typed exactly.
- Uppercase arrives as a separate Shift keydown then the letter, so a reader
  must ignore modifier keydowns and build the code from the characters.
- **Speed:** 11 keydowns in 54.8 ms (gaps 1.6–13.8 ms) and 16 in 126.9 ms
  (gaps 0.2–16.5 ms). A whole code lands well inside a quarter of a second,
  against roughly 100 ms per key for a person typing.

## Character mangling, and the cheaper fix

The scanner is set to a US layout while Windows is UK, which swaps:

| Sent | Arrives |
|---|---|
| `@` | `"` |
| `"` | `@` |
| `#` | `£` |
| `\` | `#` |
| `\|` | `~` |
| `~` | `¬` |

`A-Z a-z 0-9 - ' / . , _ +` are unaffected. **Job references (`WH-1000`) are
therefore safe.**

The scanner's own keyboard language is configurable to UK by scanning setup
barcodes from its manual, and settings survive power-off. **Fix it at the
scanner rather than in software** — it removes the whole class of problem for
this shop. [MANUAL: from the manufacturer's manual, not tested.]

**Caps Lock inverts every letter**, so `STYR-007001` arrives as `styr-007001`.
The resolver must compare case-insensitively; this cannot be fixed at the
scanner.

Also configurable per the manual, none of it tested: terminator (none / Enter /
Tab), letter case, inter-character delay 0–50 ms, custom prefix/suffix, and a
factory reset barcode.

## What this means for the build

- Accept Enter, Tab **or** no terminator, ending a scan after a short pause
  when there is none. Other shops will have other scanners; this one is an
  example, not the specification.
- Distinguish a scan from typing by inter-key timing, with generous margin —
  two scans on one machine is not enough evidence to tune a tight threshold.
- Normalise case when resolving a tag.
- Keep shop-printed labels to `A-Z`, `0-9` and hyphen.
- Make sure the scan field's Enter cannot trigger an unintended submit. Screen
  13 (`scan`) owns this.

## What is still not proven

- **No tag from our own printer has been scanned.** The printer, label stock
  and Windows driver host are all still open. The atlas barcode therefore
  **stays a declared non-scanning specimen**, and "a real printed tag scans to
  the right job" remains unproven — it is P08's acceptance criterion and is not
  met by this evidence.
- Scanned output was not compared against the text printed on the shop's own
  labels.
- The Windows layout was inferred from the swap pattern, not read from the
  layout indicator.
- Reconfiguration was read from the manual, not performed.
- Timing came from keydown events only, in one browser, over two scans.
