import { api } from '../api/client';

interface PendingOp {
  id: string;
  label: string;
  url: string;
  method: string;
  body: string;
  attempts: number;
}

const MAX_ATTEMPTS = 5;
const queue: PendingOp[] = [];
let flushing = false;

function opId() {
  return Math.random().toString(36).slice(2, 9);
}

export function enqueue(label: string, url: string, method: string, body: string) {
  queue.push({ id: opId(), label, url, method, body, attempts: 0 });
  console.warn(`[queue] Enqueued (${queue.length} pending): ${label}`);
}

export async function flushQueue(): Promise<void> {
  if (flushing || queue.length === 0) return;
  flushing = true;

  const snapshot = [...queue];
  queue.length = 0;

  for (const op of snapshot) {
    try {
      await api(op.url, { method: op.method, body: op.body });
      console.log(`[queue] Flushed: ${op.label}`);
    } catch {
      op.attempts += 1;
      if (op.attempts < MAX_ATTEMPTS) {
        queue.push(op);
        console.warn(`[queue] Re-queued (attempt ${op.attempts}/${MAX_ATTEMPTS}): ${op.label}`);
      } else {
        console.error(`[queue] Dropped after ${MAX_ATTEMPTS} attempts: ${op.label}`);
      }
    }
  }

  flushing = false;
}

export function getQueue(): PendingOp[] {
  return [...queue];
}

export function clearQueue(): void {
  queue.length = 0;
}
