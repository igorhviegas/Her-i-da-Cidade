export type QuestionStatus = 'draft' | 'scripted' | 'answered';

export interface CreativeQuestion {
  id: string;
  text: string;
  category: string;
  notes: string;
  status: QuestionStatus;
  createdAt: Date | null;
  updatedAt: Date | null;
  answeredAt: Date | null;
  /** ID de um documento de contentScripts (o roteiro de resposta); null = sem roteiro. */
  scriptId: string | null;
}

export interface QuestionInput { text: string; category: string; notes: string; status: QuestionStatus; scriptId?: string | null }

export const QUESTION_STATUSES: Array<[QuestionStatus, string]>;
export const QUESTION_LIMITS: { text: number; category: number; notes: number };
export function cleanQuestion(input: QuestionInput): Required<QuestionInput>;
export function normalizeStatus(status: unknown): QuestionStatus;
export function answeredAtFor(status: QuestionStatus, current: Date | null, now: Date): Date | null;
export function filterQuestions<T extends Pick<CreativeQuestion, 'text' | 'category' | 'notes' | 'status'>>(questions: T[], filters?: { search?: string; category?: string; status?: QuestionStatus | '' }): T[];
