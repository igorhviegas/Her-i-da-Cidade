# Backup do Firestore

Cópia automática do banco `(default)` do projeto `heroi-da-cidade`, feita pelo próprio Google (backups agendados do Firestore, [documentação](https://firebase.google.com/docs/firestore/backups)). Não há código nem cron nosso: é configuração feita uma vez. Exige o plano **Blaze** (o projeto já está nele).

## Por que
As regras do Firestore impedem o navegador de alterar ou apagar o financeiro (`financeEntries`), o `activityLog` e o `xpBaseline`, mas **não protegem de erro de código ou de operação**: script com Admin SDK (`scripts/`), exclusão manual no console, backfill ou migração errados, regra publicada errada. O XP e o livro financeiro não são recalculáveis, então o backup é a única recuperação.

## O que cobre e o que não cobre
- **Cobre:** todas as coleções e os índices do banco `(default)`.
- **Não cobre:** usuários do Firebase Auth (administradores), imagens do Vercel Blob, variáveis de ambiente da Vercel, eventos do Google Agenda, regras de segurança (estão no repositório) e políticas de TTL, se existirem (reaplicar no banco restaurado).
- Os backups ficam no **mesmo projeto e na mesma região** do banco. Excluir o banco ou a agenda **não** apaga backups já feitos; backup apagado não volta.

## Ativar (uma vez, ~10 min)
Precisa do Firebase CLI logado (`firebase login`) e do papel de dono do projeto. No PowerShell, na raiz do repositório:

```powershell
firebase use heroi-da-cidade

# diário, guardado por 7 dias
firebase firestore:backups:schedules:create --database "(default)" --recurrence DAILY --retention 7d

# semanal (domingo; o dia vai por extenso, "SUN" é recusado), guardado por 14 semanas (máximo permitido)
firebase firestore:backups:schedules:create --database "(default)" --recurrence WEEKLY --day-of-week SUNDAY --retention 14w

# conferir
firebase firestore:backups:schedules:list --database "(default)"
```

Regras do Google: no máximo **uma agenda diária e uma semanal** por banco; **não dá para escolher o horário**; retenção máxima de 14 semanas. O primeiro backup aparece em até 24 h:

```powershell
firebase firestore:backups:list
```

Depois, crie um **alerta de orçamento** no Google Cloud (Faturamento → Orçamentos e alertas, por exemplo R$ 20/mês) para não ter surpresa.

> **Estado:** as duas agendas foram criadas em 09/10/2026 (diária com 7 dias de retenção; semanal aos domingos com 14 semanas).

## Custo
O armazenamento é cobrado por GiB de cada backup e a restauração por GiB do backup (a tabela de preços que achei, da edição Enterprise, indica ~US$ 0,03 por GiB-mês e US$ 0,20 por GiB restaurado; confirme na [página de preços](https://firebase.google.com/docs/firestore/enterprise/pricing)). Veja o tamanho real do banco em Firebase Console → Firestore → Uso; um CRM deste porte deve custar centavos por mês.

## Restaurar
O backup **nunca restaura por cima**: ele cria um **banco novo**, e o novo só fica acessível quando a restauração termina. Exige o papel `roles/datastore.restoreAdmin`.

1. Escolha o backup (o nome completo sai da lista):
   ```powershell
   firebase firestore:backups:list
   ```
2. Restaure para um banco com ID novo (4 a 63 caracteres; não pode ser um ID já usado):
   ```powershell
   firebase firestore:databases:restore --backup "projects/heroi-da-cidade/locations/<REGIAO>/backups/<ID>" --database "restore-AAAAMMDD"
   ```
3. **Não apague o banco danificado.** Abra o banco novo no console e confira as contagens de `orders`, `clients`, `financeEntries`, `activityLog`, `xpBaseline` e `missions`.
4. Escolha como voltar:
   - **Recuperação parcial (o mais comum, ex.: apagou algo por engano):** copie só as coleções ou documentos perdidos do banco novo para o `(default)` com um script do Admin SDK que abra os dois bancos (`getFirestore(app, 'restore-AAAAMMDD')` e `getFirestore(app)`). Escreva e teste o script antes de rodá-lo; os IDs são determinísticos, então reexecutar não duplica.
   - **Troca total (o banco todo está ruim):** o app precisa apontar para o banco novo. Hoje **só o navegador** sabe trocar de banco; o servidor sempre usa o `(default)`. Os pontos a alterar:
     - `firebase-applet-config.json`: `firestoreDatabaseId` (navegador, lido em `lib/firebase.ts`).
     - `functions/firebase-admin.js`: `getFirestore(...)`, usado por todas as rotas `/api`.
     - `api/manychat.ts`: as 4 chamadas a `getFirestore(...)` (linhas 89, 109, 124 e 130).
     - `functions/index.js`: `getFirestore()` da Cloud Function `receiveManyChatOrder`.

     Nos três arquivos do servidor, use `getFirestore(app, 'restore-AAAAMMDD')`. Depois: publicar `firestore.rules` no banco novo (no `firebase.json`, a chave `firestore` precisa ter `"database": "restore-AAAAMMDD"`), reaplicar TTL se houver, conferir o IAM do banco novo e fazer o redeploy (Vercel e `firebase deploy --only functions`).
5. Só apague o banco antigo depois de dias de uso sem problema.

## Teste de restauração (a cada 3 meses)
Um backup que nunca foi restaurado é uma suposição. Todo trimestre:
1. Restaure o backup mais recente para `drill-AAAAMMDD` (passos 1 e 2 acima).
2. Confira as contagens de `orders`, `financeEntries` e `activityLog` contra o banco real.
3. Apague **só** o banco `drill-AAAAMMDD` no console (nunca o `(default)`), para parar de pagar o armazenamento.

## Auth (administradores)
Os administradores não estão no backup do Firestore. Exporte de vez em quando e guarde fora do repositório e do OneDrive compartilhado (o arquivo tem dados de contas):
```powershell
firebase auth:export admins.json --format=json --project heroi-da-cidade
```

## Se um backup parar de ser feito
`firebase firestore:backups:list` deve mostrar um backup diário recente. Se o mais novo tiver mais de 2 dias, confira `firebase firestore:backups:schedules:list --database "(default)"` e o faturamento do projeto (conta suspensa para os backups).
