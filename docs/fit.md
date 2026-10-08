# Fit

Menu **Pessoal**: **Fit** (`/admin/fit`), **Check-ins** (`/admin/fit/checkins`) e **Treinos** (`/admin/fit/treinos`). Tudo é do dono e fica em `users/{uid}/...` (regras abaixo).

| Fonte | Como entra | Onde fica |
|---|---|---|
| Passos, distância e peso (Apple Saúde) | **Atalho do iPhone** → `POST /api/fit-ingest` | `users/{uid}/fitDaily/{dia}` (gravado pelo servidor) |
| Pedaladas | botão **Importar FIT** (arquivo do MyWhoosh) | `users/{uid}/fitRides/{id}` |
| Peso manual | aba Check-ins | `users/{uid}/fitWeight/{dia}` |
| Academia e funcional | aba Check-ins, ou **Finalizar treino** na aba Treinos | `users/{uid}/fitCheckins/{tipo_dia}` |
| Exercícios e treinos (A, B…) | aba Treinos | `fitExercises/{id}`, `fitWorkouts/{id}` |

Não há mais integração com o Health Auto Export (removida): o app Saúde só chega ao CRM pelo atalho.

## Tela Fit (`AdminFitPage.tsx`)
Indicadores (último dia com passos, média, distância, peso e variação), gráficos de passos, distância e peso (pontos + média móvel de 7 dias), **XP dos passos** e a seção **Ciclismo**. Dia sem registro aparece apagado e fica fora das médias: **ausente não é zero** (`services/fitDaily.js`, testado). O peso manual vale mais que o do atalho no mesmo dia.

## Atalho do iPhone → `/api/fit-ingest`
`POST` com `Authorization: Bearer <FIT_INGEST_TOKEN>` e JSON `{ "day": "AAAA-MM-DD", "steps": 2431, "walkRunKm": 1.8, "weightKg": 72 }` (só `day` é obrigatório). Campos aceitos, em unidades fixas: `steps`, `walkRunKm` (km), `cyclingKm`, `activeKcal`, `basalKcal`, `exerciseMin`, `weightKg` (kg); outro campo é descartado e contado (`ignoredFields`), valor implausível também (`invalid`). Aceita número ou texto numérico (`"1,8"`). O `day` aceita `2026-10-07`, com hora ou `07/10/2026`; espaços e marcas invisíveis do iOS em volta são ignorados. O dono vem de `FIT_OWNER_UID` (nunca do payload); o token só **escreve**. Upsert por dia com `merge` (o dia chega parcial e depois completo; nunca soma). A resposta e os logs trazem só contagens; no 400, só o nome e o tipo de cada campo e a forma do `day` (`9999-99-99`), nunca valores.

Ativar: defina `FIT_INGEST_TOKEN` (32+ caracteres aleatórios) e `FIT_OWNER_UID` (UID do Firebase Auth) na Vercel e republique. Montagem do atalho (app Atalhos → "Enviar Fit"):
1. **Data Atual** → **Formatar Data** (personalizado `yyyy-MM-dd`).
2. **Encontrar Amostras de Saúde**: *Passos*, data de início *é hoje* → **Calcular Estatísticas** (*Soma*).
3. O mesmo para *Distância de caminhada e corrida* (unidade quilômetros) e *Peso* (limite 1, valor).
4. **Obter Conteúdo do URL**: `POST`, cabeçalho `Authorization`, corpo JSON com `day` (**Texto**) e os números.
5. Automação pessoal *Abrir app* (QZ e/ou Saúde) com "Perguntar antes de executar" desligado.

Cuidados: o atalho guarda o token (não o compartilhe); o iOS bloqueia o Saúde com o telefone bloqueado; só o dia de hoje é enviado, então o dia sem abrir o app fica sem registro.

## Ciclismo: importar o FIT do MyWhoosh (`FitRides.tsx`)
O arquivo é lido **no navegador** (`fit-file-parser`, MIT, carregado só ao importar) e só o **resumo** é gravado: início (UTC), duração, tempo em movimento, distância, velocidade média (em movimento) e máxima, cadência média (só pedalando). Baixe em mywhoosh.com → Perfil → Activity Files.
- **Identidade:** `fabricante_série_time_created` é o id: importar o mesmo arquivo de novo não duplica.
- **Recalculado dos registros** (o resumo do arquivo não é confiável: `avg_speed` veio 0 e não há `max_speed`). **Não usado:** FC, potência, calorias (zero = sem dado), GPS e altitude (do mundo virtual) e cadência máxima (ruído).
- Só `sport = cycling`. Use **uma** fonte de pedaladas (MyWhoosh): o FIT do QZ cobre a sessão inteira do app e contaria a mesma distância duas vezes.

## Check-ins e peso (`AdminFitCheckinsPage.tsx`)
Um check-in por **tipo e dia** (`gym_AAAA-MM-DD`, `functional_…`): registrar de novo corrige o do dia. Campos: data, duração (min), observação. Indicadores da semana e do mês e gráfico de treinos por semana. O peso manual (um por dia) alimenta o gráfico da aba Fit.

## Treinos (`AdminFitWorkoutsPage.tsx`)
- **Exercícios:** nome, **categoria** livre (Perna, Costas, Abdômen…) e **timer opcional** (5 a 3.600 s).
- **Planos:** "Treino A", "Treino B"… com os exercícios escolhidos e a **ordem** (subir/descer).
- **Treinar:** *Iniciar treino* liga o **cronômetro** e abre o checklist. Exercício com timer só conclui quando o timer termina (toca e vibra; se a tela bloquear, conclui ao voltar). Dá para **trocar a ordem** durante o treino. *Finalizar* grava o check-in de academia do dia (duração, nome do treino, feitos/total; observação anterior do dia é substituída) e oferece coletar o XP. A sessão fica no `localStorage` e sobrevive a recarregar a página.
- Lógica pura e testada em `services/fitWorkout.js`.

## XP (gamificação)
Ver `docs/xp.md`. Cada XP é **coletado** por um botão e vira **um** evento no `activityLog` (criado uma vez; o XP fica congelado no evento), que abre a janelinha de ganho.

| Origem | XP | Regra |
|---|---|---|
| Passos de um dia **fechado** | 1 por 10 passos, teto de 20.000 (máx. 2.000) | uma coleta por dia; o dia de hoje só amanhã |
| Pedalada importada | 50 por km (arredondado para baixo) | uma coleta por treino |
| Check-in de academia ou funcional | 500 | uma coleta por tipo e dia |

Calibrado com missões (100 a 1.000 XP) e pedidos (R$ × 10): 8.000 passos = 800 XP; 20 km de bike = 1.000 XP. Os valores ficam em `FIT_XP` (`functions/xp.js`) e as regras do Firestore repetem os tetos; mudar um exige mudar o outro (e publicar as regras). Mudar o valor não reescreve o que já foi coletado.

## Privacidade e segurança (`firestore.rules`)
- Tudo sob `users/{uid}/...`: só administrador **e** dono do caminho lê e escreve; outro administrador não acessa. `fitDaily` é só do servidor (cliente não grava). Outro caminho sob `users/` segue negado.
- `fitRides`, `fitWeight`, `fitCheckins`, `fitExercises`, `fitWorkouts`: o dono cria, corrige (exceto `fitRides`) e apaga, com campos, tipos e limites validados e `updatedAt` = horário do servidor.
- **XP:** `fit_ride`, `fit_steps`, `fit_checkin` no `activityLog` são validados: id = tipo_refId, hora do servidor, XP inteiro, no máximo o que a origem vale e a origem precisa existir no seu caminho. Ninguém edita nem apaga eventos.
- `firestore.rules.txt` é cópia exata de `firestore.rules` (há teste): atualize os dois. Testes: `tests/firestore-rules-fit.test.js` e `tests/firestore-rules-fit-data.test.js` (`npm run test:rules`).

## Limites conhecidos
- O envio do atalho depende do iPhone desbloqueado e não é em tempo real.
- Treinos do QZ no Apple Saúde não são lidos (o FIT do MyWhoosh é a fonte das pedaladas).
- O timer sonoro no iOS só toca se o toque que o iniciou liberou o áudio da página; com a tela bloqueada o aviso é visto ao voltar.
- No `npm run dev` o Express limita o corpo a 100 KB; na Vercel `api/` tem 11 funções (o plano Hobby limita o total).

## Próximos passos possíveis
Nutrição (base TACO + USDA, ver relatório de viabilidade), metas semanais de treino no módulo Missões, histórico de cargas por exercício.
