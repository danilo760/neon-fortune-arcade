from pathlib import Path

TSX = Path('src/components/arcade/GoldenTigerReference.tsx')
CSS = Path('src/components/arcade/GoldenTigerReference.css')

text = TSX.read_text()
text = text.replace(
    '  useEffect,\n  useRef,\n  useState,',
    '  memo,\n  useEffect,\n  useMemo,\n  useRef,\n  useState,',
    1,
)
text = text.replace(
    'function ReferenceSymbol({ id, src }: { id: GoldenTigerSymbolId; src: string }) {',
    'const ReferenceSymbol = memo(function ReferenceSymbol({ id, src }: { id: GoldenTigerSymbolId; src: string }) {',
    1,
)
needle = '''  );\n}\n\nfunction NumberPatch'''
replacement = '''  );\n});\n\nfunction NumberPatch'''
if needle not in text:
    raise SystemExit('ReferenceSymbol closing marker not found')
text = text.replace(needle, replacement, 1)

state_marker = '  const currentTierLabel = tierLabel(winTier);\n'
state_insert = '''  const scatterOrderByIndex = useMemo(() => {\n    const ordered = [...scatters].sort((a, b) => a - b);\n    return new Map(ordered.map((index, order) => [index, order]));\n  }, [scatters]);\n  const currentTierLabel = tierLabel(winTier);\n'''
if state_marker not in text:
    raise SystemExit('tier marker not found')
text = text.replace(state_marker, state_insert, 1)

text = text.replace(
    'className="absolute left-[6.7%] top-[32.53%] z-20 grid h-[31.4%] w-[85.1%] grid-cols-5 grid-rows-3 overflow-hidden"',
    'className="gt-ref-grid absolute left-[6.7%] top-[32.53%] z-20 grid h-[31.4%] w-[85.1%] grid-cols-5 grid-rows-3 overflow-hidden"',
    1,
)
old = '''              const scatterOrder = scatters.has(index)\n                ? [...scatters].sort((a, b) => a - b).indexOf(index)\n                : -1;'''
new = '''              const scatterOrder = scatterOrderByIndex.get(index) ?? -1;'''
if old not in text:
    raise SystemExit('scatter order marker not found')
text = text.replace(old, new, 1)
TSX.write_text(text)

css = CSS.read_text()
rule = '\n.gt-ref-grid { contain: layout paint; }\n'
if rule.strip() not in css:
    css = rule + css
CSS.write_text(css)
