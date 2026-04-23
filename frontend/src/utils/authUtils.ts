export const PW_RULES = [
  { label: '8자 이상',      test: (v: string) => v.length >= 8 },
  { label: '영문 포함',      test: (v: string) => /[A-Za-z]/.test(v) },
  { label: '숫자 포함',      test: (v: string) => /\d/.test(v) },
  {
    label: '특수문자 포함',
    test: (v: string) => {
      const specialChars = '!@#$%^&*()_+-=[]{};:\'"\\|,.<>/?';
      return [...v].some((ch) => specialChars.includes(ch));
    },
  },
];

export const isPasswordValid = (v: string) => PW_RULES.every((r) => r.test(v));

export const AUTH_REMEMBER_PREFERENCE_KEY = 'crm-auth-remember-preference';
const SOCIAL_REMEMBER_ME_KEY = 'crm-social-remember-me';

export function getApiErrorMessage(err: unknown, fallback: string): string {
  const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
  return msg ?? fallback;
}

export function getRememberMePreference(defaultValue = true): boolean {
  try {
    const raw = localStorage.getItem(AUTH_REMEMBER_PREFERENCE_KEY);
    if (raw == null) return defaultValue;
    return raw === 'true';
  } catch {
    return defaultValue;
  }
}

export function setRememberMePreference(rememberMe: boolean): void {
  try {
    localStorage.setItem(AUTH_REMEMBER_PREFERENCE_KEY, String(rememberMe));
  } catch {
    // ignore storage errors
  }
}

export function setPendingSocialRememberMe(rememberMe: boolean): void {
  try {
    sessionStorage.setItem(SOCIAL_REMEMBER_ME_KEY, String(rememberMe));
  } catch {
    // ignore storage errors
  }
  setRememberMePreference(rememberMe);
}

export function consumePendingSocialRememberMe(): boolean {
  try {
    const raw = sessionStorage.getItem(SOCIAL_REMEMBER_ME_KEY);
    if (raw != null) {
      sessionStorage.removeItem(SOCIAL_REMEMBER_ME_KEY);
      return raw === 'true';
    }
  } catch {
    // ignore storage errors
  }
  return getRememberMePreference();
}
