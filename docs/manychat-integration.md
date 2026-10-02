# Integração ManyChat → CRM (External Request)

Um único endpoint recebe a confirmação de pagamento de **todos** os serviços. O serviço é identificado pelo campo `service` do corpo JSON. O ManyChat só deve chamar o endpoint depois que a equipe confirmar o pagamento manualmente.

## Endpoint, método e headers

| Item | Valor |
|---|---|
| Método | `POST` |
| URL (Vercel) | `https://<domínio-do-site>/api/manychat` |
| URL (Firebase Functions) | `https://us-central1-heroi-da-cidade.cloudfunctions.net/receiveManyChatOrder` (projeto `heroi-da-cidade`) |
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

## Serviços, modalidades e preços

| Serviço | `service` | Preço | `childName` | Outros campos |
|---|---|---|---|---|
| Vídeo Especial de Aniversário | `birthday-video` | R$ 30, lido do catálogo | **obrigatório** | — |
| Vídeo Temático | `themed-video` | R$ 20, lido do catálogo | **obrigatório** | — |
| Vídeo Personalizado | `custom-video` | pela modalidade (tabela abaixo) | opcional | `modality` **obrigatório**; `details` e `eventDate` opcionais |
| Vídeo Convite | `invite-video` | pela modalidade (tabela abaixo) | opcional | `modality` **obrigatório**; `details` e `eventDate` opcionais |
| Vídeo Chamada ao Vivo | `live-call` | **R$ 75,00 fixo** | opcional | `details` opcional. **Sem data de agendamento** |

O ManyChat **não envia preço** nos serviços de Personalizado, Convite e Chamada ao Vivo: o CRM calcula o valor.

### Modalidade (`modality`) — Personalizado e Convite

| `modality` | Prazo contratado | Vídeo Personalizado | Vídeo Convite |
|---|---|---:|---:|
| `7_days` | 7 dias | R$ 60,00 | R$ 65,00 |
| `4_days` | 4 dias | R$ 75,00 | R$ 80,00 |
| `2_days` | 2 dias | R$ 85,00 | R$ 95,00 |

Valores diferentes dos três acima (inclusive `7`, `"7 dias"`, `"7_DAYS"`) são rejeitados com `400` e nada é criado.

O pedido grava `servicePrice` e `totalPaid` com o preço da tabela (taxa de urgência `0`; a diferença entre as modalidades já está no preço) e `deliveryDays` com o prazo da modalidade. O prazo da modalidade **substitui** o "Prazo de entrega" padrão do serviço em Admin → Serviços. Os prazos do cliente e interno são calculados a partir da data do pagamento (interno = prazo do cliente − 1 dia).

Serviços sem modalidade (Aniversário, Temático e Chamada ao Vivo) usam o "Prazo de entrega" padrão do serviço, se houver um configurado.

### Tipos dos campos específicos

- `childName`: string, até 100 caracteres.
- `details`: string, até 1000 caracteres (observações do pedido).
- `modality`: `"7_days"`, `"4_days"` ou `"2_days"`.
- `eventDate`: `YYYY-MM-DD` (gravada às 12:00 de Brasília) ou data/hora ISO 8601 com fuso (`2026-11-21T16:30:00-03:00`). Só Personalizado e Convite.

### Campos que NÃO devem mais ser enviados

| Campo | Onde |
|---|---|
| `amountPaid` | Todos os serviços. O preço vem do catálogo, da tabela de modalidades ou do valor fixo. Enviá-lo gera `400`. |
| `eventDate` | `live-call`. A Chamada ao Vivo não exige agendamento; enviá-lo gera `400`. |
| `modality` | `birthday-video`, `themed-video`, `live-call`. |

### Como o pedido aparece no CRM

- Cliente: criado ou reaproveitado pelo WhatsApp.
- Data do pagamento (`paidAt`): o momento em que o CRM recebe a requisição (para a Chamada ao Vivo, é a única data registrada).
- `Aniversariante: <childName>` e `Detalhes: <details>` vão no conteúdo do pedido; sem nenhum dos dois, o conteúdo fica "Pedido recebido via ManyChat.".
- **Status inicial, tipo de produção e prazo padrão vêm da configuração do serviço** (Admin → Serviços → "Configuração de Pedido"), igual ao cadastro manual. Nada é forçado no código: um serviço imediato configurado como "Entregar" nasce em Entregar; configurado como "Concluído", nasce concluído. "Concluir automaticamente" só é usado como alternativa se nenhum status inicial estiver configurado.
- Se o serviço estiver inativo, sem "Gerar pedido no CRM", sem tipo de produção ou sem status inicial, a resposta é `422` e nada é criado.
- Origem do pedido: `manychat`.

## Exemplos de payload

Vídeo Especial de Aniversário:
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

Vídeo Personalizado (7 dias, R$ 60,00):
```json
{ "eventType": "payment.paid", "service": "custom-video",
  "customer": { "name": "Maria Silva", "whatsapp": "+55 31 99999-0000" },
  "modality": "7_days", "childName": "Davi",
  "details": "Incentivar a escovar os dentes", "eventDate": "2026-11-10" }
```

Vídeo Convite (2 dias, R$ 95,00), só com os campos obrigatórios:
```json
{ "eventType": "payment.paid", "service": "invite-video",
  "customer": { "name": "Maria Silva", "whatsapp": "+55 31 99999-0000" },
  "modality": "2_days" }
```

Vídeo Chamada ao Vivo (R$ 75,00, sem data):
```json
{ "eventType": "payment.paid", "service": "live-call",
  "customer": { "name": "Maria Silva", "whatsapp": "+55 31 99999-0000" },
  "childName": "Lia", "details": "Conversar sobre o aniversário" }
```

Contrato antigo do Aniversário (sem `service`; ainda aceito):
```json
{ "eventType": "payment.paid",
  "customer": { "name": "Maria Silva", "whatsapp": "+55 31 99999-0000" },
  "childName": "Lucas" }
```

## Configurar os campos no ManyChat

No ManyChat, o corpo do External Request é montado com campos personalizados (*Custom User Fields*) e do sistema:

1. **`service`**: texto fixo por fluxo (um External Request por serviço, ou um campo preenchido pelo fluxo). Use exatamente os identificadores da tabela.
2. **`modality`** (Personalizado e Convite): crie o campo personalizado de texto `modalidade` e preencha-o no fluxo com exatamente `7_days`, `4_days` ou `2_days` conforme a opção contratada. **Não monte `modality` a partir de texto digitado pelo cliente.**
3. `childName` e `details` vêm de campos personalizados. Para campos opcionais ainda vazios, **não inclua a chave** no JSON (evite enviar o texto de uma variável vazia).
4. Remova do corpo `amountPaid` e, na Chamada ao Vivo, `eventDate`.
5. Envolva todos os valores em aspas: o CRM só aceita texto.
6. Header `Authorization: Bearer <segredo>` e `Content-Type: application/json`.

## Requisições repetidas

**Não há deduplicação.** O ManyChat não fornece um identificador único por pedido ou pagamento, então cada chamada aceita cria um novo pedido. Em caso de timeout ou erro, confira o CRM antes de reenviar. Se aparecer um pedido duplicado, ele deve ser identificado e removido manualmente no CRM (o cliente é reaproveitado pelo WhatsApp, então só o pedido precisa ser removido).

## Respostas

Sucesso (`200`):
```json
{ "ok": true, "orderId": "<id>", "technicalPurchaseId": "<id>" }
```

Erro de validação (`400`), por exemplo modalidade inválida:
```json
{ "ok": false, "error": { "code": "validation_error", "message": "Revise os campos da requisição." },
  "details": ["modality é obrigatório e deve ser um destes valores: 7_days, 4_days, 2_days."] }
```

| HTTP | `error.code` | Quando |
|---|---|---|
| 400 | `validation_error` | Campo ausente, inválido ou não aceito (`details` lista cada problema), incluindo `modality` inválida. |
| 401 | `unauthorized` | Header `Authorization` ausente ou errado. |
| 405 / 413 / 415 | `method_not_allowed` / `payload_too_large` / `unsupported_media_type` | Método, tamanho ou tipo inválido. |
| 409 | `invalid_client_index` / `ambiguous_client` | Cadastro de WhatsApp inconsistente ou duplicado; resolver no CRM. |
| 422 | `service_not_found` / `service_configuration_changed` / `service_price_unavailable` | Serviço inexistente, não configurado para gerar pedidos (inativo, sem "Gerar pedido", sem tipo de produção ou sem status inicial) ou preço de catálogo ilegível (só Aniversário e Temático). |
| 500 | `internal_error` / `server_misconfigured` / `database_unavailable` | Falha do servidor. Confira o CRM antes de repetir. |

O ManyChat trata respostas diferentes de 200 como falha e não exibe o texto do erro; use os logs do servidor para diagnosticar.

## Conferência manual em Admin → Serviços (antes de ligar o ManyChat)

O CRM não pode ser conferido a partir do código. Em cada serviço abaixo, abra Admin → Serviços → editar → "Configuração de Pedido" e confirme:

| Serviço (ID) | Ativo | Gerar pedido | Tipo de produção | Status inicial |
|---|---|---|---|---|
| Vídeo Especial de Aniversário (`1`) | sim | sim | Imediato | **Entregar** |
| Vídeo Chamada ao Vivo (`2`) | sim | sim | conforme a operação (ex.: Agendado) | conforme a operação (ex.: Agendado) |
| Vídeo Personalizado (`3`) | sim | sim | Gravação | Gravar |
| Vídeo Convite (`4`) | sim | sim | Gravação | Gravar |
| Vídeo Temático (`5`) | sim | sim | Imediato | **Entregar** |

O título precisa continuar igual ao nome da tabela (sem diferença de acento ou caixa). Serviços que hoje estão como "Concluído" por causa da regra antiga **precisam ser alterados para Entregar**: o CRM agora respeita o que está salvo.
