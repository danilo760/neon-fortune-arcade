from pathlib import Path

path = Path('src/components/arcade/MinesGame.tsx')
text = path.read_text()
needle = 'import { playMinesSound } from "@/lib/arcade/minesSound";\n'
addition = needle + 'import { playSound } from "@/lib/arcade/sound";\n'
if needle in text and 'import { playSound } from "@/lib/arcade/sound";' not in text:
    text = text.replace(needle, addition, 1)
path.write_text(text)
