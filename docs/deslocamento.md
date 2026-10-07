# Deslocamento dos eventos (área do agente)

Em `/agente-hdc` → **Deslocamento**: o agente informa os endereços dos eventos e a ferramenta calcula os km de cada trecho no Google Maps,
multiplica pelo valor por km, soma o cachê de cada evento e gera um texto pronto para o WhatsApp.

## Como funciona

Rota: `partida → [parada] → evento 1 → … → evento N → [parada] → destino final`. A parada é opcional (padrão / sem parada / outra).
Partida, parada e destino padrão ficam **só no servidor** (variáveis de ambiente); o navegador só vê rótulos. O agente pode trocar qualquer um
deles para um cálculo específico sem alterar o padrão.

- `Custo de deslocamento = km total × valor por km` (padrão R$ 1,90, editável na tela e lembrado no aparelho).
- `Total = deslocamento + (eventos × cachê)` (cachê padrão R$ 115,00, também editável).
- O total de km é a **soma dos trechos como aparecem na tela** (cada trecho arredondado a 0,1 km), então a conta confere de cabeça.
- Os trechos e os endereços entendidos pelo mapa aparecem **antes** do valor. Se o Google não achou o número exato de algum endereço
  (correspondência parcial ou aproximada), o valor só aparece depois de o agente tocar em "Conferi, mostrar valor".
- Endereço não encontrado ou rota indisponível: erro apontando o ponto, sem valor.
- A ordem dos eventos é a digitada (setas de subir/descer); o Google nunca reordena. Limite de 8 eventos por cálculo.
- Qualquer alteração na tela apaga o resultado anterior; o valor mostrado sempre corresponde ao que está preenchido.
- Nada é gravado no Firestore. O rascunho (código, eventos, valores) fica no `localStorage` do aparelho (`hdc.agente.deslocamento.v1`).
- O Google pode sugerir um trajeto diferente do aplicativo do agente; a tela avisa e mostra todos os trechos usados.

## Segurança

- `POST /api/travel-route` é público, mas exige o **código de acesso** no header `x-travel-code` (comparação em tempo constante).
  Sem código válido nada é enviado ao Google e o número do WhatsApp não é revelado.
- A chave do Google fica só no servidor (`GOOGLE_MAPS_API_KEY`, sem prefixo `VITE_`). Nunca vai para o navegador.
- Chaves de servidor não podem ser restritas por site nem por IP na Vercel; a proteção é restringir por **API** e limitar a **cota diária** (tutorial abaixo).
- Endereços padrão, número do WhatsApp e código ficam só nas variáveis de ambiente da Vercel. Não escreva esses valores em código, docs ou commits.

## Arquivos

| Arquivo | Papel |
|---|---|
| `services/travelCost.js` | Regras puras: validação, sequência da rota, soma, valores, texto do WhatsApp |
| `functions/travel-route.js` | Geocoding API + Routes API (uma chamada de rota por cálculo), erros, resolução dos padrões |
| `api/travel-route.ts` | Endpoint (código de acesso, validação, mapeamento de erros); registrado em `server.ts` |
| `services/travelService.ts` | Chamada do navegador ao endpoint |
| `components/agente/TravelCalculator.tsx` | Tela (botão "Deslocamento" na Home do agente) |

Testes: `services/travelCost.test.js`, `functions/travel-route.test.js`, `tests/api-travel-route.test.js` (`npm test`, sem chamar o Google).

## Custo

Cada cálculo = 1 chamada à Routes API (faixa Essentials, sem trânsito em tempo real) + 1 chamada à Geocoding API por endereço **distinto**
(parada repetida conta uma vez). Para N eventos com os padrões: N + 2 geocodificações + 1 rota (ou N + 1 sem parada).
A Google dá 10.000 eventos grátis por mês em cada produto (confirme na [tabela de preços](https://developers.google.com/maps/billing-and-pricing/pricing)).
Com até 6 eventos por semana, o uso fica muito abaixo disso.

---

# Tutorial: o que você precisa fazer (uma vez)

Isto não dá para fazer pelo código: exige a sua conta Google e a Vercel. Tempo estimado: 20 a 30 minutos.
Os nomes dos menus do Google Cloud mudam de vez em quando; se algo estiver com outro nome, procure pelo termo em negrito.

## Parte 1 — Google Cloud

1. Acesse <https://console.cloud.google.com/> com a conta que administra o projeto. Pode usar o **mesmo projeto do Firebase** do site
   (seletor de projeto no topo da página) ou criar um novo chamado, por exemplo, `heroi-da-cidade-mapas`.
2. **Ative o faturamento** do projeto: menu ☰ → **Faturamento**. O Google exige um cartão para liberar a Maps Platform, mesmo com uso gratuito.
   Com o volume previsto não deve haver cobrança, e o passo 7 coloca um alerta.
3. Ative as duas APIs: menu ☰ → **APIs e serviços** → **Biblioteca**. Pesquise e clique em **Ativar** em cada uma:
   - **Geocoding API**
   - **Routes API** (não confunda com *Directions API*, que é a versão antiga)
4. Crie a chave: **APIs e serviços** → **Credenciais** → **Criar credenciais** → **Chave de API**. Copie a chave e guarde em local seguro
   (ela será colada na Vercel no passo 10; não mande por WhatsApp nem e-mail).
5. Restrinja a chave: ainda em **Credenciais**, clique na chave criada → **Restrições de API** → **Restringir chave** →
   marque somente **Geocoding API** e **Routes API** → **Salvar**.
   Em "Restrições de aplicativo" deixe **Nenhuma** (a Vercel não tem IP fixo, então restringir por IP quebraria a ferramenta).
6. Limite a cota diária (é isso que impede surpresas se o código de acesso vazar): **APIs e serviços** → **APIs ativadas e serviços** →
   clique em **Routes API** → aba **Cotas e limites do sistema**. Localize a cota por dia de **Compute Routes** (ou "Compute Routes requests per day"),
   clique no lápis e defina algo como **100**. Repita em **Geocoding API** (requests per day) com **300**.
   Para 6 eventos por semana isso sobra: um cálculo usa cerca de 1 rota e 3 a 8 geocodificações.
7. Crie um alerta de orçamento: ☰ → **Faturamento** → **Orçamentos e alertas** → **Criar orçamento** → valor de **US$ 5** por mês →
   mantenha os alertas padrão (50%, 90%, 100%) com o seu e-mail.

## Parte 2 — Gerar o código de acesso

Este código é o que o agente digita uma vez no celular. Gere um aleatório no terminal do projeto:

```bash
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

Copie o resultado (32 caracteres). Guarde-o também em um gerenciador de senhas para poder passar ao agente.

## Parte 3 — Vercel

1. Acesse <https://vercel.com/>, abra o projeto do site → **Settings** → **Environment Variables**.
2. Crie as variáveis abaixo (para **Production**; marque também **Preview** se quiser testar nos previews). Nenhuma leva prefixo `VITE_`:

   | Nome | Valor | Obrigatória |
   |---|---|---|
   | `GOOGLE_MAPS_API_KEY` | a chave da Parte 1 | sim |
   | `TRAVEL_ACCESS_CODE` | o código da Parte 2 | sim |
   | `TRAVEL_START_ADDRESS` | endereço de partida padrão, completo: rua, número, bairro, cidade e UF | sim |
   | `TRAVEL_STOP_ADDRESS` | endereço da parada padrão, no mesmo formato | não (sem ela só funciona "Sem parada" ou "Outra") |
   | `TRAVEL_END_ADDRESS` | destino final padrão | não (vazio = igual à partida) |
   | `TRAVEL_START_LABEL` | nome que aparece nos trechos, ex.: Casa do Vitor | não (padrão "Ponto de partida") |
   | `TRAVEL_STOP_LABEL` | nome da parada, ex.: Minha casa | não (padrão "Parada") |
   | `TRAVEL_END_LABEL` | nome do destino | não (padrão = rótulo da partida, ou "Destino final") |
   | `TRAVEL_WHATSAPP_NUMBER` | número que recebe o texto, com DDD (ex.: 31 9XXXX-XXXX) | não (sem ele só aparece "Copiar texto") |

   Dica de endereço: quanto mais completo (com bairro e cidade), mais precisa a localização. Se tiver dúvida, cole o mesmo texto no Google Maps
   e confira se ele acha o ponto exato.
3. **Redeploy**: variáveis novas só valem em deploys novos. Em **Deployments**, abra o último deploy → **⋯** → **Redeploy**
   (ou faça um novo deploy pelo merge desta mudança).

## Parte 4 — Testar

1. Abra `https://SEU-SITE/agente-hdc` no celular → **Deslocamento**.
2. Digite o código de acesso (Parte 2) → **Salvar código**.
3. Informe um evento com endereço completo → **Calcular**. Confira: os trechos, o endereço que o mapa entendeu e o valor.
4. Compare o total de km com o que o Google Maps mostra para a mesma sequência de pontos (pode haver pequena diferença se o trajeto sugerido mudar).
5. Toque em **Copiar texto** e cole no WhatsApp para ver a mensagem; o botão **WhatsApp** abre a conversa com o texto preenchido.

## Se algo der errado

| Mensagem na tela | Causa provável |
|---|---|
| "O cálculo de deslocamento ainda não foi configurado no servidor" | Falta `GOOGLE_MAPS_API_KEY`, `TRAVEL_ACCESS_CODE` ou `TRAVEL_START_ADDRESS`, ou faltou o redeploy |
| "Código de acesso inválido" | Código diferente do `TRAVEL_ACCESS_CODE` (a tela pede de novo) |
| "O Google recusou a chave" | Chave errada, APIs não ativadas, faturamento desativado, ou chave restrita a outras APIs (veja os logs da Vercel: o motivo do Google aparece lá, nunca na tela) |
| "O limite diário … foi atingido" | A cota diária da Parte 1, passo 6 foi alcançada; aumente-a ou espere o dia seguinte |
| "Não encontrei o endereço de Evento N" | Endereço incompleto ou com erro; inclua rua, número, bairro e cidade |
| "A parada padrão não está configurada" | Falta `TRAVEL_STOP_ADDRESS`; use "Sem parada" ou "Outra" |

## Rodar localmente

O `npm run dev` não lê um arquivo `.env` para estas variáveis; defina-as no terminal antes de iniciar (exemplo no PowerShell):

```powershell
$env:GOOGLE_MAPS_API_KEY = "..."; $env:TRAVEL_ACCESS_CODE = "..."; $env:TRAVEL_START_ADDRESS = "..."; npm run dev
```

## Trocar o código ou os endereços depois

Altere a variável na Vercel e faça um **Redeploy**. Se trocar o código, o aparelho do agente receberá "Código de acesso inválido" e pedirá o novo.
