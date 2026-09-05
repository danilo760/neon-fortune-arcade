# Refinar a apresentação do Olympus Storm

## Escopo
- Alterar somente os arquivos autorizados do Olympus Storm.
- Manter `src/lib/arcade/olympusStormMath.ts` byte a byte intacto e reconfirmar seu blob SHA ao final.
- Não tocar em lógica de resultado, saldo, apostas, Feature Buy, frequências ou outros jogos.

## Implementação
1. Adicionar o controle global de som no topo esquerdo do gabinete, com ícones, acessibilidade e área quadrada responsiva.
2. Corrigir o botão SPIN para largura percentual com `aspect-ratio: 1`, reposicioná-lo dentro do gabinete e mover seu halo para uma camada interna animada por opacity/transform.
3. Aplicar feedback tátil visual curto aos controles pedidos, sem alterar travas ou handlers funcionais.
4. Refinar os estados de Zeus e o raio localizado, sem flash de tela inteira e com impacto contido na grade.
5. Separar a apresentação do Storm Hit em `stormHit` e `stormImpact`, preservando exatamente o tempo total atual; exibir e tocar o multiplicador apenas na segunda fase.
6. Tornar o HUD do bônus mais legível e compacto e ajustar o modal para 360×800 com botões confortáveis.
7. Ajustar somente os timbres já existentes do Olympus, preservando os eventos e a arquitetura de áudio.
8. Ampliar o tratamento de movimento reduzido para os novos efeitos decorativos.

## Verificação
- Conferir visual e hitboxes em 360×800, 390×844 e 430×932.
- Executar `npm test -- --run`, `npm run typecheck`, `npm run build` e `git diff --check`.
- Confirmar que apenas arquivos permitidos mudaram e que o hash protegido continua `35b794b1014eae09d9f5f53b6a2487dcc432e1ac`.
- Criar o único commit `feat: polish olympus storm presentation` após todos os gates passarem.
