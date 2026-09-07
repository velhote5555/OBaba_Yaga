# obabayaga.com

Site estático do streamer **O BABA YAGA**, publicado via GitHub Pages com domínio próprio (`CNAME`).
Layout v2: barra lateral, chat da comunidade (Twitch) e cartões de oferta com dados.

## Ficheiros

| Ficheiro | Função |
|---|---|
| `index.html` | Início: stream, ticker, ofertas em destaque, horário, loja, comunidade |
| `casinos.html` | Todas as ofertas, com filtros e pesquisa |
| `comunidade.html`, `ranking.html`, `loja.html`, `jogos.html`, `contacto.html` | Restantes páginas |
| `termos.html`, `privacidade.html`, `cookies.html` | Documentos legais |
| `404.html`, `robots.txt`, `sitemap.xml` | GitHub Pages / SEO |
| `script.js` | Verificação de idade, popup, sidebar, chat, filtros, horário, estado da stream |
| `twitch-auth.js` | Login com Twitch + pontos/ranking StreamElements |
| `games.js` | Minijogos com fichas virtuais |
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
