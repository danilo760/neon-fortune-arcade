from pathlib import Path

TSX = Path('src/components/arcade/CandyCascadeHQ.tsx')
CSS = Path('src/components/arcade/CandyCascadeReference.css')

text = TSX.read_text()
text = text.replace(
    'import { useCallback, useEffect, useRef, useState } from "react";',
    'import { memo, useCallback, useEffect, useRef, useState } from "react";',
    1,
)
text = text.replace(
    'function CandySymbol({ id }: { id: CandySymbolId }) {',
    'const CandySymbol = memo(function CandySymbol({ id }: { id: CandySymbolId }) {',
    1,
)
needle = '''  );\n}\n\nfunction BombOnGrid'''
replacement = '''  );\n});\n\nfunction BombOnGrid'''
if needle not in text:
    raise SystemExit('CandySymbol closing marker not found')
text = text.replace(needle, replacement, 1)
TSX.write_text(text)

css = CSS.read_text()
marker = '@import "./CandyCascadeOrchestration.css";\n'
rule = '\n.cc-grid { contain: layout paint; }\n'
if rule.strip() not in css:
    if marker not in css:
        raise SystemExit('Candy CSS import marker not found')
    css = css.replace(marker, marker + rule, 1)
CSS.write_text(css)

# Trigger validation after workflow registration.
