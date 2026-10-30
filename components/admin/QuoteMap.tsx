import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'maplibre-gl/dist/maplibre-gl.css';
import '@maplibre/maplibre-gl-leaflet';
import type { RoutePath } from '../../functions/travel-route.js';
import { mapStyle } from './mapStyle';

/** Ponto do mapa: casa, casa do Vitor, evento da agenda (com a ordem do dia) ou o evento do orçamento. */
export interface MapPoint { kind: 'home' | 'vitor' | 'stop' | 'new'; label: string; lat: number; lng: number; order?: number }

// Área de atendimento: retângulo em volta da Região Metropolitana de BH (Betim/Florestal a oeste, Jaboticatubas ao norte,
// Nova União a leste, Rio Manso/Brumadinho ao sul), com folga. O mapa não sai dela.
const RMBH: L.LatLngBoundsExpression = [[-20.45, -44.7], [-19.0, -43.4]];

const STYLE: Record<MapPoint['kind'], { bg: string; border: string; text: (p: MapPoint) => string }> = {
  home: { bg: '#2563eb', border: '#fff', text: () => 'C' },
  vitor: { bg: '#0d9488', border: '#fff', text: () => 'V' },
  stop: { bg: '#ea580c', border: '#fff', text: (p) => String(p.order ?? '') },
  new: { bg: '#0D1527', border: '#facc15', text: (p) => (p.order ? String(p.order) : '★') },
};

const icon = (p: MapPoint) => {
  const s = STYLE[p.kind];
  const dashed = p.kind === 'new' ? 'border-style:dashed;' : '';
  return L.divIcon({
    className: '',
    html: `<div style="width:28px;height:28px;display:flex;align-items:center;justify-content:center;border-radius:9999px;background:${s.bg};border:2px solid ${s.border};${dashed}color:#fff;font:800 12px/1 sans-serif;box-shadow:0 2px 6px rgba(0,0,0,.5)">${s.text(p)}</div>`,
    iconSize: [28, 28], iconAnchor: [14, 14],
  });
};

/** Mapa dos orçamentos (Leaflet + MapLibre, como no HDC Academy). Carregado sob demanda: só baixa quando aparece na tela. */
export default function QuoteMap({ points, paths }: { points: MapPoint[]; paths: RoutePath[] }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!el.current) return;
    const m = L.map(el.current, { zoomControl: false, attributionControl: false, maxBounds: RMBH, maxBoundsViscosity: 1 });
    m.setMinZoom(Math.floor(m.getBoundsZoom(RMBH)));
    m.fitBounds(RMBH);
    (L as unknown as { maplibreGL: (o: object) => L.Layer }).maplibreGL({ style: mapStyle() }).addTo(m);
    L.control.attribution({ position: 'bottomleft', prefix: false }).addTo(m); // o texto vem do estilo (OpenFreeMap, OpenMapTiles, OpenStreetMap)
    L.control.zoom({ position: 'bottomright' }).addTo(m);
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    return () => { m.remove(); map.current = null; };
  }, []);

  useEffect(() => {
    const m = map.current;
    const g = layer.current;
    if (!m || !g) return;
    g.clearLayers();
    for (const path of paths) L.polyline(path, { color: '#60a5fa', weight: 4, opacity: 0.9 }).addTo(g);
    // Pontos no mesmo lugar (ex.: casa na ida e na volta) aparecem uma vez só; o do orçamento fica por cima.
    const seen = new Set<string>();
    for (const p of [...points].sort((a, b) => Number(a.kind === 'new') - Number(b.kind === 'new'))) {
      const key = `${p.kind}:${p.lat},${p.lng}`;
      if (seen.has(key)) continue;
      seen.add(key);
      L.marker([p.lat, p.lng], { icon: icon(p), title: p.label, zIndexOffset: p.kind === 'new' ? 1000 : 0 }).bindTooltip(p.label).addTo(g);
    }
    const all = [...points.map((p) => [p.lat, p.lng] as [number, number]), ...paths.flat()];
    if (all.length > 0) m.fitBounds(L.latLngBounds(all), { padding: [30, 30], maxZoom: 14 });
  }, [points, paths]);

  // Altura fixa no próprio elemento: o Leaflet mede o espaço ao nascer e precisa dela já aplicada.
  return <div ref={el} style={{ height: 340 }} className="w-full overflow-hidden rounded-xl border border-white/10" role="region" aria-label="Mapa do trajeto" />;
}
