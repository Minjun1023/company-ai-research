import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { register, sendVerificationCode, verifyEmailCode, checkEmailAvailable } from '../api/index';
import { useAuthStore } from '../store/authStore';
import { PW_RULES, isPasswordValid, getApiErrorMessage } from '../utils/authUtils';
import { DESIRED_JOBS, DESIRED_INDUSTRIES, TECH_STACK_PLACEHOLDERS } from '../utils/profileOptions';
import BrandLogo from '../components/BrandLogo';

const CAREER_LEVELS = ['신입', '1~3년차', '3~5년차', '5~10년차', '10년차 이상'];

type Step = 'form' | 'verify' | 'profile';

export default function RegisterPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  // 기본 정보
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showPwConfirm, setShowPwConfirm] = useState(false);

  // 이메일 인증
  const [step, setStep] = useState<Step>('form');
  const [code, setCode] = useState('');
  const [verifiedToken, setVerifiedToken] = useState('');

  // 프로필
  const [careerLevel, setCareerLevel] = useState('');
  const [desiredJob, setDesiredJob] = useState('');
  const [jobDropdown, setJobDropdown] = useState('');
  const [techStack, setTechStack] = useState('');
  const [desiredIndustry, setDesiredIndustry] = useState('');
  const [industryDropdown, setIndustryDropdown] = useState('');
  const [resumeText, setResumeText] = useState('');

  const [emailError, setEmailError] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((v) => v - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  /* ── 1단계: 인증 메일 발송 ── */
  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim() || name.trim().length < 2) { setError('이름은 2자 이상 입력해 주세요.'); return; }
    if (!isPasswordValid(password)) { setError('비밀번호 조건을 모두 충족해 주세요.'); return; }
    if (password !== passwordConfirm) { setError('비밀번호가 일치하지 않습니다.'); return; }
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

  /* ── 2단계: 코드 확인 → 프로필 단계로 ── */
  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (code.length !== 6) { setError('6자리 인증 코드를 입력해 주세요.'); return; }
    setLoading(true);
    try {
      const token = await verifyEmailCode(email, code);
      setVerifiedToken(token);
      setStep('profile');
      setError('');
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, '인증 코드가 올바르지 않습니다.'));
    } finally {
      setLoading(false);
    }
  };

  /* ── 3단계: 가입 완료 ── */
  const handleRegister = async (skipProfile = false) => {
    setLoading(true);
    setError('');
    try {
      const profile = skipProfile ? {} : {
        careerLevel: careerLevel || undefined,
        desiredJob: desiredJob || undefined,
        techStack: techStack || undefined,
        desiredIndustry: desiredIndustry || undefined,
        resumeText: resumeText || undefined,
      };
      const res = await register(email, name.trim(), password, verifiedToken, profile);
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
      setError(getApiErrorMessage(err, '회원가입에 실패했습니다.'));
    } finally {
      setLoading(false);
    }
  };

  /* ── 재발송 ── */
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

  const inputStyle = { backgroundColor: 'var(--color-input)', border: '1px solid var(--color-input-border)', color: 'var(--color-text)' };
  const isNameValid = name.length >= 2 && /^[가-힣ㄱ-ㅎㅏ-ㅣa-zA-Z0-9]+$/.test(name);
  const canProceedStep1 = isNameValid && email.trim().length > 0 && !emailError && isPasswordValid(password) && password === passwordConfirm;

  const handleEmailBlur = async () => {
    if (!email.trim()) { setEmailError(''); return; }
    try {
      const available = await checkEmailAvailable(email.trim());
      setEmailError(available ? '' : '이미 사용 중인 이메일입니다.');
    } catch {
      setEmailError('');
    }
  };
  const req = <span style={{ color: '#ff6b6b', marginLeft: '2px' }}>*</span>;

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: 'var(--color-bg)' }}>
      <div className="relative w-full max-w-sm rounded-2xl p-8" style={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)' }}>

        <button
          onClick={() => navigate('/')}
          className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
          style={{ color: 'var(--color-muted)' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-text)'; e.currentTarget.style.backgroundColor = 'var(--color-surface)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-muted)'; e.currentTarget.style.backgroundColor = 'transparent'; }}
          aria-label="닫기"
        >
          ✕
        </button>

        <BrandLogo size="compact" className="mb-6" />

        {/* ── 단계 인디케이터 ── */}
        <div className="flex items-center gap-1.5 mb-6">
          {(['form', 'verify', 'profile'] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-1.5">
              <div
                className="w-2 h-2 rounded-full transition-colors"
                style={{ backgroundColor: step === s ? '#4ade80' : s === 'form' || (s === 'verify' && (step === 'verify' || step === 'profile')) || (s === 'profile' && step === 'profile') ? '#4ade80' : 'var(--color-border)', opacity: step === s ? 1 : 0.4 }}
              />
              {i < 2 && <div className="w-6 h-px" style={{ backgroundColor: 'var(--color-border)' }} />}
            </div>
          ))}
          <span className="ml-2 text-xs" style={{ color: 'var(--color-muted)' }}>
            {step === 'form' ? '1/3 기본 정보' : step === 'verify' ? '2/3 이메일 인증' : '3/3 프로필 설정'}
          </span>
        </div>

        {/* ── 1단계: 기본 정보 ── */}
        {step === 'form' && (
          <>
            <h1 className="text-xl font-semibold mb-5" style={{ color: 'var(--color-text)' }}>회원가입</h1>
            <form onSubmit={handleSendCode} className="flex flex-col gap-4">
              <div>
                <label className="text-sm block mb-1" style={{ color: 'var(--color-muted)' }}>닉네임{req}</label>
                <input type="text" value={name}
                  onChange={(e) => setName(e.target.value.replace(/[^가-힣ㄱ-ㅎㅏ-ㅣa-zA-Z0-9]/g, ''))}
                  required minLength={2} maxLength={20} placeholder="홍길동"
                  className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={inputStyle} />
                {name.length > 0 && name.length < 2 && (
                  <p className="text-[11px] mt-1" style={{ color: '#ff9090' }}>닉네임은 2자 이상 입력해 주세요.</p>
                )}
                <p className="text-[11px] mt-1" style={{ color: 'var(--color-muted)' }}>한글, 영문, 숫자만 사용 가능 (특수문자·공백 불가)</p>
              </div>
              <div>
                <label className="text-sm block mb-1" style={{ color: 'var(--color-muted)' }}>이메일{req}</label>
                <input type="email" value={email}
                  onChange={(e) => { setEmail(e.target.value); setEmailError(''); }}
                  onBlur={handleEmailBlur}
                  required placeholder="example@email.com"
                  className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                  style={{ ...inputStyle, border: emailError ? '1px solid #ff9090' : '1px solid var(--color-input-border)' }} />
                {emailError && <p className="text-[11px] mt-1" style={{ color: '#ff9090' }}>{emailError}</p>}
              </div>
              <div>
                <label className="text-sm block mb-1" style={{ color: 'var(--color-muted)' }}>비밀번호{req}</label>
                <div className="relative">
                  <input type={showPw ? 'text' : 'password'} value={password}
                    onChange={(e) => setPassword(e.target.value)} required
                    placeholder="8자 이상, 영문·숫자·특수문자 포함"
                    className="w-full rounded-xl px-3 py-2 pr-10 text-sm outline-none" style={inputStyle} />
                  <button type="button" onClick={() => setShowPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: 'var(--color-muted)' }}>
                    {showPw ? '숨김' : '보기'}
                  </button>
                </div>
                {password && (
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                    {PW_RULES.map((rule) => (
                      <span key={rule.label} className="text-[11px] flex items-center gap-1"
                        style={{ color: rule.test(password) ? '#4ade80' : 'var(--color-muted)' }}>
                        {rule.test(password) ? '✓' : '○'} {rule.label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="text-sm block mb-1" style={{ color: 'var(--color-muted)' }}>비밀번호 확인{req}</label>
                <div className="relative">
                  <input type={showPwConfirm ? 'text' : 'password'} value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)} required placeholder="비밀번호 재입력"
                    className="w-full rounded-xl px-3 py-2 pr-10 text-sm outline-none"
                    style={{ ...inputStyle, border: passwordConfirm && password !== passwordConfirm ? '1px solid #ff9090' : '1px solid var(--color-input-border)' }} />
                  <button type="button" onClick={() => setShowPwConfirm((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: 'var(--color-muted)' }}>
                    {showPwConfirm ? '숨김' : '보기'}
                  </button>
                </div>
                {passwordConfirm && password !== passwordConfirm && (
                  <p className="text-[11px] mt-1" style={{ color: '#ff9090' }}>비밀번호가 일치하지 않습니다.</p>
                )}
              </div>
              {error && <p className="text-xs" style={{ color: '#ff9090' }}>{error}</p>}
              <button type="submit" disabled={loading || !canProceedStep1}
                className="w-full py-2.5 rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
                style={{ backgroundColor: '#4ade80', color: '#fff' }}>
                {loading ? '발송 중...' : '인증 메일 발송'}
              </button>
            </form>
          </>
        )}

        {/* ── 2단계: 이메일 인증 ── */}
        {step === 'verify' && (
          <>
            <h1 className="text-xl font-semibold mb-2" style={{ color: 'var(--color-text)' }}>이메일 인증</h1>
            {verifiedToken && (
              <div className="mb-3 px-3 py-2 rounded-xl text-xs flex items-center justify-between" style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', color: '#4ade80' }}>
                <span>이미 인증이 완료되었습니다.</span>
                <button type="button" onClick={() => { setError(''); setStep('profile'); }} className="font-semibold hover:opacity-80">
                  다음으로 →
                </button>
              </div>
            )}
            {info && <p className="text-xs mb-4" style={{ color: '#a3e6a3' }}>{info}</p>}
            <form onSubmit={handleVerifyCode} className="flex flex-col gap-4">
              <div>
                <label className="text-sm block mb-1" style={{ color: 'var(--color-muted)' }}>인증 코드 (6자리)</label>
                <input type="text" value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  required maxLength={6} placeholder="123456"
                  className="w-full rounded-xl px-3 py-2 text-sm outline-none tracking-[0.3em] text-center font-mono text-base"
                  style={inputStyle} autoFocus />
              </div>
              {error && <p className="text-xs" style={{ color: '#ff9090' }}>{error}</p>}
              <button type="submit" disabled={loading || code.length !== 6}
                className="w-full py-2.5 rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
                style={{ backgroundColor: '#4ade80', color: '#fff' }}>
                {loading ? '확인 중...' : '인증 확인'}
              </button>
              <div className="flex items-center justify-end text-xs" style={{ color: 'var(--color-muted)' }}>
                <button type="button" onClick={handleResend}
                  disabled={loading || resendCooldown > 0}
                  className="hover:opacity-70 transition-opacity disabled:opacity-50">
                  {resendCooldown > 0 ? `재발송 (${resendCooldown}s)` : '코드 재발송'}
                </button>
              </div>
            </form>
          </>
        )}

        {/* ── 3단계: 프로필 설정 ── */}
        {step === 'profile' && (
          <>
            <h1 className="text-xl font-semibold mb-1" style={{ color: 'var(--color-text)' }}>프로필 설정</h1>
            <p className="text-xs mb-5" style={{ color: 'var(--color-muted)' }}>
              입력하면 AI가 나에게 맞는 답변을 제공합니다. 나중에 설정에서 수정할 수 있습니다.
            </p>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-sm block mb-1" style={{ color: 'var(--color-muted)' }}>경력 단계</label>
                <select value={careerLevel} onChange={(e) => setCareerLevel(e.target.value)}
                  className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={inputStyle}>
                  <option value="">선택 안함</option>
                  {CAREER_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm block mb-1" style={{ color: 'var(--color-muted)' }}>희망 직군</label>
                <select
                  value={jobDropdown}
                  onChange={(e) => {
                    setJobDropdown(e.target.value);
                    if (e.target.value !== '직접 입력') setDesiredJob(e.target.value);
                    else setDesiredJob('');
                  }}
                  className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={inputStyle}
                >
                  <option value="">선택 안함</option>
                  {DESIRED_JOBS.map((j) => <option key={j} value={j}>{j}</option>)}
                </select>
                {jobDropdown === '직접 입력' && (
                  <input
                    type="text"
                    value={desiredJob}
                    onChange={(e) => setDesiredJob(e.target.value)}
                    placeholder="직접 입력해 주세요"
                    className="w-full rounded-xl px-3 py-2 text-sm outline-none mt-2"
                    style={inputStyle}
                    autoFocus
                  />
                )}
              </div>
              <div>
                <label className="text-sm block mb-1" style={{ color: 'var(--color-muted)' }}>보유 역량 / 툴</label>
                <input type="text" value={techStack} onChange={(e) => setTechStack(e.target.value)}
                  placeholder={TECH_STACK_PLACEHOLDERS[jobDropdown] ?? '예) Java, React / Figma, Jira / 퍼포먼스 마케팅'}
                  className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={inputStyle} />
              </div>
              <div>
                <label className="text-sm block mb-1" style={{ color: 'var(--color-muted)' }}>희망 업종</label>
                <select
                  value={industryDropdown}
                  onChange={(e) => {
                    setIndustryDropdown(e.target.value);
                    if (e.target.value !== '직접 입력') setDesiredIndustry(e.target.value);
                    else setDesiredIndustry('');
                  }}
                  className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={inputStyle}
                >
                  <option value="">선택 안함</option>
                  {DESIRED_INDUSTRIES.map((ind) => <option key={ind} value={ind}>{ind}</option>)}
                </select>
                {industryDropdown === '직접 입력' && (
                  <input
                    type="text"
                    value={desiredIndustry}
                    onChange={(e) => setDesiredIndustry(e.target.value)}
                    placeholder="직접 입력해 주세요"
                    className="w-full rounded-xl px-3 py-2 text-sm outline-none mt-2"
                    style={inputStyle}
                  />
                )}
              </div>
              <div>
                <label className="text-sm block mb-1" style={{ color: 'var(--color-muted)' }}>
                  자기소개서 / 이력서
                  <span className="ml-1 text-xs opacity-60">(선택, 가입 후 설정에서 파일로도 업로드 가능)</span>
                </label>
                <textarea
                  value={resumeText}
                  onChange={(e) => setResumeText(e.target.value)}
                  placeholder="자기소개서나 이력서 내용을 붙여넣어 주세요..."
                  rows={4}
                  className="w-full rounded-xl px-3 py-2 text-sm outline-none resize-none leading-relaxed"
                  style={inputStyle}
                />
              </div>
            </div>
            {error && <p className="text-xs mt-3" style={{ color: '#ff9090' }}>{error}</p>}
            <div className="flex flex-col gap-2 mt-5">
              <button onClick={() => handleRegister(false)} disabled={loading}
                className="w-full py-2.5 rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
                style={{ backgroundColor: '#4ade80', color: '#fff' }}>
                {loading ? '가입 중...' : '완료'}
              </button>
            </div>
          </>
        )}

        <p className="text-sm text-center mt-6" style={{ color: 'var(--color-muted)' }}>
          이미 계정이 있으신가요?{' '}
          <Link to="/login" className="hover:underline" style={{ color: '#4ade80' }}>로그인</Link>
        </p>
      </div>
    </div>
  );
}
