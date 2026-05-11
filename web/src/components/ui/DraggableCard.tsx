import type { ReactNode } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Props {
  id: string;
  title: string;
  children: ReactNode;
}

export function DraggableCard({ id, title, children }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      className="info-card"
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        zIndex: isDragging ? 10 : undefined,
      }}
    >
      <div className="info-card__header">
        <span className="info-card__title">{title}</span>
        <button className="info-card__drag-handle" {...listeners} {...attributes} title="Drag to reorder">
          ⠿
        </button>
      </div>
      <div className="info-card__body">{children}</div>
    </div>
  );
}
