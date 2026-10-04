import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, GripVertical, RotateCcw, type LucideIcon } from 'lucide-react';
import { moveNavItem, resolveNavOrder, shiftNavItem } from '../../services/adminNav.js';

export interface NavItem<Id extends string = string> { id: Id; label: string; icon: LucideIcon }
export interface NavGroup<Id extends string = string> { key: string; label: string; icon: LucideIcon; ids: Id[] }

const storageKey = (uid: string) => `hdc.admin.navOrder.${uid}`;
const readSaved = (uid: string): unknown => { try { return JSON.parse(localStorage.getItem(storageKey(uid)) ?? 'null'); } catch { return null; } };
const writeSaved = (uid: string, order: string[] | null) => {
  try { if (order) localStorage.setItem(storageKey(uid), JSON.stringify(order)); else localStorage.removeItem(storageKey(uid)); } catch { /* sem persistência disponível: vale só nesta sessão */ }
};

/**
 * Ordem dos módulos reorganizáveis, individual por administrador (uid) e salva neste navegador (localStorage).
 * Ids salvos que não existem mais são ignorados e módulos novos entram no fim: a personalização nunca esconde um módulo.
 * Se o uid mudar com o componente montado, a ordem do novo usuário é relida (a do anterior nunca vaza).
 */
export function useNavOrder<Id extends string>(uid: string | undefined, defaultIds: readonly Id[]) {
  const key = uid ?? 'anon';
  const [state, setState] = useState<{ key: string; saved: unknown }>(() => ({ key, saved: readSaved(key) }));
  const saved = state.key === key ? state.saved : readSaved(key);
  const order = useMemo(() => resolveNavOrder(defaultIds, saved) as Id[], [defaultIds, saved]);
  const setOrder = useCallback((next: Id[]) => { setState({ key, saved: next }); writeSaved(key, next); }, [key]);
  const reset = useCallback(() => { setState({ key, saved: null }); writeSaved(key, null); }, [key]);
  return { order, setOrder, reset, customized: saved !== null && order.join() !== defaultIds.join() };
}

interface Props<Id extends string> {
  pinned: NavItem<Id>[];
  items: NavItem<Id>[];
  groups: NavGroup<Id>[];
  order: Id[];
  onReorder: (next: Id[]) => void;
  onReset: () => void;
  customized: boolean;
  current: Id;
  onSelect: (id: Id) => void;
  /** null = ainda carregando ou indisponível; nunca é exibido como zero. */
  ordersCount: number | null;
  ordersCountFailed: boolean;
  variant: 'desktop' | 'mobile';
}

const smallBtn = 'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/60 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-25 disabled:hover:bg-transparent';

/**
 * Navegação lateral: "pinned" fica fixo no topo; os demais módulos podem ser arrastados (mouse), movidos com Alt + ↑/↓
 * ou, no modo "Reordenar" (alternativa por toque), com os botões ▲ ▼.
 */
export function AdminNav<Id extends string>({ pinned, items, groups, order, onReorder, onReset, customized, current, onSelect, ordersCount, ordersCountFailed, variant }: Props<Id>) {
  const [dragging, setDragging] = useState<Id | null>(null);
  const [over, setOver] = useState<{ id: Id; position: 'before' | 'after' } | null>(null);
  const [announce, setAnnounce] = useState('');
  const [editing, setEditing] = useState(false);
  const byId = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const sorted = order.map((id) => byId.get(id)).filter((item): item is NavItem<Id> => !!item);

  const groupOf = (id: Id) => groups.find((group) => group.ids.includes(id));
  // Só uma categoria aberta por vez; a da página atual abre sozinha ao navegar.
  const [openKey, setOpenKey] = useState<string | null>(() => groupOf(current)?.key ?? null);
  useEffect(() => { const key = groupOf(current)?.key; if (key) setOpenKey(key); }, [current]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reordena só dentro da categoria: troca com o vizinho do mesmo grupo e devolve os itens aos mesmos "slots" da ordem global.
  const move = (id: Id, delta: -1 | 1, focusId: string) => {
    const group = groupOf(id);
    if (!group) return;
    const inGroup = order.filter((x) => group.ids.includes(x));
    const shifted = shiftNavItem(inGroup, id, delta) as Id[];
    if (shifted === inGroup) return;
    let i = 0;
    const next = order.map((x) => (group.ids.includes(x) ? shifted[i++] : x));
    onReorder(next);
    setAnnounce(`${byId.get(id)?.label} movido para a posição ${next.indexOf(id) + 1} de ${next.length}.`);
    // o foco acompanha o item movido (o React reordena os nós e o navegador pode soltá-lo)
    requestAnimationFrame(() => document.getElementById(focusId)?.focus());
  };

  const renderButton = (item: NavItem<Id>, extra?: Partial<React.ButtonHTMLAttributes<HTMLButtonElement>>) => {
    const Icon = item.icon;
    const active = current === item.id;
    const showCount = item.id === ('orders' as Id);
    const label = ordersCountFailed ? 'Não foi possível contar os pedidos em andamento' : ordersCount === 1 ? '1 pedido em andamento' : `${ordersCount} pedidos em andamento`;
    return (
      <button
        type="button"
        onClick={() => onSelect(item.id)}
        aria-current={active ? 'page' : undefined}
        className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
          active ? `bg-blue-600 text-white${variant === 'desktop' ? ' shadow-lg shadow-blue-600/20' : ''}` : 'text-white/70 hover:bg-white/5 hover:text-white'
        }`}
        {...extra}
      >
        <span className="flex min-w-0 items-center gap-3">
          <Icon className={`w-4 h-4 shrink-0 ${active || variant === 'mobile' ? 'text-white' : 'text-white/50'}`} />
          <span className="truncate">{item.label}</span>
        </span>
        {showCount && (ordersCountFailed || (ordersCount !== null && ordersCount > 0)) && (
          <span
            className={`flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full px-1.5 text-[10px] font-bold leading-none tabular-nums ${
              ordersCountFailed ? 'bg-white/15 text-white/70' : 'bg-amber-400 text-[#0B1120]'
            }`}
            aria-label={label}
            title={label}
          >
            {ordersCountFailed ? '!' : ordersCount! > 99 ? '99+' : ordersCount}
          </span>
        )}
      </button>
    );
  };

  return (
    <>
      <div role="status" aria-live="polite" className="sr-only">{announce}</div>
      <ul className="mb-1.5 space-y-1">{pinned.map((item) => <li key={item.id}>{renderButton(item)}</li>)}</ul>
      <ul className="space-y-1" onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setOver(null); }}>
        {groups.map((group) => {
          const GroupIcon = group.icon;
          const open = openKey === group.key;
          const groupItems = sorted.filter((item) => group.ids.includes(item.id));
          const hasCurrent = group.ids.includes(current);
          return (
            <li key={group.key}>
              <button
                type="button"
                onClick={() => setOpenKey(open ? null : group.key)}
                aria-expanded={open}
                aria-controls={`nav-${variant}-${group.key}`}
                className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-colors hover:bg-white/5 ${hasCurrent ? 'text-blue-400' : 'text-white/50 hover:text-white'}`}
              >
                <span className="flex items-center gap-3"><GroupIcon className="w-4 h-4 shrink-0" />{group.label}</span>
                <ChevronDown aria-hidden className={`w-4 h-4 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
              </button>
              <div id={`nav-${variant}-${group.key}`} className={`grid transition-[grid-template-rows] duration-200 ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                <ul className={`min-h-0 overflow-hidden space-y-1 ml-5 border-l border-white/10 pl-2 ${open ? 'mt-1' : 'invisible'}`}>
                  {groupItems.map((item, index) => {
                  const showBefore = over?.id === item.id && over.position === 'before' && dragging !== item.id;
                  const showAfter = over?.id === item.id && over.position === 'after' && dragging !== item.id;
                  const buttonId = `nav-${variant}-${item.id}`;
                  return (
                    <li
                      key={item.id}
                      draggable={!editing}
                      onDragStart={(event) => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', item.id); setDragging(item.id); }}
                      onDragEnd={() => { setDragging(null); setOver(null); }}
                      onDragOver={(event) => {
                        if (!dragging || groupOf(dragging) !== group) return;
                        event.preventDefault();
                        event.dataTransfer.dropEffect = 'move';
                        const rect = event.currentTarget.getBoundingClientRect();
                        const position = event.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
                        if (over?.id !== item.id || over.position !== position) setOver({ id: item.id, position });
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        if (dragging && over && groupOf(dragging) === group) onReorder(moveNavItem(order, dragging, over.id, over.position) as Id[]);
                        setDragging(null);
                        setOver(null);
                      }}
                      className={`group relative flex items-center gap-1 rounded-xl ${dragging === item.id ? 'opacity-40' : ''}`}
                    >
                      {showBefore && <span aria-hidden className="pointer-events-none absolute -top-1 left-2 right-2 h-0.5 rounded bg-blue-400" />}
                      <div className="min-w-0 flex-1">
                        {renderButton(item, {
                          id: buttonId,
                          onKeyDown: (event) => {
                            if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
                              event.preventDefault();
                              move(item.id, event.key === 'ArrowUp' ? -1 : 1, buttonId);
                            }
                          },
                          'aria-keyshortcuts': 'Alt+ArrowUp Alt+ArrowDown',
                        } as Partial<React.ButtonHTMLAttributes<HTMLButtonElement>>)}
                      </div>
                      {!editing && <GripVertical aria-hidden className="pointer-events-none absolute left-0.5 top-1/2 hidden h-3 w-3 -translate-y-1/2 text-white/30 group-hover:block" />}
                      {editing && (
                        <>
                          <button type="button" id={`${buttonId}-up`} className={smallBtn} disabled={index === 0} aria-label={`Mover ${item.label} para cima`} onClick={() => move(item.id, -1, `${buttonId}-up`)}>
                            <ChevronUp className="h-4 w-4" aria-hidden />
                          </button>
                          <button type="button" id={`${buttonId}-down`} className={smallBtn} disabled={index === groupItems.length - 1} aria-label={`Mover ${item.label} para baixo`} onClick={() => move(item.id, 1, `${buttonId}-down`)}>
                            <ChevronDown className="h-4 w-4" aria-hidden />
                          </button>
                        </>
                      )}
                      {showAfter && <span aria-hidden className="pointer-events-none absolute -bottom-1 left-2 right-2 h-0.5 rounded bg-blue-400" />}
                    </li>
                  );
                  })}
                </ul>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="mt-2 flex items-center justify-between gap-2">
        <button type="button" onClick={() => setEditing((value) => !value)} aria-pressed={editing}
          className="rounded-lg px-2 py-1.5 text-[11px] font-medium text-white/40 transition-colors hover:bg-white/5 hover:text-white/70">
          {editing ? 'Concluir' : 'Reordenar'}
        </button>
        {customized && (
          <button type="button" onClick={onReset} className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-medium text-white/40 transition-colors hover:bg-white/5 hover:text-white/70">
            <RotateCcw className="h-3 w-3" aria-hidden />
            Restaurar padrão
          </button>
        )}
      </div>
    </>
  );
}
