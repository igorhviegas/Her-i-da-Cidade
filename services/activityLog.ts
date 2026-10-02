import { doc, type Firestore } from 'firebase/firestore';
import { ACTIVITY_LOG_COLLECTION, GAMIFICATION_CONFIG_PATH, activityLogId } from '../functions/activity-log.js';

export { ACTIVITY_LOG_COLLECTION, prepareActivityLog } from '../functions/activity-log.js';

/** Referências do registro (ID determinístico por evento) e da configuração de dificuldades, para usar com prepareActivityLog dentro de uma transação. */
export function activityRefs(firestore: Firestore, type: string, refId: string) {
  return {
    logRef: doc(firestore, ACTIVITY_LOG_COLLECTION, activityLogId(type, refId)),
    configRef: doc(firestore, GAMIFICATION_CONFIG_PATH[0], GAMIFICATION_CONFIG_PATH[1]),
  };
}
