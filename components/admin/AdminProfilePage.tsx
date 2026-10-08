import React from 'react';
import { useXp } from '../../context/XpContext';
import { levelInfo } from '../../functions/xp.js';
import { ProfileAttributes, ProfileIdentity, ProfileXp } from './adminPages/ProfileSections';
import { useHiddenMoney, useProfileData, useXpActivation } from './adminPages/profileHooks';

export const AdminProfilePage: React.FC = () => {
  const xp = useXp(); // ao vivo: ativar o XP ou ganhar uma atividade atualiza a tela sozinho
  const { counts, finance, loadError, setLoadError } = useProfileData();
  const { hidden, toggleHidden, money } = useHiddenMoney();
  const { preview, setPreview, activating, startActivation, confirmActivation } = useXpActivation(setLoadError);

  const level = xp.level;
  const previewLevel = preview ? levelInfo(preview.total) : null;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-400">Perfil</p>
        <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-white">Ficha do Herói</h2>
      </div>
      {loadError && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{loadError}</p>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        {/* Identidade */}
        <ProfileIdentity level={level} />

        {/* Progressão */}
        <ProfileXp xp={xp} level={level} preview={preview} previewLevel={previewLevel} activating={activating} onStart={startActivation} onConfirm={confirmActivation} onCancel={() => setPreview(null)} />
      </div>

      {/* Atributos */}
      <ProfileAttributes counts={counts} finance={finance} hidden={hidden} money={money} onToggleHidden={toggleHidden} />
    </div>
  );
};
