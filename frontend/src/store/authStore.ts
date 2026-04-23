import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import { AUTH_REMEMBER_PREFERENCE_KEY } from '../utils/authUtils';

export interface UserProfile {
  careerLevel: string | null;
  desiredJob: string | null;
  techStack: string | null;
  desiredIndustry: string | null;
  resumeText: string | null;
}

type AuthProvider = 'email' | 'google' | 'kakao' | 'naver' | null;

interface AuthState extends UserProfile {
  email: string | null;
  name: string | null;
  hasPassword: boolean;
  provider: AuthProvider;
  setPersistence: (rememberMe: boolean) => void;
  setAuth: (email: string, name: string, profile?: Partial<UserProfile & { hasPassword?: boolean; provider?: AuthProvider }>) => void;
  setProfile: (profile: Partial<UserProfile>) => void;
  clearAuth: () => void;
}

const emptyProfile: UserProfile = {
  careerLevel: null,
  desiredJob: null,
  techStack: null,
  desiredIndustry: null,
  resumeText: null,
};

const AUTH_STORAGE_KEY = 'crm-auth';

const getTargetStorage = (): Storage => {
  try {
    return localStorage.getItem(AUTH_REMEMBER_PREFERENCE_KEY) === 'false'
      ? sessionStorage
      : localStorage;
  } catch {
    return localStorage;
  }
};

const authStorage: StateStorage = {
  getItem: (name) => {
    try {
      return localStorage.getItem(name) ?? sessionStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    const target = getTargetStorage();
    const other = target === localStorage ? sessionStorage : localStorage;
    try {
      other.removeItem(name);
      target.setItem(name, value);
    } catch {
      // ignore storage errors
    }
  },
  removeItem: (name) => {
    try {
      localStorage.removeItem(name);
      sessionStorage.removeItem(name);
    } catch {
      // ignore storage errors
    }
  },
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      email: null,
      name: null,
      hasPassword: false,
      provider: null,
      ...emptyProfile,
      setPersistence: (rememberMe) => {
        try {
          localStorage.setItem(AUTH_REMEMBER_PREFERENCE_KEY, String(rememberMe));
          if (rememberMe) {
            sessionStorage.removeItem(AUTH_STORAGE_KEY);
          } else {
            localStorage.removeItem(AUTH_STORAGE_KEY);
          }
        } catch {
          // ignore storage errors
        }
      },
      setAuth: (email, name, profile = {}) => {
        const { hasPassword, provider, ...rest } = profile as Partial<UserProfile & { hasPassword?: boolean; provider?: AuthProvider }>;
        set({ email, name, hasPassword: hasPassword ?? false, provider: provider ?? null, ...emptyProfile, ...rest });
      },
      setProfile: (profile) => set((s) => ({ ...s, ...profile })),
      clearAuth: () => set({ email: null, name: null, hasPassword: false, provider: null, ...emptyProfile }),
    }),
    {
      name: AUTH_STORAGE_KEY,
      storage: createJSONStorage(() => authStorage),
    }
  )
);
