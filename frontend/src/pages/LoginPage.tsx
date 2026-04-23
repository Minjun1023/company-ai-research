import { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';
import { useQueryClient } from '@tanstack/react-query';
import { login, socialLogin } from '../api/index';
import { useAuthStore } from '../store/authStore';
import {
  getApiErrorMessage,
  getRememberMePreference,
  setPendingSocialRememberMe,
  setRememberMePreference,
} from '../utils/authUtils';
import BrandLogo from '../components/BrandLogo';

const KAKAO_KEY = import.meta.env.VITE_KAKAO_REST_API_KEY ?? '';
const NAVER_ID = import.meta.env.VITE_NAVER_CLIENT_ID ?? '';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const setAuth = useAuthStore((s) => s.setAuth);
  const setPersistence = useAuthStore((s) => s.setPersistence);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(() => getRememberMePreference());
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const successMessage = (location.state as { message?: string } | null)?.message ?? '';
  const inputStyle = {
    backgroundColor: 'var(--color-input)',
    border: '1px solid var(--color-input-border)',
    color: 'var(--color-text)',
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await login(email, password, rememberMe);
      queryClient.clear();
      setRememberMePreference(rememberMe);
      setPersistence(rememberMe);
      setAuth(res.email, res.name, {
        careerLevel: res.careerLevel,
        desiredJob: res.desiredJob,
        techStack: res.techStack,
        desiredIndustry: res.desiredIndustry,
        resumeText: res.resumeText,
        hasPassword: res.hasPassword,
        provider: 'email',
      });
      navigate('/chat');
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, '이메일 또는 비밀번호가 올바르지 않습니다.'));
    } finally {
      setLoading(false);
    }
  };

  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        const res = await socialLogin('google', {
          token: tokenResponse.access_token,
          rememberMe: String(rememberMe),
        });
        queryClient.clear();
        setRememberMePreference(rememberMe);
        setPersistence(rememberMe);
        setAuth(res.email, res.name, {
          careerLevel: res.careerLevel,
          desiredJob: res.desiredJob,
          techStack: res.techStack,
          desiredIndustry: res.desiredIndustry,
          resumeText: res.resumeText,
          hasPassword: res.hasPassword,
          provider: 'google',
        });
        navigate(res.isNewUser ? '/social-setup' : '/chat');
      } catch {
        setError('Google 로그인에 실패했습니다.');
      }
    },
    onError: () => setError('Google 로그인에 실패했습니다.'),
  });

  const handleKakaoLogin = () => {
    if (!KAKAO_KEY) { setError('Kakao 앱 키가 설정되지 않았습니다.'); return; }
    setPendingSocialRememberMe(rememberMe);
    const redirectUri = `${window.location.origin}/auth/kakao/callback`;
    window.location.href =
      `https://kauth.kakao.com/oauth/authorize?client_id=${KAKAO_KEY}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code`;
  };

  const handleNaverLogin = () => {
    if (!NAVER_ID) { setError('Naver 클라이언트 ID가 설정되지 않았습니다.'); return; }
    setPendingSocialRememberMe(rememberMe);
    const redirectUri = `${window.location.origin}/auth/naver/callback`;
    const state = Math.random().toString(36).slice(2);
    sessionStorage.setItem('naver_oauth_state', state);
    window.location.href =
      `https://nid.naver.com/oauth2.0/authorize?client_id=${NAVER_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&state=${state}`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-bg)' }}>
      <div className="relative w-full max-w-sm rounded-2xl p-8" style={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)' }}>

        {/* X 버튼 */}
        <button
          onClick={() => navigate('/', { replace: true })}
          className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded-lg transition-colors text-base"
          style={{ color: 'var(--color-muted)' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-text)'; e.currentTarget.style.backgroundColor = 'var(--color-surface)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-muted)'; e.currentTarget.style.backgroundColor = 'transparent'; }}
          aria-label="닫기"
        >
          ✕
        </button>

        <BrandLogo size="compact" className="mb-6" />

        <h1 className="text-xl font-semibold mb-5 text-[var(--color-text)]">로그인</h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-sm block mb-1 text-[var(--color-muted)]">이메일</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-xl px-3 py-2 text-sm outline-none"
              style={inputStyle}
              placeholder="example@email.com"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm text-[var(--color-muted)]">비밀번호</label>
              <Link to="/forgot-password" className="text-xs text-accent hover:underline">
                비밀번호 찾기
              </Link>
            </div>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-xl px-3 py-2 pr-10 text-sm outline-none"
                style={inputStyle}
                placeholder="********"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs"
                style={{ color: 'var(--color-muted)' }}
              >
                {showPw ? '숨김' : '보기'}
              </button>
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--color-muted)]">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-4 w-4 rounded border-[var(--color-input-border)] accent-[var(--color-text)]"
            />
            로그인 상태 유지
          </label>

          {successMessage && <p className="text-xs text-accent">{successMessage}</p>}
          {error && <p className="text-xs" style={{ color: '#ff9090' }}>{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl text-sm font-medium bg-accent text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>

        {/* 구분선 */}
        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px" style={{ backgroundColor: 'var(--color-border)' }} />
          <span className="text-xs text-[var(--color-muted)]">또는 소셜 로그인</span>
          <div className="flex-1 h-px" style={{ backgroundColor: 'var(--color-border)' }} />
        </div>

        {/* 소셜 로그인 버튼 */}
        <div className="flex flex-col gap-3">
          <button
            onClick={() => googleLogin()}
            className="w-full py-2.5 rounded-xl text-sm font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            style={{ backgroundColor: '#fff', color: '#191919' }}
          >
            <svg width="18" height="18" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            Google로 로그인
          </button>

          <button
            onClick={handleKakaoLogin}
            className="w-full py-2.5 rounded-xl text-sm font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            style={{ backgroundColor: '#FEE500', color: '#191919' }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path fillRule="evenodd" clipRule="evenodd" d="M9 0C4.029 0 0 3.134 0 7c0 2.496 1.584 4.685 3.979 5.946L3.04 16.5a.375.375 0 0 0 .557.406L8.1 14.013A10.5 10.5 0 0 0 9 14c4.971 0 9-3.134 9-7s-4.029-7-9-7z" fill="#191919"/>
            </svg>
            카카오로 로그인
          </button>

          <button
            onClick={handleNaverLogin}
            className="w-full py-2.5 rounded-xl text-sm font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            style={{ backgroundColor: '#03C75A', color: '#fff' }}
          >
            <span className="font-black text-base leading-none" style={{ color: '#fff' }}>N</span>
            네이버로 로그인
          </button>
        </div>

        <p className="text-sm text-center mt-6 text-[var(--color-muted)]">
          계정이 없으신가요?{' '}
          <Link to="/register" className="text-accent hover:underline">
            회원가입
          </Link>
        </p>
      </div>
    </div>
  );
}
