import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { dateKey, endOfDay, parseDateKey } from './missions-core.js';

export const MISSION_EVENT = 'mission.create';
const MISSIONS = 'missions';

/**
 * Corpo esperado (todos os valores como texto, como o ManyChat envia):
 * { eventType: 'mission.create', mission: { title, description?, dueDate?, difficulty } }
 * dueDate: YYYY-MM-DD (vale até 23:59 de Brasília), ISO 8601 com fuso, ou ausente/vazio = sem prazo.
 * Retorna { errors, mission } com mission já normalizada.
 */
export function validateMissionPayload(body) {
  const errors = [];
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { errors: ['O corpo deve ser um objeto JSON.'] };
  const unexpected = Object.keys(body).filter((key) => !['eventType', 'mission'].includes(key));
  if (unexpected.length) errors.push(`Campos não aceitos: ${unexpected.join(', ')}.`);
  const input = body.mission;
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { errors: [...errors, 'mission deve ser um objeto.'] };
  const unexpectedMission = Object.keys(input).filter((key) => !['title', 'description', 'dueDate', 'difficulty'].includes(key));
  if (unexpectedMission.length) errors.push(`Campos não aceitos em mission: ${unexpectedMission.join(', ')}.`);

  const title = typeof input.title === 'string' ? input.title.trim() : '';
  if (!title || title.length > 120) errors.push('mission.title é obrigatório (até 120 caracteres).');
  const hasDescription = input.description !== undefined && input.description !== null && input.description !== '';
  if (hasDescription && (typeof input.description !== 'string' || input.description.trim().length > 1000)) errors.push('mission.description deve ser texto de até 1000 caracteres.');

  const difficulty = typeof input.difficulty === 'number' ? input.difficulty : typeof input.difficulty === 'string' && /^[1-5]$/.test(input.difficulty.trim()) ? Number(input.difficulty) : NaN;
  if (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 5) errors.push('mission.difficulty deve ser um inteiro de 1 a 5.');

  let dueAt = null;
  const rawDue = input.dueDate;
  if (rawDue !== undefined && rawDue !== null && rawDue !== '') {
    const text = typeof rawDue === 'string' ? rawDue.trim() : '';
    if (parseDateKey(text)) dueAt = endOfDay(text);
    else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/.test(text) && !Number.isNaN(new Date(text).getTime())) dueAt = new Date(text);
    else errors.push('mission.dueDate deve ser YYYY-MM-DD, data/hora ISO 8601 com fuso, ou ficar vazio (sem prazo).');
  }
  if (errors.length) return { errors };
  return { errors, mission: { title, description: hasDescription ? input.description.trim() : '', dueAt, difficulty } };
}

/** Cria a missão; chamada pelo handler do ManyChat depois da autenticação por segredo. */
export async function createMissionFromManyChat(res, mission, { database, logger = console }) {
  const ref = database.collection(MISSIONS).doc();
  try {
    await ref.set({
      title: mission.title,
      description: mission.description,
      difficulty: mission.difficulty,
      status: 'pending',
      source: 'manychat',
      ...(mission.dueAt ? { dueAt: Timestamp.fromDate(mission.dueAt) } : {}),
      createdAt: FieldValue.serverTimestamp(),
      createdDate: dateKey(new Date()),
    });
    return res.status(200).json({ ok: true, missionId: ref.id });
  } catch (error) {
    logger.error('Falha ao criar missão via ManyChat.', { error: error instanceof Error ? error.message : String(error) });
    return res.status(500).json({ ok: false, error: { code: 'internal_error', message: 'Não foi possível criar a missão. Confira o CRM antes de reenviar.' } });
  }
}
