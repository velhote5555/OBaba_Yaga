# obabayaga.com

Site estático do streamer **O BABA YAGA**, publicado via GitHub Pages com domínio próprio (`CNAME`).
Layout v2: barra lateral, chat da comunidade (Twitch) e cartões de oferta com dados.

## Ficheiros

| Ficheiro | Função |
|---|---|
| `index.html` | Início: stream, ticker, ofertas em destaque, horário, loja, comunidade |
| `casinos.html` | Todas as ofertas, com filtros e pesquisa |
| `bonus-hunt.html` | Bonus hunt da comunidade: cada visitante faz a sua |
| `comunidade.html`, `ranking.html`, `loja.html`, `jogos.html`, `contacto.html` | Restantes páginas |
| `termos.html`, `privacidade.html`, `cookies.html` | Documentos legais |
| `404.html`, `robots.txt`, `sitemap.xml` | GitHub Pages / SEO |
| `script.js` | Verificação de idade, popup, sidebar, chat, filtros, horário, estado da stream |
| `twitch-auth.js` | Login com Twitch + pontos/ranking StreamElements |
| `games.js` | Minijogos com fichas virtuais |
| `hunt.js` | Bonus hunt: pesquisa, contas, guardar e link de partilha |
| `slots.js` | Base de dados de 9.259 slots (nome, provider, id da imagem) |
| `_build/` | Gerador das páginas (ver abaixo). Não é servido pelo site. |

## Como editar

- **Ofertas** (bónus, códigos, licença, depósito mínimo, métodos de pagamento): `_build/offers.py`.
- **Horário das lives**: constante `SCHEDULE` no topo da secção "Horário" em `script.js`.
- **Textos legais**: `_build/legal.py`.
- **Menu, rodapé, popup**: `_build/build.py`.

Depois de editar os ficheiros em `_build/`, corre `python3 _build/build.py` na raiz para regenerar os HTML.
(Se não quiseres usar Python, podes editar os `.html` diretamente — mas o menu e o rodapé estão repetidos em todas as páginas.)

## Depois de publicar

1. **Settings → Pages**: confirma que *Enforce HTTPS* está ativo.
2. DNS: `www.obabayaga.com` deve redirecionar para `obabayaga.com` (o login Twitch e o chat só aceitam os domínios registados).
3. Submete o `sitemap.xml` no Google Search Console.
4. Quando alterares scripts ou CSS, sobe o `VER` em `_build/build.py` (ou o `?v=` nos HTML) para forçar o refresh da cache.

## Tema (setembro 2026)

O design passou a acompanhar a overlay do OBS. Toda a cor vive no
`style.css`:

- `:root` no topo — a paleta. Ardósia azulada nos painéis, `--azul`
  `#4da3ff` como cor de ambiente e `--gold` `#f0c14b` reservado a
  dinheiro e chamadas à ação. (Atenção: antes o `--gold` era ciano.)
- Bloco **TEMA OVERLAY** no fim — a linguagem dos painéis: gradiente,
  contorno azul, risco de luz no topo, halo, cantos de 14px.

Fontes: **Inter** no texto e **JetBrains Mono** nos números, como na
overlay.

**Se voltares a correr `python3 _build/build.py`**, o `<head>` é
regerado e perdes três coisas que ficaram nos HTML: o link das Google
Fonts (Inter + JetBrains Mono, estava Sora), o `theme-color` `#080c13`
e o `?v=29`. Atualiza-as também no `_build/build.py` antes de correr o
gerador, senão o site volta à Sora e os visitantes ficam com o CSS
antigo em cache.

## Marcas (setembro 2026)

A Megapari saiu. A ordem passou a ser **SafeCasino → CaptainsBet →
22bit → Betlabel**, igual no `index.html` e no `casinos.html`.

Na página inicial as ofertas passaram a ser a primeira secção, antes do
hero com a stream, e a grelha passou a duas colunas a partir dos 900px
(com quatro marcas, três colunas deixavam a quarta sozinha).

O popup promocional foi retirado do `index.html`. O código dele
continua no `script.js` e não dá erro nenhum sem o HTML — para o trazer
de volta basta repor o bloco `<div id="promoPopup">`.

**Se correres o `_build/build.py`**: tens de tirar a Megapari do
`_build/offers.py` e pôr lá a ordem nova, senão ela volta. O mesmo para
a posição da secção de ofertas e para o popup, que são gerados pelo
`build.py`.

## Bonus Hunt (setembro 2026)

`bonus-hunt.html` + `hunt.js` + `slots.js`. Os visitantes fazem a sua
própria hunt: procuram a slot, metem a aposta, e depois o que cada
bónus pagou. Mostra breakeven, x médio, o x de que ainda precisam e o
lucro.

**Não há servidor.** A hunt vive em `localStorage`, na chave
`obaba_bonus_hunt`, no browser de quem a fez. Não sincroniza entre
dispositivos e desaparece se limparem os dados do site — está escrito
na página e na política de cookies.

**Partilha sem servidor:** o botão Partilhar mete a hunt inteira dentro
do endereço, em `bonus-hunt.html#h=...`. Só vão lá os ids das imagens
das slots, as apostas e os pagamentos; os nomes saem do `slots.js` ao
abrir. Uma hunt de 3 bónus dá um link de ~220 caracteres, uma de 20 dá
~900. O limite é de 60 bónus por hunt.

Quem abre um link desses vê um aviso de que está a ver a hunt de outra
pessoa, e a sua própria hunt não é tocada até carregar em "Ficar com
esta".

**Dependência externa:** as imagens das slots vêm de `imgxcut.com`, que
não é nosso. Se um dia bloquearem os pedidos vindos de obabayaga.com, a
ferramenta continua a funcionar mas sem capas.

**Se correres o `_build/build.py`:** a página nova e o link no menu
("Ferramentas → Bonus Hunt") têm de ser acrescentados ao `build.py`,
senão desaparecem. O `?v=` também subiu para 30.
