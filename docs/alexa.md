# Alexa → Missões

Lembretes falados viram missões no CRM. **Só criação**: sem consulta, conclusão por voz ou sincronização.

## Viabilidade e limites

- A Alexa **não** entrega a serviços externos os lembretes nativos ("Alexa, me lembre de…"). O fluxo só funciona com uma **Skill personalizada** (privada) e a **palavra de ativação** do nome da skill:
  - "Alexa, **peça ao Herói da Cidade para** me lembrar de gravar três vídeos amanhã"
  - "Alexa, **abrir Herói da Cidade**" e depois "adicionar tarefa preparar o roteiro"
  - "Alexa, **diga ao Herói da Cidade para** criar uma missão para sexta-feira revisar os pedidos"
- Frases soltas como "Alexa, adicione uma tarefa…" ou "Alexa, crie uma missão…" **sem** o nome da skill continuam indo para a lista/lembretes nativos da Alexa.
- Skill em modo **desenvolvimento** funciona nos dispositivos da própria conta de desenvolvedor, sem certificação nem publicação.

## Arquitetura

```
Alexa → POST /api/alexa (Vercel Function, mesmo projeto) → Firestore (Admin SDK) → coleção missions
```

- `api/alexa.ts`: HTTP + verificação da assinatura da Amazon (`Signature-256`, certificado `s3.amazonaws.com/echo.api/`, SAN `echo-api.amazon.com`, validade, timestamp ±150 s).
- `functions/missions-alexa.js`: autorização, interpretação e gravação. Reaproveita `missions-core.js` (datas de Brasília) e o formato de documento do ManyChat (`source: 'alexa'`).
- A Alexa nunca recebe credenciais do Firebase; as regras do Firestore não foram alteradas (Admin SDK).
- Data e horário: o texto livre (`AMAZON.SearchQuery`) não pode dividir frase com outro slot, então ambos vêm dentro da tarefa e o backend os extrai. Data: "hoje", "amanhã", "depois de amanhã" ou dia da semana (próxima ocorrência futura), no início ou no fim da frase. Horário: "às 15h", "às 15:30", "às 3 da tarde", "às três e meia da tarde", "ao meio-dia", "à meia-noite" (só "às/à" com acento). Prazo = o horário falado, ou o fim do dia em Brasília se não houver horário. Horário sem dia = hoje se ainda não passou, senão amanhã (a resposta falada informa o dia).
- Sem data → missão sem prazo. Dificuldade não é falada: usa 3 (padrão do formulário do CRM). Não existe campo "responsável" em missões (o CRM é de um único administrador).
- Dúvida (sem tarefa, data ou horário que não deu para entender) → a Alexa pergunta; nada é gravado até estar claro.
- Idempotência: o ID do documento deriva do `requestId`; reenvio da Amazon não duplica.

## Segurança (três camadas)

1. Assinatura/timestamp da Amazon → senão **401**, sem tocar no banco.
2. `applicationId` deve ser o `ALEXA_SKILL_ID`.
3. `userId` deve estar em `ALEXA_ALLOWED_USER_IDS` (lista separada por vírgula).

Limitação conhecida: a cadeia do certificado é encadeada e validada, mas não ancorada nas CAs raiz (o `ponytail:` em `api/alexa.ts` explica). As camadas 2 e 3 cobrem esse risco.

## Passos manuais

1. **Conta**: developer.amazon.com (gratuita) com o **mesmo e-mail** da Alexa dos dispositivos.
2. **Deploy** desta branch na Vercel (a URL de produção, HTTPS, é o endpoint).
3. Vercel → Environment Variables: `ALEXA_SKILL_ID` (passo 5) e `ALEXA_ALLOWED_USER_IDS` (passo 7). As credenciais do Firebase Admin já usadas por `/api/manychat` servem aqui.
4. Alexa Developer Console → *Create Skill* → nome "Herói da Cidade", idioma **Portuguese (BR)**, tipo **Custom**, hospedagem **Provision your own**.
5. Copie o **Skill ID** (`amzn1.ask.skill.…`) para `ALEXA_SKILL_ID` e faça novo deploy.
6. *Build → Interaction Model → JSON Editor*: cole `alexa/interaction-model.pt-BR.json`; *Save* e *Build*. Se o console recusar o acento no nome de invocação, use `heroi da cidade`.
7. *Endpoint*: **HTTPS**, URL `https://SEU-DOMINIO/api/alexa`, certificado "My development endpoint has a certificate from a trusted certificate authority". Na aba *Test* ative **Development**.
8. Diga "abrir Herói da Cidade" e uma frase de teste. Na 1ª vez a Alexa responde que o dispositivo não está autorizado; nos *Logs* da Vercel (`/api/alexa`) procure `[Alexa] Usuário não autorizado… userId`, copie o valor para `ALEXA_ALLOWED_USER_IDS` e faça novo deploy.

## Custos

Alexa Developer Console e skill em desenvolvimento: gratuitos. Vercel/Firebase: dentro do que o projeto já usa (uma Function a mais; Hobby permite 12). Sem serviço pago novo.

## Não verificado (exige a skill real)

Os testes automatizados cobrem lógica, autorização, idempotência e verificação de assinatura com certificado de teste. **Não** foram testados com a Alexa real: aceitação do nome de invocação com acento, qualidade do reconhecimento do `AMAZON.SearchQuery`, comportamento do `Dialog.ElicitSlot`, a assinatura real da Amazon e a leitura do corpo bruto na Vercel (fallback por stream em `readRawBody`). Se o 401 aparecer com a skill real, confira esse último ponto primeiro.

## Lembrete pela Alexa (missões e tarefas)

Na criação/edição de uma **missão** (exige prazo com horário) ou **tarefa recorrente** há a opção **Lembrete pela Alexa**. No horário, a Alexa fala: *"Alerta de missão: <nome>."*

### Limite da API (por isso é por voz)

A Reminders API da Alexa **só cria lembretes dentro de uma conversa com a skill**, usando o token da própria requisição (mais a permissão de lembretes dada pelo usuário). Não existe como o CRM criar o lembrete sozinho ao salvar. Atualizar e apagar fora da conversa seria possível (Skill Messaging), mas exige credenciais da skill e um tratamento extra; não foi implementado.

Por isso: o CRM só **marca** a missão/tarefa (`alexaReminder`). Depois de salvar, diga:

> "Alexa, peça ao Herói da Cidade para **sincronizar lembretes**"

A sincronização é idempotente e reconcilia tudo de uma vez:

| Situação no CRM | O que a sincronização faz |
|---|---|
| Marcada e sem lembrete | cria |
| Horário ou nome mudou | atualiza o mesmo lembrete (sem duplicar) |
| Desmarcada, concluída, pausada, excluída ou com prazo já passado | remove |
| Lembrete apagado pelo usuário no app da Alexa | recria |

O vínculo (missão/tarefa ↔ `alertToken` da Alexa) fica na coleção `alexaReminders` (acesso só pelo backend; as regras do Firestore não mudam). Alterações feitas no CRM só chegam à Alexa na próxima sincronização.

### Regras de data

- Fuso `America/Sao_Paulo`. Missão = lembrete único no prazo; prazo no passado nunca é agendado.
- Tarefa recorrente = lembrete recorrente (RRULE): diária, semanal (dias marcados) e mensal em **dia fixo de 1 a 28**. "N-ésimo dia da semana", dia 29-31 ou as duas modalidades juntas não têm equivalente na Alexa: a opção fica desabilitada.

### Configuração manual

1. Alexa Developer Console → *Build → Permissions* → ativar **Lembretes** (`alexa::alerts:reminders:skill:readwrite`).
2. Colar o `alexa/interaction-model.pt-BR.json` atualizado (novo intent `SincronizarLembretesIntent`), *Save* e *Build*.
3. Na primeira vez, a Alexa pede a permissão no app da Alexa (cartão); aceite e peça de novo.

### Não verificado

Nenhuma chamada real à Reminders API foi feita. Testes cobrem a lógica com uma API simulada. Ficam sem confirmação com a skill real: aceitação das regras de recorrência (RRULE) em pt-BR, o fluxo de permissão, limites de quantidade (`MAX_REMINDERS_EXCEEDED`) e o comportamento de `startDateTime` em tarefas recorrentes.
