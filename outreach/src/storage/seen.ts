/**
 * Local de-duplication index.
 *
 * Notion has no unique constraint, so nothing there stops the scout from
 * writing the same business twice when it runs over an overlapping area. This
 * file is the constraint: a flat list of Google place ids already handled,
 * consulted before every write.
 *
 * It also survives deletions in Notion on purpose — a lead you threw away
 * should stay thrown away, not come back next Tuesday.
 */

import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export interface SeenEntry {
  firstSeen: string;
  outcome: 'written' | 'rejected';
  name?: string;
}

export class SeenIndex {
  private entries = new Map<string, SeenEntry>();

  private constructor(private readonly file: string) {}

  static async open(dataDir: string): Promise<SeenIndex> {
    const index = new SeenIndex(join(dataDir, 'seen.json'));
    await index.load();
    return index;
  }

  private async load(): Promise<void> {
    try {
      const raw = await readFile(this.file, 'utf8');
      this.entries = new Map(Object.entries(JSON.parse(raw) as Record<string, SeenEntry>));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
      this.entries = new Map();
    }
  }

  has(placeId: string): boolean {
    return this.entries.has(placeId);
  }

  get(placeId: string): SeenEntry | undefined {
    return this.entries.get(placeId);
  }

  mark(placeId: string, outcome: SeenEntry['outcome'], name?: string): void {
    if (this.entries.has(placeId)) return;
    this.entries.set(placeId, { firstSeen: new Date().toISOString(), outcome, name });
  }

  get size(): number {
    return this.entries.size;
  }

  /** Writes through a temp file so an interrupted run cannot truncate the index. */
  async save(): Promise<void> {
    await mkdir(dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    await writeFile(tmp, JSON.stringify(Object.fromEntries(this.entries), null, 2), 'utf8');
    await rename(tmp, this.file);
  }
}
