import React, { useState, type ReactNode } from 'react';
import { closestCenter, DndContext, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

/**
 * Área de reordenar roteiros: o card segue o ponteiro (overlay) e os vizinhos deslizam abrindo o espaço onde ele vai cair.
 * Só reordena dentro do mesmo grupo (no Kanban, a mesma coluna); `onMove` recebe o arrastado e o alvo.
 */
export const SortableArea: React.FC<{ onMove: (draggedId: string, targetId: string) => void; renderOverlay: (id: string) => ReactNode; children: ReactNode }> = ({ onMove, renderOverlay, children }) => {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), // clique curto continua abrindo o roteiro
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }), // celular: segurar para arrastar; deslizar rola a página
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const handleEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    const sameGroup = active.data.current?.sortable?.containerId === over?.data.current?.sortable?.containerId;
    if (over && active.id !== over.id && sameGroup) onMove(String(active.id), String(over.id));
  };
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={({ active }) => setActiveId(String(active.id))} onDragEnd={handleEnd} onDragCancel={() => setActiveId(null)}>
      {children}
      <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.2, 0, 0, 1)' }}>
        {activeId && <div className="rotate-1 scale-[1.02] cursor-grabbing rounded-xl bg-[#0D1527] shadow-2xl shadow-black/60">{renderOverlay(activeId)}</div>}
      </DragOverlay>
    </DndContext>
  );
};

export const SortableGroup: React.FC<{ id: string; ids: string[]; children: ReactNode }> = ({ id, ids, children }) => (
  <SortableContext id={id} items={ids} strategy={verticalListSortingStrategy}>{children}</SortableContext>
);

/** Item arrastável; enquanto está sendo arrastado, vira o espaço tracejado onde o card vai cair. */
export const SortableItem: React.FC<{ id: string; children: ReactNode }> = ({ id, children }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }} {...attributes} {...listeners}
      className={`touch-manipulation rounded-xl ${isDragging ? 'bg-blue-500/[0.06] outline-dashed outline-2 -outline-offset-2 outline-blue-400/60' : 'cursor-grab'}`}>
      <div className={isDragging ? 'invisible' : ''}>{children}</div>
    </div>
  );
};
