import { useRef, useState } from 'react';
import MDEditor from '@uiw/react-md-editor';

interface Props {
  value: string;
  onChange: (value: string) => void;
  compact?: boolean;
}

export function NotesEditor({ value, onChange, compact = false }: Props) {
  const [focused, setFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const enterEdit = () => {
    if (focused) return;
    setFocused(true);
    setTimeout(() => {
      containerRef.current?.querySelector<HTMLTextAreaElement>('textarea')?.focus();
    }, 0);
  };

  if (compact && !focused) {
    if (!value) {
      return (
        <div className="notes-editor notes-editor--empty" onClick={enterEdit}>
          <span className="notes-editor__placeholder">Add note…</span>
        </div>
      );
    }
    return (
      <div className="notes-editor notes-editor--preview" onClick={enterEdit} title={value}>
        {value}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="notes-editor"
      data-color-mode="dark"
      onClick={enterEdit}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setFocused(false);
      }}
    >
      <MDEditor
        value={value}
        onChange={(v) => onChange(v ?? '')}
        preview={focused ? 'live' : 'preview'}
        hideToolbar={!focused}
        height={compact ? 120 : 80}
        visibleDragbar={false}
      />
    </div>
  );
}
