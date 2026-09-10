/** A small tracked clock so Auto Play / feature / win timers cannot survive
 * unmounts. Pending waits are resolved during dispose so async flows unwind. */
export class GoldenTigerClock {
  private pending = new Map<number, () => void>();
  private disposed = false;

  wait(ms: number) {
    if (this.disposed || typeof window === "undefined") return Promise.resolve();
    return new Promise<void>((resolve) => {
      const id = window.setTimeout(() => {
        this.pending.delete(id);
        resolve();
      }, Math.max(0, ms));
      this.pending.set(id, resolve);
    });
  }

  schedule(ms: number, callback: () => void) {
    if (this.disposed || typeof window === "undefined") return () => {};
    let active = true;
    const id = window.setTimeout(() => {
      this.pending.delete(id);
      if (!active || this.disposed) return;
      active = false;
      callback();
    }, Math.max(0, ms));
    this.pending.set(id, () => { active = false; });
    return () => {
      if (!active) return;
      active = false;
      window.clearTimeout(id);
      this.pending.delete(id);
    };
  }

  dispose() {
    this.disposed = true;
    for (const [id, resolve] of this.pending) {
      window.clearTimeout(id);
      resolve();
    }
    this.pending.clear();
  }

  get pendingCount() {
    return this.pending.size;
  }
}
