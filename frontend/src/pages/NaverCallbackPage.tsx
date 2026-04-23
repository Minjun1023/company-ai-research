import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { socialLogin } from '../api/index';
import { useAuthStore } from '../store/authStore';
import { consumePendingSocialRememberMe } from '../utils/authUtils';

export default function NaverCallbackPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const setAuth = useAuthStore((s) => s.setAuth);
  const setPersistence = useAuthStore((s) => s.setPersistence);
  const [searchParams] = useSearchParams();
  const called = useRef(false);
  const [error, setError] = useState('');
  const validationError = useMemo(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const savedState = sessionStorage.getItem('naver_oauth_state');
    if (!code) return '인증 코드가 없습니다. 다시 시도해 주세요.';
    if (!state || state !== savedState) return '보안 검증에 실패했습니다. 다시 시도해 주세요.';
    return '';
  }, [searchParams]);

  useEffect(() => {
    if (called.current) return;
    called.current = true;
    if (validationError) return;

    const savedState = sessionStorage.getItem('naver_oauth_state');
    const codeFromParams = searchParams.get('code');
    const stateFromParams = searchParams.get('state');
    if (!codeFromParams || !stateFromParams) return;
    if (stateFromParams !== savedState) return;
    const code = codeFromParams;
    const state = stateFromParams;

    const run = async () => {
      const rememberMe = consumePendingSocialRememberMe();
      try {
        const res = await socialLogin('naver', { code, state, rememberMe: String(rememberMe) });
        queryClient.clear();
        setPersistence(rememberMe);
        setAuth(res.email, res.name, {
          careerLevel: res.careerLevel,
          desiredJob: res.desiredJob,
          techStack: res.techStack,
          desiredIndustry: res.desiredIndustry,
          resumeText: res.resumeText,
          hasPassword: res.hasPassword,
          provider: 'naver',
        });
        navigate(res.isNewUser ? '/social-setup' : '/chat');
      } catch {
        setError('네이버 로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.');
      }
    };

    if (savedState) sessionStorage.removeItem('naver_oauth_state');
    void run();
  }, [validationError, navigate, queryClient, searchParams, setAuth, setPersistence]);

  if (validationError) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center px-6">
          <p className="text-[#ff9090] text-sm">{validationError}</p>
          <button
            onClick={() => navigate('/login')}
            className="px-4 py-2 rounded-xl text-sm text-text border border-border hover:bg-surface transition-colors"
          >
            로그인 페이지로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      {error ? (
        <div className="flex flex-col items-center gap-4 text-center px-6">
          <p className="text-[#ff9090] text-sm">{error}</p>
          <button
            onClick={() => navigate('/login')}
            className="px-4 py-2 rounded-xl text-sm text-text border border-border hover:bg-surface transition-colors"
          >
            로그인 페이지로 돌아가기
          </button>
        </div>
      ) : (
        <p className="text-muted text-sm animate-pulse">네이버 로그인 중...</p>
      )}
    </div>
  );
}
