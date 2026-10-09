# Avaliações do Google no site

O carrossel da home mostra as avaliações **reais** do Google (nota, total e as até 5 mais relevantes com texto), lidas da Places API (New) por `GET /api/reviews` (`api/reviews.ts`, `functions/google-reviews.js`). Não há texto fixo nem gerado por IA: se a consulta falhar, o site esconde o carrossel e mostra só o link "Ver todas as avaliações no Google".

## Custo

- A resposta fica 24 h no cache da Vercel (`s-maxage=86400`, renova em segundo plano por até 7 dias), então o Google é consultado ~1x/dia (~30 chamadas/mês). Erros nunca entram no cache.
- A Places API (New) tem cota gratuita mensal por SKU (1.000 chamadas para a categoria Enterprise, a que traz nota e avaliações), mas **exige faturamento ativo** no projeto do Google Cloud. O projeto já o tem por causa do Deslocamento (`docs/deslocamento.md`). Confirme o SKU e a cota em Google Cloud → Faturamento, e defina uma **cota diária** (APIs e serviços → Places API (New) → Cotas, ex.: 50/dia) para travar qualquer surpresa.

## Ativar

1. Google Cloud (mesmo projeto do Deslocamento) → **APIs e serviços** → ativar **Places API (New)**.
2. Em **Credenciais**, abra a chave usada em `GOOGLE_MAPS_API_KEY` e inclua **Places API (New)** nas restrições de API (hoje só Geocoding e Routes).
3. Na Vercel (Production **e** Preview), crie `GOOGLE_PLACE_ID` e republique. O Place ID deste negócio, calculado do link do Maps, é `ChIJy3FDqKRFEAgRrjxdWLGX1Gk`; se `/api/reviews` responder 502 com `not_found` nos logs, pegue o ID correto na [ferramenta Place ID Finder](https://developers.google.com/maps/documentation/places/web-service/place-id) pesquisando "Homem Aranha Betim e BH | Herói da Cidade".
4. Abra `https://<domínio>/api/reviews`: deve vir `{ rating, count, url, reviews: [...] }`.

## Limites

- A API devolve no máximo **5** avaliações por consulta (as mais relevantes, escolhidas pelo Google); a nota e o total são do local inteiro.
- Sem `GOOGLE_PLACE_ID` ou sem chave, `/api/reviews` responde 503 e o site mostra só o link.
- Os logs da Vercel (`[Reviews] Google: <código>`) trazem o motivo: `auth` (chave sem a Places API ou inválida), `invalid_place` (Place ID malformado: cole só o ID, sem espaços nem URL), `not_found` (Place ID não existe), `rate_limited`, `api_error`, `unavailable`.
