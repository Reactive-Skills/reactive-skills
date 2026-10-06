import { IModsContentSource } from '@/contracts/ModsContentSource';
import { mods } from '@/infrastructure/content/mods';

/**
 * In-memory implementation of the mods content boundary.
 *
 * @implements {IModsContentSource}
 */
export class InMemoryModsContentSource extends IModsContentSource {
  constructor(source = mods) {
    super();
    this._mods = source;
  }

  listMods() {
    return this._mods.map((m) => ({ ...m }));
  }

  getMod(slug) {
    const found = this._mods.find((m) => m.slug === slug);
    return found ? { ...found } : null;
  }
}
