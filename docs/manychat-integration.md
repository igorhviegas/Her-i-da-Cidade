# Integração ManyChat → CRM (External Request)

Um único endpoint recebe a confirmação de pagamento de **todos** os serviços. O serviço é identificado pelo campo `service` do corpo JSON. O ManyChat só deve chamar o endpoint depois que a equipe confirmar o pagamento manualmente.

## Endpoint, método e headers

| Item | Valor |
|---|---|
| Método | `POST` |
| URL (Vercel) | `https://<domínio-do-site>/api/manychat` |
| URL (Firebase Functions) | `https://us-central1-<projeto>.cloudfunctions.net/receiveManyChatOrder` |
| `Content-Type` | `application/json` |
| `Authorization` | `Bearer <MANYCHAT_WEBHOOK_SECRET>` (o segredo fica nas variáveis do servidor; nunca no corpo, no código ou neste arquivo) |

Use apenas uma das duas URLs (a que estiver publicada). O limite do corpo é 256 KB e o ManyChat espera resposta em até 10 s.

## Campos comuns

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `eventType` | string | sim | Sempre `"payment.paid"`. |
| `service` | string | sim* | Identificador do serviço (tabela abaixo). *Se omitido, vale o contrato antigo do Vídeo Especial de Aniversário. |
| `customer.name` | string | sim | Nome do contato (até 120 caracteres). |
| `customer.whatsapp` | string | sim | Telefone brasileiro com DDD (`+55 31 99999-0000`, `31999990000`…). |

Qualquer campo fora da lista do serviço é rejeitado com `400`.

## Serviços

| Serviço | `service` | Preço | Nome da criança | Outros campos |
|---|---|---|---|---|
| Vídeo Especial de Aniversário | `birthday-video` | catálogo (R$ 30) | `childName` **obrigatório** | — |
| Vídeo Temático | `themed-video` | catálogo (R$ 20) | `childName` **obrigatório** | — |
| Vídeo Personalizado | `custom-video` | `amountPaid` **obrigatório** | `childName` opcional | `details` e `eventDate` opcionais |
| Vídeo Convite | `invite-video` | `amountPaid` **obrigatório** | `childName` opcional | `details` e `eventDate` opcionais |
| Vídeo Chamada ao Vivo | `live-call` | `amountPaid` **obrigatório** | `childName` opcional | `eventDate` **obrigatório**, `details` opcional |

Serviços Presenciais ("Sob consulta") e Missão Digital não fazem parte desta integração.

### Tipos dos campos específicos

- `childName`: string, até 100 caracteres.
- `details`: string, até 1000 caracteres (observações do pedido).
- `amountPaid`: valor pago em reais, maior que 0 e até 10000. Aceita número (`75`, `85.5`) ou texto (`"85,50"`). Só é aceito nos serviços de preço variável; nos de preço de catálogo é rejeitado.
- `eventDate`: `YYYY-MM-DD` (gravada às 12:00 de Brasília) ou data/hora ISO 8601 com fuso (`2026-11-21T16:30:00-03:00`).

### Como o pedido aparece no CRM

- Cliente: criado ou reaproveitado pelo WhatsApp.
- `Aniversariante: <childName>` e `Detalhes: <details>` vão no conteúdo do pedido; sem nenhum dos dois, o conteúdo fica "Pedido recebido via ManyChat.". Sem `childName`, o pedido e a mensagem de WhatsApp funcionam normalmente.
- Vídeo Especial de Aniversário e Vídeo Temático nascem em **Entregar**.
- Personalizado, Convite e Chamada ao Vivo usam o **status inicial, tipo de produção e prazo padrão configurados no serviço** (Admin → Serviços, "Gerar pedido"). Se o serviço estiver inativo, sem "Gerar pedido" ou sem status inicial, a resposta é `422` e nada é criado.
- Origem do pedido: `manychat`.

## Exemplos de payload

Vídeo Especial de Aniversário (formato original, ainda válido sem `service`):
```json
{ "eventType": "payment.paid", "service": "birthday-video",
  "customer": { "name": "Maria Silva", "whatsapp": "+55 31 99999-0000" },
  "childName": "Lucas" }
```

Vídeo Temático:
```json
{ "eventType": "payment.paid", "service": "themed-video",
  "customer": { "name": "Maria Silva", "whatsapp": "+55 31 99999-0000" },
  "childName": "Helena" }
```

Vídeo Personalizado:
```json
{ "eventType": "payment.paid", "service": "custom-video",
  "customer": { "name": "Maria Silva", "whatsapp": "+55 31 99999-0000" },
  "amountPaid": "85,50", "childName": "Davi",
  "details": "Incentivar a escovar os dentes", "eventDate": "2026-11-10" }
```

Vídeo Convite:
```json
{ "eventType": "payment.paid", "service": "invite-video",
  "customer": { "name": "Maria Silva", "whatsapp": "+55 31 99999-0000" },
  "amountPaid": 65, "childName": "Pedro", "eventDate": "2026-11-20" }
```

Vídeo Chamada ao Vivo:
```json
{ "eventType": "payment.paid", "service": "live-call",
  "customer": { "name": "Maria Silva", "whatsapp": "+55 31 99999-0000" },
  "amountPaid": 75, "eventDate": "2026-11-21T16:30:00-03:00" }
```

No ManyChat, `childName`, `details`, `amountPaid` e `eventDate` devem vir de campos personalizados. Para campos opcionais ainda inexistentes, simplesmente **não inclua a chave** (evite enviar o texto de uma variável vazia).

## Respostas

Sucesso (`200`):
```json
{ "ok": true, "orderId": "<id>", "technicalPurchaseId": "<id>" }
```

Erro: `{ "ok": false, "error": { "code": "...", "message": "..." }, "details": [ ... ] }`

| HTTP | `error.code` | Quando |
|---|---|---|
| 400 | `validation_error` | Campo ausente, inválido ou não aceito (`details` lista cada problema). |
| 401 | `unauthorized` | Header `Authorization` ausente ou errado. |
| 405 / 413 / 415 | `method_not_allowed` / `payload_too_large` / `unsupported_media_type` | Método, tamanho ou tipo inválido. |
| 409 | `invalid_client_index` / `ambiguous_client` | Cadastro de WhatsApp inconsistente ou duplicado; resolver no CRM. |
| 422 | `service_not_found` / `service_configuration_changed` / `service_price_unavailable` | Serviço inexistente, não configurado para gerar pedidos ou preço de catálogo ilegível. |
| 500 | `internal_error` / `server_misconfigured` / `database_unavailable` | Falha do servidor. **Confira o CRM antes de repetir.** |

O ManyChat trata respostas diferentes de 200 como falha e não exibe o texto do erro; use os logs do servidor para diagnosticar.

## Requisições repetidas

Não há deduplicação: cada chamada aceita cria um novo pedido (não existe ID de compra estável no ManyChat). Em caso de timeout ou erro, confira o CRM antes de reenviar.
