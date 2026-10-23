import React, { useEffect, useState } from 'react';
import { Loader2, RotateCcw, Save } from 'lucide-react';
import { getAgentMessages, saveAgentMessages } from '../../../services/siteConfigService';
import { DEFAULT_MESSAGES, MAX_MESSAGE_LENGTH, MESSAGE_VARIABLES, renderMessage, type AgentMessages } from '../../../services/eventSchedule.js';
import { card, input, Loading, type Run } from './agentShared';

const SAMPLE = { evento: 'Aniversário, 14:00', hora: '13:25', previsao: '17:40' };
const FIELDS: [keyof AgentMessages, string][] = [['self', 'Minha mensagem (para a minha esposa)'], ['vitor', 'Mensagem do Vitor (para a esposa dele)']];

/** Modelos das mensagens "já chegamos + previsão de chegada em casa" da tela Chegada em casa do agente. */
export const MessagesTab: React.FC<{ run: Run }> = ({ run }) => {
  const [messages, setMessages] = useState<AgentMessages | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { getAgentMessages().then(setMessages, () => setMessages(DEFAULT_MESSAGES)); }, []);
  if (!messages) return <Loading />;

  const save = async () => { setSaving(true); await run(() => saveAgentMessages(messages), 'Mensagens salvas.'); setSaving(false); };

  return (
    <div className="space-y-4">
      <p className="text-xs text-white/50">Texto enviado pelo WhatsApp quando o agente chega ao evento (área do agente → Chegada em casa). Variáveis: {MESSAGE_VARIABLES.map((v) => <code key={v} className="mr-1 font-mono text-blue-400">{v}</code>)}
        — evento, hora da chegada e previsão de chegada em casa. Campo vazio volta ao texto padrão.</p>
      {FIELDS.map(([key, label]) => (
        <div key={key} className={`${card} space-y-3 p-4`}>
          <label className="block text-xs font-bold uppercase tracking-wider text-white/50">{label}
            <textarea rows={5} maxLength={MAX_MESSAGE_LENGTH} value={messages[key]} onChange={(e) => setMessages({ ...messages, [key]: e.target.value })} className={`${input} mt-2 font-normal normal-case tracking-normal`} />
          </label>
          <div>
            <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-white/40">Prévia</p>
            <pre className="whitespace-pre-wrap rounded-xl border border-white/10 bg-[#070B14] p-3 text-xs text-white/80">{renderMessage(messages[key], SAMPLE)}</pre>
          </div>
          <button type="button" onClick={() => setMessages({ ...messages, [key]: DEFAULT_MESSAGES[key] })} className="inline-flex items-center gap-1 text-xs text-white/50 hover:text-white"><RotateCcw className="h-3 w-3" />Restaurar padrão</button>
        </div>
      ))}
      <button type="button" onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Salvar mensagens
      </button>
    </div>
  );
};
