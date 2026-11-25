import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { db } from '../db/db';
import type { UserLine } from '../db/types';
import { useToast } from '../state/toast';
import { PromptSheet } from './Sheet';

/** Settings > My lines: your own first and last lines, mixed into draws at the same weight. */
export function MyLines() {
  const lines = useLiveQuery(() => db.userLines.orderBy('id').toArray(), [], [] as UserLine[]);
  const [adding, setAdding] = useState<'first' | 'last' | null>(null);
  const [editing, setEditing] = useState<UserLine | null>(null);
  const toast = useToast();

  const remove = async (line: UserLine) => {
    await db.userLines.delete(line.id);
    toast({ text: 'Line deleted', action: { label: 'Undo', run: () => void db.userLines.put(line) } });
  };

  return (
    <section className="settings-section">
      <h2 className="section-label">My lines</h2>
      <p className="settings-note">Your own lines show up in First line and Last line, mixed in with the rest.</p>
      {(['first', 'last'] as const).map((kind) => {
        const mine = lines.filter((l) => l.kind === kind).sort((a, b) => a.createdAt - b.createdAt);
        return (
          <div key={kind} className="my-lines">
            <h3 className="my-lines__head">{kind === 'first' ? 'First lines' : 'Last lines'}</h3>
            {mine.length === 0 && <p className="settings-note">None yet.</p>}
            {mine.map((l) => (
              <div key={l.id} className="my-lines__row">
                <span className="my-lines__text">{l.text}</span>
                <button type="button" className="btn btn--small btn--quiet" onClick={() => setEditing(l)}>
                  Edit
                </button>
                <button type="button" className="btn btn--small btn--quiet" onClick={() => void remove(l)}>
                  Delete
                </button>
              </div>
            ))}
            <button type="button" className="btn btn--small btn--self-start" onClick={() => setAdding(kind)}>
              Add a {kind} line
            </button>
          </div>
        );
      })}
      {adding && (
        <PromptSheet
          title={adding === 'first' ? 'New first line' : 'New last line'}
          label="Line"
          initial=""
          placeholder={adding === 'first' ? 'The porch lamp has been on since June' : 'And I left the truck running'}
          onSave={(text) => {
            const t = text.trim();
            if (t) void db.userLines.add({ id: crypto.randomUUID(), kind: adding, text: t, createdAt: Date.now() });
          }}
          onClose={() => setAdding(null)}
        />
      )}
      {editing && (
        <PromptSheet
          title="Edit line"
          label="Line"
          initial={editing.text}
          onSave={(text) => {
            const t = text.trim();
            if (t) void db.userLines.update(editing.id, { text: t });
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  );
}
