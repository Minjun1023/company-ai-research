import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GoogleOAuthProvider } from '@react-oauth/google';
import Layout from './components/Layout';
import LandingPage from './pages/LandingPage';
import ChatPage from './pages/ChatPage';
import WorkspacePage from './pages/WorkspacePage';
import ExplorePage from './pages/ExplorePage';
import CompanyDetailPage from './pages/CompanyDetailPage';
import SettingsPage from './pages/SettingsPage';

import WithdrawPage from './pages/WithdrawPage';
import SocialSetupPage from './pages/SocialSetupPage';
import ProfileDetailPage from './pages/ProfileDetailPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import KakaoCallbackPage from './pages/KakaoCallbackPage';
import NaverCallbackPage from './pages/NaverCallbackPage';
import { useAuthStore } from './store/authStore';
import { useThemeStore } from './store/themeStore';
import { getCurrentUser } from './api';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';

function ProtectedRoute({ children, authChecked }: { children: React.ReactNode; authChecked: boolean }) {
  const name = useAuthStore((s) => s.name);
  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <p className="text-muted text-sm animate-pulse">인증 상태 확인 중...</p>
      </div>
    );
  }
  if (!name) return <Navigate to="/login" replace />;
  return <>{children}</>;
}


function AppContent() {
  const { isDark } = useThemeStore();
  const setAuth = useAuthStore((s) => s.setAuth);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle('light', !isDark);
  }, [isDark]);

  useEffect(() => {
    let cancelled = false;

    const bootstrapAuth = async () => {
      try {
        const res = await getCurrentUser();
        if (cancelled) return;
        setAuth(res.email, res.name, {
          careerLevel: res.careerLevel,
          desiredJob: res.desiredJob,
          techStack: res.techStack,
          desiredIndustry: res.desiredIndustry,
          resumeText: res.resumeText,
          hasPassword: res.hasPassword,
        });
      } catch {
        if (cancelled) return;
        clearAuth();
      } finally {
        if (!cancelled) setAuthChecked(true);
      }
    };

    void bootstrapAuth();
    return () => {
      cancelled = true;
    };
  }, [clearAuth, setAuth]);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/auth/kakao/callback" element={<KakaoCallbackPage />} />
          <Route path="/auth/naver/callback" element={<NaverCallbackPage />} />
          <Route path="/social-setup" element={<SocialSetupPage />} />
          <Route
            element={
              <ProtectedRoute authChecked={authChecked}>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="chat" element={<ChatPage />} />
            <Route path="research" element={<WorkspacePage sessionType="research" />} />
            <Route path="compare" element={<WorkspacePage sessionType="compare" />} />
            <Route path="interview" element={<WorkspacePage sessionType="interview" />} />
            <Route path="coverletter" element={<WorkspacePage sessionType="coverletter" />} />
            <Route path="salary" element={<WorkspacePage sessionType="salary" />} />
            <Route path="explore" element={<ExplorePage />} />
            <Route path="explore/:id" element={<CompanyDetailPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="settings/profile" element={<ProfileDetailPage />} />

            <Route path="withdraw" element={<WithdrawPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID || 'placeholder'}>
      <AppContent />
    </GoogleOAuthProvider>
  );
}
