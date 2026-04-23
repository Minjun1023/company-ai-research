import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { sendVerificationCode, verifyEmailCode, resetPassword, checkPasswordSame } from '../api/index';
import { PW_RULES, isPasswordValid, getApiErrorMessage } from '../utils/authUtils';
import BrandLogo from '../components/BrandLogo';

type Step = 'email' | 'verify' | 'reset';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [verifiedToken, setVerifiedToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showPwConfirm, setShowPwConfirm] = useState(false);
  const [isSameAsCurrent, setIsSameAsCurrent] = useState<boolean | null>(null);
  const [isSameChecking, setIsSameChecking] = useState(false);

  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((v) => v - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const inputStyle = { backgroundColor: 'var(--color-input)', border: '1px solid var(--color-input-border)', color: 'var(--color-text)' };

  /* ── 1단계: 인증 코드 발송 ── */
  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await sendVerificationCode(email);
      setStep('verify');
      setInfo(`${email} 로 인증 코드를 발송했습니다. (5분 유효)`);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, '인증 메일 발송에 실패했습니다.'));
    } finally {
      setLoading(false);
    }
  };

  /* ── 2단계: 코드 검증 ── */
  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (code.length !== 6) { setError('6자리 인증 코드를 입력해 주세요.'); return; }
    setLoading(true);
    try {
      const token = await verifyEmailCode(email, code);
      setVerifiedToken(token);
      setStep('reset');
      setInfo('');
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, '인증 코드가 올바르지 않습니다.'));
    } finally {
      setLoading(false);
    }
  };

  const handleNewPasswordBlur = async () => {
    if (!newPassword || !verifiedToken || !isPasswordValid(newPassword)) { setIsSameAsCurrent(null); return; }
    setIsSameChecking(true);
    try {
      const same = await checkPasswordSame(email, verifiedToken, newPassword);
      setIsSameAsCurrent(same);
    } catch {
      setIsSameAsCurrent(null);
    } finally {
      setIsSameChecking(false);
    }
  };

  /* ── 3단계: 비밀번호 재설정 ── */
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!isPasswordValid(newPassword)) { setError('비밀번호 조건을 모두 충족해 주세요.'); return; }
    if (isSameAsCurrent) { setError('이전에 사용했던 비밀번호는 사용할 수 없습니다.'); return; }
    if (newPassword !== newPasswordConfirm) { setError('비밀번호가 일치하지 않습니다.'); return; }
    setLoading(true);
    try {
      await resetPassword(email, verifiedToken, newPassword);
      navigate('/login', { state: { message: '비밀번호가 재설정되었습니다. 다시 로그인해 주세요.' } });
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, '비밀번호 재설정에 실패했습니다.'));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || loading) return;
    setError('');
    setCode('');
    setLoading(true);
    try {
      await sendVerificationCode(email);
      setInfo('인증 코드를 재발송했습니다. (5분 유효)');
      setResendCooldown(60);
    } catch {
      setError('재발송에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: 'var(--color-bg)' }}>
      <div className="relative w-full max-w-sm rounded-2xl p-8" style={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)' }}>

        {/* X 버튼 */}
        <button
          onClick={() => navigate('/login')}
          className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
          style={{ color: 'var(--color-muted)' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-text)'; e.currentTarget.style.backgroundColor = 'var(--color-surface)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-muted)'; e.currentTarget.style.backgroundColor = 'transparent'; }}
          aria-label="닫기"
        >
          ✕
        </button>

        <BrandLogo size="compact" className="mb-6" />

        {/* 단계 표시 */}
        <div className="flex items-center gap-2 mb-5">
          {(['email', 'verify', 'reset'] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                style={{
                  backgroundColor: step === s ? '#4ade80' : ((['email', 'verify', 'reset'] as Step[]).indexOf(step) > i ? '#2a5c38' : 'var(--color-surface)'),
                  color: step === s ? '#000' : 'var(--color-muted)',
                }}
              >
                {i + 1}
              </div>
              {i < 2 && <div className="w-8 h-px" style={{ backgroundColor: 'var(--color-border)' }} />}
            </div>
          ))}
          <span className="ml-2 text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
            {step === 'email' && '이메일 입력'}
            {step === 'verify' && '코드 인증'}
            {step === 'reset' && '비밀번호 재설정'}
          </span>
        </div>

        {/* 1단계: 이메일 */}
        {step === 'email' && (
          <form onSubmit={handleSendCode} className="flex flex-col gap-4">
            <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
              가입한 이메일 주소를 입력하면 인증 코드를 발송해 드립니다.
            </p>
            <div>
              <label className="text-sm block mb-1" style={{ color: 'var(--color-muted)' }}>이메일</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                placeholder="example@email.com"
                className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                style={inputStyle}
              />
            </div>
            {error && <p className="text-xs" style={{ color: '#ff9090' }}>{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
              style={{ backgroundColor: '#4ade80', color: '#fff' }}
            >
              {loading ? '발송 중...' : '인증 코드 발송'}
            </button>
          </form>
        )}

        {/* 2단계: 코드 인증 */}
        {step === 'verify' && (
          <form onSubmit={handleVerifyCode} className="flex flex-col gap-4">
            {info && <p className="text-xs" style={{ color: '#a3e6a3' }}>{info}</p>}
            <div>
              <label className="text-sm block mb-1" style={{ color: 'var(--color-muted)' }}>인증 코드 (6자리)</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                required
                maxLength={6}
                placeholder="123456"
                className="w-full rounded-xl px-3 py-2 text-sm outline-none tracking-[0.3em] text-center font-mono text-base"
                style={inputStyle}
                autoFocus
              />
            </div>
            {error && <p className="text-xs" style={{ color: '#ff9090' }}>{error}</p>}
            <button
              type="submit"
              disabled={loading || code.length !== 6}
              className="w-full py-2.5 rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
              style={{ backgroundColor: '#4ade80', color: '#fff' }}
            >
              {loading ? '확인 중...' : '코드 확인'}
            </button>
            <div className="flex items-center justify-between text-xs" style={{ color: 'var(--color-muted)' }}>
              <button type="button" onClick={() => { setStep('email'); setError(''); setCode(''); }}>
                ← 이전으로
              </button>
              <button
                type="button"
                onClick={handleResend}
                disabled={loading || resendCooldown > 0}
                className="hover:opacity-70 disabled:opacity-50 transition-opacity"
              >
                {resendCooldown > 0 ? `재발송 (${resendCooldown}s)` : '코드 재발송'}
              </button>
            </div>
          </form>
        )}

        {/* 3단계: 새 비밀번호 */}
        {step === 'reset' && (
          <form onSubmit={handleResetPassword} className="flex flex-col gap-4">
            <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
              새로운 비밀번호를 입력해 주세요.
            </p>
            <div>
              <label className="text-sm block mb-1" style={{ color: 'var(--color-muted)' }}>새 비밀번호</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => { setNewPassword(e.target.value); setIsSameAsCurrent(null); }}
                  onBlur={handleNewPasswordBlur}
                  required
                  autoFocus
                  placeholder="8자 이상, 영문·숫자·특수문자 포함"
                  className="w-full rounded-xl px-3 py-2 pr-10 text-sm outline-none"
                  style={{
                    ...inputStyle,
                    border: isSameAsCurrent === true ? '1px solid #ff9090' : '1px solid var(--color-input-border)',
                  }}
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
              {newPassword && (
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                  {PW_RULES.map((rule) => (
                    <span
                      key={rule.label}
                      className="text-[11px] flex items-center gap-1"
                      style={{ color: rule.test(newPassword) ? '#4ade80' : 'var(--color-muted)' }}
                    >
                      {rule.test(newPassword) ? '✓' : '○'} {rule.label}
                    </span>
                  ))}
                </div>
              )}
              {isSameChecking && (
                <p className="text-[11px] mt-1" style={{ color: 'var(--color-muted)' }}>확인 중...</p>
              )}
              {!isSameChecking && isSameAsCurrent === true && (
                <p className="text-[11px] mt-1" style={{ color: '#ff9090' }}>이전에 사용했던 비밀번호는 사용할 수 없습니다.</p>
              )}
            </div>
            <div>
              <label className="text-sm block mb-1" style={{ color: 'var(--color-muted)' }}>새 비밀번호 확인</label>
              <div className="relative">
                <input
                  type={showPwConfirm ? 'text' : 'password'}
                  value={newPasswordConfirm}
                  onChange={(e) => setNewPasswordConfirm(e.target.value)}
                  required
                  placeholder="비밀번호 재입력"
                  className="w-full rounded-xl px-3 py-2 pr-10 text-sm outline-none"
                  style={{
                    ...inputStyle,
                    border: newPasswordConfirm && newPassword !== newPasswordConfirm
                      ? '1px solid #ff9090'
                      : '1px solid var(--color-input-border)',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPwConfirm((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs"
                  style={{ color: 'var(--color-muted)' }}
                >
                  {showPwConfirm ? '숨김' : '보기'}
                </button>
              </div>
              {newPasswordConfirm && newPassword !== newPasswordConfirm && (
                <p className="text-[11px] mt-1" style={{ color: '#ff9090' }}>비밀번호가 일치하지 않습니다.</p>
              )}
            </div>
            {error && <p className="text-xs" style={{ color: '#ff9090' }}>{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
              style={{ backgroundColor: '#4ade80', color: '#fff' }}
            >
              {loading ? '재설정 중...' : '비밀번호 재설정'}
            </button>
          </form>
        )}

        <p className="text-sm text-center mt-6" style={{ color: 'var(--color-muted)' }}>
          <Link to="/login" className="hover:underline" style={{ color: '#4ade80' }}>
            로그인으로 돌아가기
          </Link>
        </p>
      </div>
    </div>
  );
}
