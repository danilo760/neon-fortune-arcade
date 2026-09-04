from pathlib import Path

path = Path("src/components/arcade/OlympusStormReference.tsx")
text = path.read_text()

text = text.replace(
    'import { useCallback, useEffect, useRef, useState } from "react";',
    'import { memo, useCallback, useEffect, useRef, useState } from "react";',
    1,
)
text = text.replace(
    'function ReferenceSymbol({ id, src }: { id: OlympusSymbolId; src: string }) {',
    'const ReferenceSymbol = memo(function ReferenceSymbol({ id, src }: { id: OlympusSymbolId; src: string }) {',
    1,
)
text = text.replace(
    '\n}\n\nexport function OlympusStormReference() {',
    '\n});\n\nexport function OlympusStormReference() {',
    1,
)
text = text.replace('key={`${index}-${symbol}`}', 'key={index}', 1)
path.write_text(text)

css_path = Path("src/components/arcade/OlympusStormReference.css")
css = css_path.read_text()
if '.os-ref-grid { contain: layout paint; }' not in css:
    css = css.replace('@import "./OlympusStormOrchestration.css";\n', '@import "./OlympusStormOrchestration.css";\n\n.os-ref-grid { contain: layout paint; }\n', 1)
css_path.write_text(css)
