# obabayaga.com

Site estático do streamer **O BABA YAGA**, publicado via GitHub Pages com domínio próprio (`CNAME`).

## Estrutura

| Ficheiro | Função |
|---|---|
| `index.html` | Página inicial: stream, ticker, patrocínios, redes sociais |
| `jogos.html` + `games.js` | Blackjack, Dados e Minas com fichas virtuais |
| `ranking.html` | Pontos pessoais (com login Twitch) e top da comunidade (StreamElements) |
| `loja.html` | Link para a loja StreamElements |
| `contacto.html` | Email e Instagram para parcerias |
| `termos.html`, `privacidade.html` | Páginas legais |
| `404.html` | Página de erro do GitHub Pages |
| `script.js` | Verificação de idade, popup, navegação, estado da stream |
| `twitch-auth.js` | Login com Twitch (Implicit Grant) + pontos StreamElements |
| `assets/` | Favicon, imagem Open Graph, banners |
| `robots.txt`, `sitemap.xml` | SEO |

## Depois de publicar

1. Em **Settings → Pages** do repositório confirma que **Enforce HTTPS** está ativo.
2. No DNS, garante que `www.obabayaga.com` redireciona para `obabayaga.com` (o login Twitch só aceita o URL registado em `REDIRECT_URI`).
3. Submete o `sitemap.xml` no [Google Search Console](https://search.google.com/search-console).
4. Se mudares a imagem de perfil na Twitch, atualiza o logo nas páginas (está a usar o URL da CDN da Twitch) — o ideal é guardar uma cópia em `assets/logo.png` e apontar para lá.

## Quando alterares scripts

Sobe o número de versão nos `<script src="...?v=N">` de todas as páginas para forçar o refresh da cache.
