// Histórico de atividades concluídas (activityLog), base da futura regra de XP. Compartilhado entre o front (SDK web)
// e o handler do ManyChat (Admin SDK): só usa tx.get() e devolve o registro; quem chama faz o tx.set().
export const ACTIVITY_LOG_COLLECTION = 'activityLog';
export const GAMIFICATION_CONFIG_PATH = ['siteConfig', 'gamification'];

export const activityLogId = (type, refId) => `${type}_${refId}`;

// SDK web: snapshot.exists() é método; Admin SDK: snapshot.exists é propriedade.
const snapshotExists = (snapshot) => (typeof snapshot.exists === 'function' ? snapshot.exists() : snapshot.exists === true);

/**
 * Lê (dentro da transação, antes de qualquer escrita) se o evento já foi registrado e, se não, a dificuldade vigente.
 * Retorna o registro a gravar ou null quando o evento já existe: o primeiro registro vale para sempre, então reabrir e
 * concluir de novo, ou mudar a configuração depois, não altera o histórico.
 * difficulty: número explícito (missões, tarefas) ou null; difficultyKey: chave em siteConfig/gamification (serviços, roteiros).
 */
export async function prepareActivityLog(tx, { logRef, configRef }, { type, refId, occurredAt, difficulty = null, difficultyKey = null, meta = {} }) {
  const [logSnapshot, configSnapshot] = await Promise.all([tx.get(logRef), difficultyKey && configRef ? tx.get(configRef) : null]);
  if (snapshotExists(logSnapshot)) return null;
  let snapshotDifficulty = difficulty;
  if (difficultyKey) {
    const configured = configSnapshot && snapshotExists(configSnapshot) ? configSnapshot.data()?.difficulties?.[difficultyKey] : undefined;
    snapshotDifficulty = Number.isInteger(configured) && configured >= 1 && configured <= 5 ? configured : null;
  }
  return { type, refId, difficulty: snapshotDifficulty, difficultyKey, occurredAt, ...(Object.keys(meta).length ? { meta } : {}) };
}
