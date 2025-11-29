import {create} from 'zustand';
import { User } from '@/types';

const STORAGE_KEY = 'facetime_auth';

type UserState = {
  user: User | null;
  setUser: (u: User | null) => void;
  clearUser: () => void;
  getUsername: () => string | null;
  getUserId: () => number | null;
  loadFromStorage: () => void;
};

export const useUserStore = create<UserState>((set, get) => ({
  user: null,

  setUser: (u: User | null) => {
    set({ user: u });

    // Persist user into the shared auth blob if present
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      parsed.user = u ?? null;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    } catch {
      // ignore storage errors
    }
  },

  clearUser: () => {
    set({ user: null });
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        parsed.user = null;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
      }
    } catch {
      // ignore
    }
  },

  getUsername: () => {
    const { user } = get();
    if (user) return (user as any).username ?? (user as any).name ?? null;

    // fallback to persisted blob
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const u = parsed?.user;
        return u?.username ?? u?.name ?? null;
      }
    } catch {
      /* ignore */
    }

    // fallback to sessionStorage
    return sessionStorage.getItem('username') ?? null;
  },

  getUserId: () => {
    const { user } = get();
    if (user && (user as any).id) return Number((user as any).id);
    const ss = sessionStorage.getItem('userId');
    return ss ? Number(ss) : null;
  },

  loadFromStorage: () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { user?: User | null };
      if (parsed?.user) set({ user: parsed.user });
    } catch {
      // ignore
    }
  }
}));