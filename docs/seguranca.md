# Segurança

## Cabeçalhos HTTP (`vercel.json`)

Valem para todas as rotas, inclusive `/api`.

| Cabeçalho | Valor | Para quê |
| --- | --- | --- |
| `X-Content-Type-Options` | `nosniff` | o navegador não "adivinha" o tipo do arquivo |
| `X-Frame-Options` / CSP `frame-ancestors` | `DENY` / `'none'` | ninguém embute o site (nem o `/admin`) em iframe: clickjacking |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | URLs com caminho não vazam para sites externos |
| `Permissions-Policy` | câmera, microfone, localização, pagamento e USB desligados | o site não usa nenhum deles |
| `Content-Security-Policy` | `frame-ancestors 'none'; base-uri 'self'; object-src 'none'` | só o que não afeta carregamento de recursos |
| `Content-Security-Policy-Report-Only` | política completa | só registra violações no console; **não bloqueia nada** |

O HSTS já vem da própria Vercel.

### Como ligar a CSP completa

A política completa está em `Report-Only` porque `index.html` ainda carrega o Tailwind por `cdn.tailwindcss.com`, que exige `'unsafe-inline'` e libera um script de terceiro. Passos:

1. Compilar o Tailwind no build do Vite (sem o `<script>` do CDN).
2. Remover `'unsafe-inline'` e `https://cdn.tailwindcss.com` do `script-src`.
3. Abrir o site (e o `/admin`) com o console aberto e conferir que não aparece `[Report Only]`.
4. Trocar o nome do cabeçalho para `Content-Security-Policy`.

Ao incluir um serviço externo novo (embed, analytics, fonte), acrescente o domínio na diretiva certa (`script-src`, `connect-src`, `img-src`, `frame-src`...).
