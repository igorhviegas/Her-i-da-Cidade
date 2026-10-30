import base from './mapa-base.json';

// Estilo do mapa do admin (mesmo do HDC Academy, só a paleta escura): tiles do OpenFreeMap (OpenStreetMap, grátis e sem chave).
// `mapa-base.json` é o estilo "positron" do OpenFreeMap (fontes, sprites e camadas); aqui mudam só as cores, o contorno das ruas e os nomes (em português).

type Camada = { id: string; type: string; layout?: Record<string, unknown>; paint?: Record<string, unknown>; [k: string]: unknown };

// Tipo o modo escuro do Google Maps: fundo azul-petróleo e ruas mais claras que o fundo, combinando com o painel.
const P = {
  fundo: '#1d2636', parque: '#1f4a3f', mata: '#1c4238', residencial: '#222d40', agua: '#12304f', predio: '#2c384d', predioBorda: '#3b4960',
  rua: '#56627a', ruaBorda: '#161d2a', via: '#6b7893', viaBorda: '#161d2a', tronco: '#c9a24a', troncoBorda: '#7a5f1f', texto: '#c3cad8', halo: '#1d2636',
};

const NOME_PT = ['coalesce', ['get', 'name:pt'], ['get', 'name']];

/** Cores por camada do estilo base. */
const PINTURA: Record<string, Record<string, unknown>> = {
  background: { 'background-color': P.fundo },
  park: { 'fill-color': P.parque },
  landcover_wood: { 'fill-color': P.mata },
  landuse_residential: { 'fill-color': P.residencial },
  water: { 'fill-color': P.agua },
  waterway: { 'line-color': P.agua },
  building: { 'fill-color': P.predio, 'fill-outline-color': P.predioBorda },
  highway_minor: { 'line-color': P.rua, 'line-opacity': 1 },
  highway_major_casing: { 'line-color': P.viaBorda },
  highway_major_inner: { 'line-color': P.via },
  ...Object.fromEntries(['highway_motorway_casing', 'highway_motorway_bridge_casing', 'tunnel_motorway_casing'].map((id) => [id, { 'line-color': P.troncoBorda }])),
  ...Object.fromEntries(['highway_motorway_inner', 'highway_motorway_bridge_inner', 'tunnel_motorway_inner'].map((id) => [id, { 'line-color': P.tronco }])),
};

/** Estilo MapLibre pronto (uma cópia nova a cada chamada). */
export function mapStyle() {
  const estilo = JSON.parse(JSON.stringify(base)) as { layers: Camada[]; [k: string]: unknown };
  const camadas: Camada[] = [];
  for (const c of estilo.layers) {
    if (c.layout?.['text-field']) c.layout['text-field'] = NOME_PT;
    if (c.type === 'symbol') c.paint = { ...c.paint, 'text-color': P.texto, 'text-halo-color': P.halo, 'text-halo-width': 1.5 };
    // o estilo original não tem contorno nas ruas pequenas: entra um por baixo
    if (c.id === 'highway_minor') camadas.push({ ...JSON.parse(JSON.stringify(c)), id: 'highway_minor_casing', paint: { 'line-color': P.ruaBorda, 'line-opacity': 1, 'line-width': ['interpolate', ['exponential', 1.55], ['zoom'], 13, 3.4, 20, 24] } });
    if (PINTURA[c.id]) c.paint = { ...c.paint, ...PINTURA[c.id] };
    camadas.push(c);
  }
  estilo.layers = camadas;
  return estilo;
}
