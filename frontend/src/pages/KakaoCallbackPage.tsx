import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { socialLogin } from '../api/index';
import { useAuthStore } from '../store/authStore';
import { consumePendingSocialRememberMe } from '../utils/authUtils';

export default function KakaoCallbackPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const setAuth = useAuthStore((s) => s.setAuth);
  const setPersistence = useAuthStore((s) => s.setPersistence);
  const [searchParams] = useSearchParams();
  const called = useRef(false);
  const [error, setError] = useState('');
  const validationError = useMemo(() => {
    if (!searchParams.get('code')) return '인증 코드가 없습니다. 다시 시도해 주세요.';
    return '';
  }, [searchParams]);

  useEffect(() => {
    if (called.current) return;
    called.current = true;
    if (validationError) return;

    const codeFromParams = searchParams.get('code');
    if (!codeFromParams) return;
    const code = codeFromParams;
    const run = async () => {
      const redirectUri = `${window.location.origin}/auth/kakao/callback`;
      const rememberMe = consumePendingSocialRememberMe();
      try {
        const res = await socialLogin('kakao', {
          code,
          redirect_uri: redirectUri,
          rememberMe: String(rememberMe),
        });
        queryClient.clear();
        setPersistence(rememberMe);
        setAuth(
          res.email,
          res.name,
          {
            careerLevel: res.careerLevel,
            desiredJob: res.desiredJob,
            techStack: res.techStack,
            desiredIndustry: res.desiredIndustry,
            resumeText: res.resumeText,
            hasPassword: res.hasPassword,
            provider: 'kakao',
          },
        );
        navigate(res.isNewUser ? '/social-setup' : '/chat');
      } catch {
        setError('카카오 로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.');
      }
    };
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
        <p className="text-muted text-sm animate-pulse">카카오 로그인 중...</p>
      )}
    </div>
  );
}
