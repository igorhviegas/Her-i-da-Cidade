import React from 'react';
import { raceStory } from '../../services/kartShare.js';
import type { KartRace } from '../../services/kartService';
import { ShareImageButton } from './ShareImageButton';
import { formatDate } from './kartUi';

/** Compartilhar o resultado de uma corrida como imagem de Story. */
export const RaceShareButton: React.FC<{ race: KartRace & { number?: number }; text?: string; className?: string }> = ({ race, text, className }) => {
  const title = race.extra ? 'Sessão avulsa' : `Corrida ${race.number ?? ''}`.trim();
  return (
    <ShareImageButton
      label={`Compartilhar o resultado (${title}) como imagem para o Story`}
      fileName={`resultado-${race.id}`}
      text={text}
      className={className}
      build={() => raceStory({ race, title, subtitle: `${formatDate(race.date)} · ${race.heat} · ${race.weather === 'rain' ? 'Chuva' : 'Pista seca'}` })}
    />
  );
};
