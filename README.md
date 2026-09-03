# Neon Fortune Arcade

Crie um novo projeto chamado Lucky Neon Arcade: um cassino/arcade PRIVADO, single-player e apenas para entretenimento pessoal, com moedas 100% fictícias. Não implementar dinheiro real, PIX, depósito, saque, checkout, prêmio real, cripto, wallet externa ou qualquer mecanismo de conversão financeira.

OBJETIVO DA PRIMEIRA VERSÃO
Criar um lobby mobile-first com visual premium de arcade/cassino asiático neon, escuro, dourado, roxo e vermelho, e 15 jogos no catálogo. Nesta primeira versão, 5 devem ser totalmente jogáveis e os outros 10 devem aparecer como cards com badge “Em breve”, mantendo a arquitetura pronta para ativá-los depois.

IMPORTANTE SOBRE PROPRIEDADE INTELECTUAL
Não copie nomes, logos, personagens, sons, artes, símbolos ou interface de jogos comerciais existentes. Use nomes e assets originais. Pode se inspirar apenas em gêneros/mecânicas comuns de slots e arcade.

SALDO FICTÍCIO

- Jogador começa com 1.000.000 moedas fictícias.
- Saldo salvo em localStorage.
- Botão “Recarregar moedas” restaura/adiciona moedas grátis ilimitadas.
- Mostrar claramente “MOEDAS FICTÍCIAS — SEM VALOR REAL”.
- Histórico local das últimas partidas.
- Botão para zerar/resetar progresso local.

LOBBY

- Header com logo textual Lucky Neon Arcade, saldo e botão de recarga.
- Banner principal animado.
- Categorias: Destaques, Slots, Arcade, Mesa, Favoritos.
- Busca por jogo.
- Cards grandes, premium e responsivos.
- Favoritar/desfavoritar jogos salvo localmente.
- Navegação mobile inferior: Início, Jogos, Favoritos, Histórico, Perfil.
- Desktop com sidebar ou header mais amplo.
- Sem overflow em 360x800, 390x844, 430x932, tablet e desktop.

CATÁLOGO DE 15 JOGOS
Jogáveis agora:

1. Golden Tiger — slot 3x3, tema tigre dourado, Wild, Free Spins e multiplicadores.
2. Olympus Storm — slot 6x5, tema mitologia/raios, cascata e multiplicadores.
3. Candy Cascade — slot 6x5, tema doces, cascatas e bombas multiplicadoras.
4. Neon Mines — grade de minas, escolha quantidade de minas, cashout fictício e revelação visual.
5. Neon Plinko — tabuleiro de pinos, escolha risco e valor fictício, bola com animação e multiplicador final.

Cards “Em breve”:

6. Dragon Fortune — slot.
7. Lucky Ox — slot.
8. Panda Gold — slot.
9. Classic 777 — slot clássico.
10. Pirate Treasure — slot aventura.
11. Rocket Crash — crash fictício.
12. Fortune Wheel — roda da fortuna.
13. Neon Dice — dados.
14. Royal Blackjack — blackjack simplificado.
15. Lucky Rabbit — slot.

REGRAS DOS 3 SLOTS JOGÁVEIS

- Criar um motor compartilhado de slot, configurável por jogo, em vez de duplicar lógica.
- Resultado deve ser gerado no momento do giro e depois apenas animado/revelado.
- Controles de aposta fictícia: 10, 50, 100, 500, 1.000, 5.000 e 10.000 moedas.
- Nunca permitir aposta maior que o saldo.
- Auto spin opcional com 10 giros, com botão de parar.
- Tabela de pagamentos acessível por modal.
- Mostrar ganho da rodada, multiplicador e saldo atualizado.
- Efeitos de vitória, partículas leves, glow e som opcional.
- Botão de som com estado persistido.
- Respeitar prefers-reduced-motion.
- Não usar matemática enganosa apresentada como RTP real/certificado. Se exibir estatística, rotular como “simulação fictícia”.

GOLDEN TIGER

- Grid 3x3.
- Símbolos originais: tigre, moeda, jade, sino, lanterna, bambu, Wild.
- 5 linhas simples.
- Free Spins: 3 símbolos bônus concedem 8 giros grátis.
- Multiplicadores ocasionais em vitórias.

OLYMPUS STORM

- Grid 6x5.
- Símbolos originais de mitologia: elmo, raio, cálice, anel, ampulheta, coroa.
- Pagamento por clusters/grupos de símbolos.
- Símbolos vencedores desaparecem e novos caem.
- Multiplicadores podem surgir na cascata.
- Não copiar visual, personagem ou nomenclatura de nenhum slot comercial.

CANDY CASCADE

- Grid 6x5.
- Símbolos originais de doces/frutas.
- Pagamento por grupos.
- Cascatas.
- Bombas multiplicadoras originais.
- Visual colorido mas consistente com o lobby neon.

NEON MINES

- Grade 5x5.
- Jogador escolhe de 1 a 10 minas.
- Aposta fictícia.
- Cada casa segura aumenta o multiplicador.
- Pode encerrar e coletar o ganho fictício.
- Ao acertar mina, perde somente a aposta fictícia da rodada.
- Botão “Nova rodada”.
- Mostrar minas apenas após fim/perda ou conforme revelação.

NEON PLINKO

- Tabuleiro animado com 12 a 16 linhas de pinos.
- Três níveis de risco: baixo, médio, alto.
- Aposta fictícia.
- Física visual convincente sem exigir engine pesada; pode usar canvas/CSS/JS.
- Multiplicadores nos slots inferiores.
- Saldo atualizado somente uma vez por queda.

ARQUITETURA

- React + TypeScript + Tailwind + shadcn/ui, padrão Lovable.
- Rotas limpas: /, /game/golden-tiger, /game/olympus-storm, /game/candy-cascade, /game/neon-mines, /game/neon-plinko.
- Componentes reutilizáveis para GameShell, BetControls, BalanceDisplay, GameCard, WinOverlay, SoundToggle, PaytableModal.
- Motor shared de RNG pseudoaleatório apenas para brincadeira local, com funções separadas e testáveis.
- Estado global leve para saldo, favoritos, som e histórico.
- Persistência em localStorage com validação defensiva.
- O saldo e os resultados da primeira versão continuam locais e fictícios. O Supabase fica
  preparado para login e sincronização opcional em uma fase posterior.

QUALIDADE

- TypeScript sem any desnecessário.
- Evitar componentes gigantes.
- Loading e error states quando aplicável.
- Acessibilidade de botões, foco e contraste.
- Design caprichado, não aparência genérica de dashboard SaaS.
- Microanimações suaves.
- Sem dependências pesadas desnecessárias.
- Sem conteúdo copiado de marcas existentes.

ENTREGA
Implemente a aplicação completa desta primeira versão, deixe os 5 jogos realmente jogáveis no preview, e os 10 restantes claramente marcados como “Em breve”. Faça uma revisão final de responsividade e de erros de runtime antes de concluir.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/9128b8cb-eb4e-42fa-a7f9-84698832cf2b).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Supabase

O projeto usa variáveis públicas do Vite. Copie `.env.example` para `.env.local` antes de ativar
recursos de login ou sincronização:

```sh
VITE_SUPABASE_URL=https://ohnqhggbmboaiqvfeisx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_LVqE_QX85CUPU3mYpdMpQw_0xOHfETF
```

Nunca coloque uma chave `sb_secret_...` ou `service_role` no frontend.
