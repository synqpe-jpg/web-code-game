import type { GameEventItem, GameEventStatus } from '../types/gameEvent';
import { SEED_GAME_EVENTS } from '../data/seedGameEvents';

class GameEventService {
  private readonly STORAGE_KEY = 'wcg_game_events_v1';
  private readonly DELETED_STORAGE_KEY = 'wcg_deleted_game_events_v1';
  private events: GameEventItem[] = [];
  private deletedIds = new Set<string>();
  private isLoaded = false;

  constructor() {
    this.init();
  }

  private init(): void {
    if (typeof window === 'undefined') return;

    try {
      const deletedRaw = localStorage.getItem(this.DELETED_STORAGE_KEY);
      if (deletedRaw) {
        const parsed = JSON.parse(deletedRaw);
        if (Array.isArray(parsed)) {
          this.deletedIds = new Set(parsed);
        }
      }

      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const parsed: GameEventItem[] = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.events = parsed.filter((e) => e && e.id && !this.deletedIds.has(e.id));
        }
      }

      if (this.events.length === 0) {
        this.events = SEED_GAME_EVENTS.filter((e) => !this.deletedIds.has(e.id));
        this.saveToStorage();
      }
      this.isLoaded = true;
    } catch {
      this.events = [...SEED_GAME_EVENTS];
    }
  }

  private saveToStorage(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.events));
      localStorage.setItem(this.DELETED_STORAGE_KEY, JSON.stringify(Array.from(this.deletedIds)));
    } catch {}
  }

  private broadcast(): void {
    if (typeof window === 'undefined') return;
    try {
      window.dispatchEvent(new CustomEvent('wcg_game_events_updated', { detail: { events: this.events } }));
    } catch {}
  }

  public getAllEvents(): GameEventItem[] {
    if (!this.isLoaded) this.init();
    return [...this.events];
  }

  public getPublishedEvents(): GameEventItem[] {
    return this.getAllEvents().filter((e) => e.status === 'PUBLISHED');
  }

  public getPendingEvents(): GameEventItem[] {
    return this.getAllEvents().filter((e) => e.status === 'PENDING');
  }

  public getEventById(id: string): GameEventItem | undefined {
    return this.getAllEvents().find((e) => e.id === id);
  }

  public saveEvent(item: GameEventItem): GameEventItem {
    const existingIndex = this.events.findIndex((e) => e.id === item.id);
    const nowIso = new Date().toISOString();
    const updated: GameEventItem = {
      ...item,
      updated_at: nowIso,
    };

    if (existingIndex >= 0) {
      this.events[existingIndex] = updated;
    } else {
      this.events.unshift(updated);
    }
    this.deletedIds.delete(item.id);
    this.saveToStorage();
    this.broadcast();
    return updated;
  }

  public deleteEvent(id: string): boolean {
    const initialLen = this.events.length;
    this.events = this.events.filter((e) => e.id !== id);
    this.deletedIds.add(id);
    this.saveToStorage();
    this.broadcast();
    return this.events.length < initialLen;
  }

  public approveEvent(id: string): boolean {
    const ev = this.events.find((e) => e.id === id);
    if (!ev) return false;
    ev.status = 'PUBLISHED';
    ev.updated_at = new Date().toISOString();
    this.saveToStorage();
    this.broadcast();
    return true;
  }

  public rejectEvent(id: string): boolean {
    const ev = this.events.find((e) => e.id === id);
    if (!ev) return false;
    ev.status = 'REJECTED';
    ev.updated_at = new Date().toISOString();
    this.saveToStorage();
    this.broadcast();
    return true;
  }

  public async fetchFreshEventsFromServer(): Promise<GameEventItem[]> {
    if (typeof window === 'undefined') return this.events;
    try {
      const res = await fetch('/api/events?limit=all');
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.events)) {
          const serverList: GameEventItem[] = json.events;
          const mergedMap = new Map<string, GameEventItem>();
          serverList.forEach((e) => {
            if (e && e.id && !this.deletedIds.has(e.id)) {
              mergedMap.set(e.id, e);
            }
          });
          // Preserve local items not on server yet
          this.events.forEach((local) => {
            if (local && local.id && !this.deletedIds.has(local.id) && !mergedMap.has(local.id)) {
              mergedMap.set(local.id, local);
            }
          });
          this.events = Array.from(mergedMap.values());
          this.saveToStorage();
          this.broadcast();
        }
      }
    } catch {}
    return this.events;
  }
}

export const gameEventService = new GameEventService();
