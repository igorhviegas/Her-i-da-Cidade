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

A política completa continua em `Report-Only` até alguém abrir o site e o `/admin` e conferir que nada é bloqueado. O Tailwind agora é **compilado no build** (`tailwind.config.js`, `postcss.config.js`, `index.css`); o script `cdn.tailwindcss.com` foi removido do `index.html` e o `script-src` ficou só `'self'` (o único `<script>` inline é o JSON-LD, que não é executado). Passos que faltam:

1. Abrir o site, o `/admin` e as páginas públicas (`/agendar-chamada`, `/clientes`, `/kart`, `/agente-hdc`) com o console aberto e conferir que não aparece `[Report Only]`.
2. Trocar o nome do cabeçalho para `Content-Security-Policy`.

### Tailwind compilado: o que mudou para quem edita o código

- O build só enxerga nomes de classe **escritos por inteiro** no código (`bg-red-500`). Classe montada por pedaços (`` `bg-${cor}-500` ``) não é gerada: escreva o nome completo ou use `safelist` em `tailwind.config.js`. Uma varredura em 394 arquivos não achou nenhum caso hoje.
- Classe que não existe no Tailwind não faz nada (hoje: `contrast-110`, `hover:scale-115`, `perspective-1000` e o breakpoint `xs:`), igual ao que já acontecia com o CDN.

Ao incluir um serviço externo novo (embed, analytics, fonte), acrescente o domínio na diretiva certa (`script-src`, `connect-src`, `img-src`, `frame-src`...).

O Cloudflare Turnstile do agendamento (`https://challenges.cloudflare.com`, ver `docs/agendamento-chamadas.md`) já está em `script-src`, `frame-src` e `connect-src` da política completa.
