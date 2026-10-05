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
| Vídeo Temático | `themed-video` | R$ 20, lido do catálogo | **obrigatório** | `theme` **obrigatório** |
| Vídeo Personalizado | `custom-video` | pela modalidade (tabela abaixo) | opcional | `modality` **obrigatório**; `details` e `eventDate` opcionais |
| Vídeo Convite | `invite-video` | pela modalidade (tabela abaixo) | opcional | `modality` **obrigatório**; `details` e `eventDate` opcionais |
| Vídeo Chamada ao Vivo | `live-call` | **R$ 75,00 fixo** | opcional | `details` opcional. **Sem data de agendamento** |
| Serviços Presenciais (evento) | `presential-event` | **sem valor** (definido depois no CRM) | **não aceito** | **nenhum**: só `customer`. Ver [Evento presencial](#evento-presencial-pedido-incompleto) |

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
- `theme`: string, até 100 caracteres (tema escolhido pelo cliente). Só Vídeo Temático; vai no conteúdo do pedido como `Tema: <theme>`.
- `details`: string, até 1000 caracteres (observações do pedido).
- `modality`: `"7_days"`, `"4_days"` ou `"2_days"`.
- `eventDate`: `YYYY-MM-DD` (gravada às 12:00 de Brasília) ou data/hora ISO 8601 com fuso (`2026-11-21T16:30:00-03:00`). Só Personalizado e Convite.

### Campos que NÃO devem mais ser enviados

| Campo | Onde |
|---|---|
| `amountPaid` | Todos os serviços. O preço vem do catálogo, da tabela de modalidades ou do valor fixo. Enviá-lo gera `400`. |
| `eventDate` | `live-call`. A Chamada ao Vivo não exige agendamento; enviá-lo gera `400`. |
| `modality` | `birthday-video`, `themed-video`, `live-call`. |
| `theme` | Todos, exceto `themed-video`. |

### Como o pedido aparece no CRM

- Cliente: criado ou reaproveitado pelo WhatsApp.
- Data do pagamento (`paidAt`): o momento em que o CRM recebe a requisição (para a Chamada ao Vivo, é a única data registrada).
- `Aniversariante: <childName>`, `Tema: <theme>` e `Detalhes: <details>` vão no conteúdo do pedido; sem nenhum dos dois, o conteúdo fica "Pedido recebido via ManyChat.".
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
  "childName": "Helena", "theme": "Frozen" }
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
3. `theme` (Vídeo Temático): campo personalizado de texto preenchido pelo cliente; é obrigatório.
4. `childName` e `details` vêm de campos personalizados. Para campos opcionais ainda vazios, **não inclua a chave** no JSON (evite enviar o texto de uma variável vazia).
5. Remova do corpo `amountPaid` e, na Chamada ao Vivo, `eventDate`.
6. Envolva todos os valores em aspas: o CRM só aceita texto.
7. Header `Authorization: Bearer <segredo>` e `Content-Type: application/json`.

## Evento presencial (pedido incompleto)

Para o serviço **Serviços Presenciais** (ID `6`, categoria Presencial) o ManyChat envia **somente o nome e o WhatsApp** da cliente. Todo o resto (nome da criança, data, horário, local, autorização de imagem, teia extra, valores, custo, observações e #formulário) é preenchido depois, na equipe, pelo formulário de evento do CRM.

Campos aceitos: `eventType` (`"payment.paid"`, o mesmo valor dos demais serviços; aqui significa "automação concluída"), `service` (`"presential-event"`), `customer.name` e `customer.whatsapp`. **Qualquer outro campo gera `400`** (`childName`, `eventDate`, `modality`, `amountPaid`, `details`…).

```json
{ "eventType": "payment.paid", "service": "presential-event",
  "customer": { "name": "Maria Silva", "whatsapp": "+55 31 99999-0000" } }
```

Sucesso (`200`), igual aos demais serviços:
```json
{ "ok": true, "orderId": "<id>", "technicalPurchaseId": "<id>" }
```

Obrigatórios: `eventType`, `service`, `customer.name` (até 120 caracteres) e `customer.whatsapp` (telefone brasileiro com DDD). Erros: os mesmos códigos da tabela de respostas (`400`, `401`, `422`…).

**O que acontece no CRM**
- Cria o pedido no Kanban com o status inicial configurado para o serviço (Admin → Serviços; tipo de produção e status inicial são obrigatórios, como nos demais). Se o serviço estiver configurado como **Concluído**, a resposta é `422` e nada é criado: evento presencial não nasce concluído.
- O pedido guarda cliente e WhatsApp (cliente criado ou reaproveitado pelo WhatsApp), `servicePrice`/`totalPaid` = 0 e a marca `eventDraft`. O card mostra "⚠ Dados do evento pendentes" e o botão **Completar cadastro**, que abre "Editar pedido" no formulário de evento, com nome e WhatsApp já preenchidos.
- **Nenhum lançamento financeiro é feito na criação.** A **entrada** é lançada quando o cadastro do evento é salvo pela primeira vez (valor de entrada do formulário, data = esse momento); salvar de novo não lança outra. A **2ª parcela** e a "Despesa evento" são lançadas na primeira conclusão, como nos eventos cadastrados manualmente (ver `docs/eventos.md`).
- Enquanto o cadastro não for completado, o pedido **não pode ser concluído** (o Kanban avisa e abre a edição; o servidor também recusa).
- Origem do pedido: `manychat`.

**Requisições repetidas (só este serviço):** para evitar pedido duplicado por reenvio, o mesmo WhatsApp **dentro de 10 minutos** devolve o pedido já criado (`200`, mesmo `orderId`, com `"duplicate": true`) em vez de criar outro. Passada a janela, ou se o pedido tiver sido excluído, uma nova chamada cria um pedido novo. A reserva fica na coleção `manychatRequests` (só o servidor acessa).

**Configurar no ManyChat:** um External Request `POST` com o corpo acima no final do fluxo (quando o cliente concluir a automação), mesmo `Authorization: Bearer <segredo>` e `Content-Type: application/json`. `service` é texto fixo `presential-event`; `customer.name` e `customer.whatsapp` vêm do nome e do telefone do contato; não inclua nenhum outro campo.

## Requisições repetidas

**Não há deduplicação** (exceto no evento presencial, acima). O ManyChat não fornece um identificador único por pedido ou pagamento, então cada chamada aceita cria um novo pedido. Em caso de timeout ou erro, confira o CRM antes de reenviar. Se aparecer um pedido duplicado, ele deve ser identificado e removido manualmente no CRM (o cliente é reaproveitado pelo WhatsApp, então só o pedido precisa ser removido).

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
| Serviços Presenciais (`6`) | sim | sim | conforme a operação (ex.: Agendado) | conforme a operação, **nunca Concluído** |

O título precisa continuar igual ao nome da tabela (sem diferença de acento ou caixa). Serviços que hoje estão como "Concluído" por causa da regra antiga **precisam ser alterados para Entregar**: o CRM agora respeita o que está salvo.

## Criar missão pelo WhatsApp (External Request)

Mesmo endpoint, mesmo `Authorization: Bearer <segredo>`; o evento é `mission.create`. A palavra-chave que inicia o fluxo fica só no ManyChat (o CRM não a conhece). O fluxo coleta título, descrição, prazo (ou "sem prazo") e dificuldade, e então chama:

```json
{ "eventType": "mission.create",
  "mission": { "title": "Comprar fantasia", "description": "Tamanho M", "dueDate": "2026-10-10", "difficulty": "3" } }
```

| Campo | Regra |
|---|---|
| `mission.title` | obrigatório, até 120 caracteres |
| `mission.description` | opcional, até 1000 caracteres |
| `mission.dueDate` | opcional: `YYYY-MM-DD` (vale até 23:59 de Brasília) ou ISO 8601 com fuso. **Sem prazo: omita a chave ou envie vazio** |
| `mission.difficulty` | obrigatório, inteiro de 1 a 5 (texto `"3"` é aceito) |

Qualquer outro campo gera `400` e nada é criado. Sucesso: `{ "ok": true, "missionId": "<id>" }`. Não há deduplicação (como nos pedidos): em caso de timeout, confira o CRM antes de reenviar. O fluxo de pagamento (`payment.paid`) não foi alterado.
