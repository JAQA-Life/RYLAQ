#!/usr/bin/env python3
"""JAQA: build a self-hosted Material Symbols Outlined subset (Apache-2.0, Google)
containing only the icons God's Eye View names in index.html (icon_names=...),
pinned to its axes (opsz 20, wght 400, FILL 0, GRAD 0) — the same thing the
Google Fonts URL served, without a third-party font request.
Usage: python3 scripts/jaqa-subset-icons.py  (needs: pip install fonttools brotli)"""
import re, sys, pathlib
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools import subset

root = pathlib.Path(__file__).resolve().parent.parent
names = re.search(r'icon_names=([a-z0-9_,]+)', (root / 'index.html').read_text()).group(1).split(',')
src = root / 'node_modules/material-symbols/material-symbols-outlined.woff2'
font = TTFont(str(src))
font = instancer.instantiateVariableFont(font, {'FILL': 0, 'GRAD': 0, 'opsz': 20, 'wght': 400})

# Map each icon name to the glyph its ligature produces.
cmap = font.getBestCmap()
ligs = {}
for lookup in font['GSUB'].table.LookupList.Lookup:
    for st in lookup.SubTable:
        st = getattr(st, 'ExtSubTable', st)
        for first, entries in getattr(st, 'ligatures', {}).items():
            for lig in entries:
                ligs[tuple([first] + list(lig.Component))] = lig.LigGlyph
targets, missing = [], []
for n in names:
    seq = tuple(cmap[ord(c)] for c in n)
    (targets.append(ligs[seq]) if seq in ligs else missing.append(n))
if missing:  # Google Fonts silently ignores names that are not icons; so do we.
    print('Not icons in this font (skipped, as Google Fonts does): ' + ', '.join(missing))

opts = subset.Options()
opts.layout_features = ['liga', 'rlig', 'calt', 'ccmp']
opts.layout_closure = False   # keep only the requested ligature outputs
opts.flavor = 'woff2'
opts.notdef_outline = True
sub = subset.Subsetter(opts)
sub.populate(text='abcdefghijklmnopqrstuvwxyz0123456789_', glyphs=targets)
sub.subset(font)
out = root / 'public/fonts/material-symbols-outlined-subset.woff2'
subset.save_font(font, str(out), opts)
print(f'{len(names)} icons -> {out.relative_to(root)} ({out.stat().st_size:,} bytes)')
