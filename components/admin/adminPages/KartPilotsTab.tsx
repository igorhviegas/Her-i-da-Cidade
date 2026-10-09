import React, { useState } from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';
import { DEFAULT_KART_PILOTS, pilotId } from '../../../services/kartPilots.js';
import { deleteKartPilot, saveKartPilot, seedKartPilots, useKartPilots, type KartPilot } from '../../../services/kartService';
import { card, iconBtn, input, Loading, type Run } from './agentShared';

const parseAliases = (text: string) => text.split(',').map((a) => a.trim()).filter(Boolean);

/** Uma linha editável: nome + apelidos (outras grafias que o relatório do kartódromo usa). */
const PilotRow: React.FC<{ pilot: KartPilot; run: Run }> = ({ pilot, run }) => {
  const [name, setName] = useState(pilot.name);
  const [aliases, setAliases] = useState(pilot.aliases.join(', '));
  const dirty = name.trim() !== pilot.name || parseAliases(aliases).join() !== pilot.aliases.join();
  return (
    <div className={`${card} grid gap-2 p-3 sm:grid-cols-[1fr_1.4fr_auto] sm:items-center`}>
      <input aria-label="Nome" value={name} onChange={(e) => setName(e.target.value)} className={input} />
      <input aria-label="Apelidos no relatório" value={aliases} onChange={(e) => setAliases(e.target.value)} placeholder="Outras grafias, separadas por vírgula" className={input} />
      <div className="flex justify-end gap-1">
        <button type="button" disabled={!dirty || !name.trim()} aria-label="Salvar piloto" onClick={() => run(() => saveKartPilot({ ...pilot, name, aliases: parseAliases(aliases) }), 'Piloto salvo.')} className={`${iconBtn} ${dirty ? 'text-emerald-300' : ''}`}><Save className="h-5 w-5" /></button>
        <button type="button" aria-label="Excluir piloto" onClick={() => { if (window.confirm(`Excluir ${pilot.name} da lista de inscritos? As corridas já salvas continuam com o nome dele.`)) run(() => deleteKartPilot(pilot.id), 'Piloto excluído.'); }} className={`${iconBtn} hover:text-red-300`}><Trash2 className="h-5 w-5" /></button>
      </div>
    </div>
  );
};

export const KartPilotsTab: React.FC<{ run: Run }> = ({ run }) => {
  const pilots = useKartPilots();
  const [name, setName] = useState('');
  if (pilots === null) return <Loading />;

  if (pilots.length === 0) {
    return (
      <div className={`${card} space-y-4 p-6`}>
        <p className="text-sm text-white/70">Nenhum piloto inscrito ainda. Carregue os {DEFAULT_KART_PILOTS.length} pilotos do Notion para começar (você pode editar, acrescentar e excluir depois).</p>
        <button type="button" onClick={() => run(seedKartPilots, 'Pilotos cadastrados.')} className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500">Carregar pilotos do Notion</button>
      </div>
    );
  }

  const add = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (await run(() => saveKartPilot({ id: pilotId(trimmed), name: trimmed, aliases: [], active: true }), 'Piloto inscrito.')) setName('');
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-white/55">Só quem está nesta lista entra no campeonato. O relatório traz o nome completo do piloto; basta o nome daqui (ou um apelido) estar contido nele. Ex.: <b className="text-white/80">Lemuel</b> casa com LEMUEL KESSELEH.</p>
      <form onSubmit={(e) => { e.preventDefault(); add(); }} className={`${card} flex gap-2 p-3`}>
        <input aria-label="Novo piloto" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do novo piloto inscrito" className={input} />
        <button type="submit" disabled={!name.trim()} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-40"><Plus className="h-4 w-4" />Inscrever</button>
      </form>
      {[...pilots].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')).map((p) => <PilotRow key={p.id} pilot={p} run={run} />)}
    </div>
  );
};
