# CRM: pedidos e integração ManyChat

## Identificadores dos pedidos

Pedidos novos usam o ID automático do documento Firestore como identificador técnico. Os caminhos atuais são:

1. Cadastro manual por `createOrder` em `services/ordersService.ts`, usando `doc(collection(...))` e `setDoc`.
2. Produção por roteiro em `createRecordingOrderFromScript`; pedido e vínculo do roteiro são gravados na mesma transação.
3. Webhook em `manychat-handler.js`; pedido, cliente quando necessário e índice de WhatsApp são gravados na mesma transação.

`orderNumber` e `orderNumberDisplay` permanecem opcionais para pedidos históricos. Nenhum pedido existente é renumerado ou alterado. A interface mantém o número antigo quando existe; para novos pedidos, mostra um prefixo do ID e, nos detalhes, o ID completo. A referência curta é apenas visual, nunca uma chave técnica.

O campo legado `technicalPurchaseId` continua por compatibilidade, mas em pedidos novos do ManyChat recebe o ID do documento. Não é uma chave de idempotência.

As regras locais estão em transição: aceitam criação numerada antiga vinculada ao contador e criação nova sem números, preservando a imutabilidade dos números existentes. Isso não confirma compatibilidade com as regras publicadas, que continuam desconhecidas. O contador e os arquivos do helper sequencial ficam preservados nesta etapa; os três caminhos atuais não os usam.

## ID técnico do ManyChat e reenvios

O ManyChat não fornece um ID estável por compra. O backend grava o ID Firestore também em `orders.technicalPurchaseId` por compatibilidade. Esse campo não é chave de idempotência.

Cada chamada aceita, inclusive a repetição da mesma confirmação, poderá criar um novo pedido com outro ID. Não há deduplicação por telefone, nome, conteúdo ou horário, pois isso bloquearia compras legítimas.

A documentação pública consultada para [External Request](https://help.manychat.com/hc/pt-br/articles/14281285374364-Dev-Tools-Solicita%C3%A7%C3%A3o-externa) e [Dev Tools: Basics](https://help.manychat.com/hc/en-us/articles/14281252007580-Dev-Tools-Basics) explica o request HTTP, fallback e limite de timeout de 10 segundos, mas não especifica uma política garantida de retry automático. Respostas diferentes de HTTP 200 são tratadas como falha/fallback e não permitem mapear o texto de erro. Assim, não se presume que ManyChat fará retry — nem que não fará outro envio por causa de timeout ou ação humana.

Procedimento contra reenvio acidental: se houver timeout/erro, não repetir a confirmação imediatamente. Primeiro conferir o CRM e os logs para saber se o pedido foi gravado; se não for possível confirmar, pausar e solicitar revisão administrativa antes de nova tentativa. Uma resposta perdida pode ocorrer depois do commit e cada nova chamada cria outro pedido. Isso é revisão operacional, não idempotência técnica. A função tem limite local de 8 segundos, abaixo dos 10 segundos documentados pelo ManyChat, para reduzir o risco de a execução continuar muito depois do timeout do cliente. Isso não elimina a ambiguidade se o commit tiver ocorrido antes de a resposta se perder.

> Contratos de todos os serviços (Aniversário, Temático, Personalizado, Convite e Chamada ao Vivo): ver [`docs/manychat-integration.md`](../docs/manychat-integration.md). O contrato abaixo continua valendo para requisições sem o campo `service`.

## Endpoint ManyChat: Vídeo Especial de Aniversário

`receiveManyChatOrder` aceita apenas o evento `payment.paid` e o serviço `services/1` (Vídeo Especial de Aniversário). A equipe só deve chamar a função após confirmar manualmente o pagamento recebido. Contrato:

```json
{
  "eventType": "payment.paid",
  "customer": {
    "name": "Nome do contato no ManyChat",
    "whatsapp": "+55 31 99999-0000"
  },
  "childName": "Nome da criança"
}
```

- `customer.name` e `customer.whatsapp`: campos de sistema; telefone normalizado como em `clientsService.ts`.
- `childName`: campo personalizado existente para nome da criança, enviado com essa chave JSON.
- `content`: `Aniversariante: <nome>`.
- Serviço, nome, status e preço são lidos de `services/1`; a função valida serviço ativo, categoria Pronta entrega, `generateOrder`, configuração `immediate/completed/autoComplete` e ausência de prazo padrão.
- O preço fixo precisa ser inequívoco (`Apenas R$ 30` ou formato fixo compatível). Valor ausente, ambíguo ou `A partir de ...` causa erro antes da gravação. Não se recebe preço do ManyChat.
- O pedido grava `status: completed`, `productionType: immediate`, `source: manychat`, `paidAt` e `completedAt` com o mesmo instante de recepção pelo servidor, sem prazo. Por isso não entra nas colunas de produção.
- O pedido contém `technicalPurchaseId` igual ao ID do documento. Não recebe números sequenciais novos.

O corpo rejeita `purchaseId`, `serviceId`, preço, status, data de pagamento e campos de outros serviços. A função não configura nem chama o ManyChat.

## Respostas HTTP

- `200`: confirmação gravada; retorna ID do pedido e ID técnico, que são iguais.
- `400`: corpo inválido, evento diferente de `payment.paid` ou campo não aceito.
- `401`: segredo ausente/inválido.
- `405`, `413`, `415`: método, tamanho ou tipo de conteúdo inválidos.
- `409`: índice de WhatsApp existente inconsistente ou cadastro legado ambíguo.
- `422`: serviço não encontrado, configuração alterada ou preço não reconhecível.
- `500`: erro inesperado. Antes de tentar novamente, conferir se houve gravação, pois a chamada seguinte não será deduplicada.

Use `POST`, `Content-Type: application/json` e `Authorization: Bearer <segredo>`. Respostas de sucesso são HTTP 200; erros retornam JSON com `error.code` e `error.message`.

## Segredo e pendências

Cadastre o segredo diretamente no Secret Manager, nunca no código, frontend, corpo ou arquivo versionado:

```sh
firebase functions:secrets:set MANYCHAT_WEBHOOK_SECRET --project heroi-da-cidade
```

Antes de conectar o fluxo, será preciso configurar e testar o External Request: mapear os campos de sistema, associar `childName` ao campo personalizado correto, enviar `eventType` fixo, configurar o cabeçalho de segredo, usar HTTPS e definir fallback operacional sem reenvio automático. Confirmar também a região do Firestore em relação à região `us-central1`. A regra local de transição ainda precisa ser validada em Emulator; regras de produção não foram consultadas.

Nenhum dado real foi escrito; não houve configuração do ManyChat, deploy, commit ou push nesta etapa.
