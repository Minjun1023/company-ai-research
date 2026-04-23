import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { updateProfile, changePassword, verifyCurrentPassword, logout } from '../api/index';
import { PW_RULES, isPasswordValid } from '../utils/authUtils';

export default function SettingsPage() {
  const navigate = useNavigate();
  const { name, email, careerLevel, desiredJob, setAuth, hasPassword, provider } = useAuthStore();

  const [newName, setNewName] = useState(name ?? '');
  const [nameError, setNameError] = useState('');

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const [pwOpen, setPwOpen] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [currentPwValid, setCurrentPwValid] = useState<boolean | null>(null);
  const [currentPwChecking, setCurrentPwChecking] = useState(false);
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [newPw, setNewPw] = useState('');
  const [showNewPw, setShowNewPw] = useState(false);
  const [confirmPw, setConfirmPw] = useState('');
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwSuccess, setPwSuccess] = useState('');
  const [pwError, setPwError] = useState('');

  const isNameValid = newName.length >= 2 && /^[가-힣ㄱ-ㅎㅏ-ㅣa-zA-Z0-9]+$/.test(newName);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^가-힣ㄱ-ㅎㅏ-ㅣa-zA-Z0-9]/g, '');
    setNewName(val);
    if (val.length > 0 && val.length < 2) setNameError('닉네임은 2자 이상 입력해 주세요.');
    else setNameError('');
  };

  const handleCurrentPwBlur = async () => {
    if (!currentPw) { setCurrentPwValid(null); return; }
    setCurrentPwChecking(true);
    try {
      const valid = await verifyCurrentPassword(currentPw);
      setCurrentPwValid(valid);
    } catch {
      setCurrentPwValid(null);
    } finally {
      setCurrentPwChecking(false);
    }
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isNameValid) return;
    setSaving(true);
    setSuccess('');
    setError('');
    try {
      const { techStack, desiredIndustry, resumeText } = useAuthStore.getState();
      const res = await updateProfile({
        name: newName.trim(),
        careerLevel: careerLevel || null,
        desiredJob: desiredJob || null,
        techStack: techStack || null,
        desiredIndustry: desiredIndustry || null,
        resumeText: resumeText || null,
      });
      setAuth(res.email, res.name, {
        careerLevel: res.careerLevel,
        desiredJob: res.desiredJob,
        techStack: res.techStack,
        desiredIndustry: res.desiredIndustry,
        resumeText: res.resumeText,
        hasPassword: res.hasPassword ?? hasPassword,
        provider,
      });
      setSuccess('저장되었습니다.');
    } catch {
      setError('저장에 실패했습니다. 다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  };

  const card = 'bg-[var(--color-card)] border border-[var(--color-border)] rounded-[14px] p-5';
  const inputCls = 'w-full px-3 py-2 rounded-xl text-sm border outline-none transition-colors';
  const inputStyle = {
    background: 'var(--color-input)',
    borderColor: 'var(--color-input-border)',
    color: 'var(--color-text)',
  };
  const labelCls = 'text-xs mb-1 block';
  const labelStyle = { color: 'var(--color-muted)' };

  return (
    <div className="flex-1 overflow-y-auto py-7 px-7" style={{ backgroundColor: 'var(--color-bg)' }}>
      <div className="max-w-[560px] mx-auto flex flex-col gap-4">

        {/* Header */}
        <div className={card}>
          <button
            onClick={() => navigate('/chat')}
            className="inline-block px-4 py-1.5 mb-4 rounded-lg border border-[var(--color-border)] text-sm font-semibold transition-colors"
            style={{ color: 'var(--color-muted)', background: 'transparent' }}
          >
            돌아가기
          </button>
          <h1 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>설정</h1>
        </div>

        {/* 계정 */}
        <div className={card}>
          <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text)' }}>계정</h2>
          <form onSubmit={handleSave} className="flex flex-col gap-4">
            <div>
              <label className={labelCls} style={labelStyle}>이메일</label>
              <div className={inputCls} style={{ ...inputStyle, color: 'var(--color-muted)' }}>
                {email ?? '-'}
              </div>
            </div>

            <div>
              <label className={labelCls} style={labelStyle}>닉네임</label>
              <input
                type="text"
                value={newName}
                onChange={handleNameChange}
                maxLength={20}
                required
                className={inputCls}
                style={{ ...inputStyle, borderColor: nameError ? '#ff9090' : inputStyle.borderColor }}
              />
              {nameError && <p className="text-[11px] mt-1" style={{ color: '#ff9090' }}>{nameError}</p>}
              <p className="text-[11px] mt-1" style={{ color: 'var(--color-muted)' }}>
                한글, 영문, 숫자만 사용 가능 (특수문자·공백 불가)
              </p>
            </div>

            {error && <p className="text-[#ff9090] text-xs">{error}</p>}
            {success && <p className="text-[#10a37f] text-xs">{success}</p>}

            <button
              type="submit"
              disabled={saving || !isNameValid}
              className="self-start px-5 py-2 rounded-xl text-sm font-medium bg-accent text-white hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              {saving ? '저장 중...' : '저장'}
            </button>
          </form>
        </div>

        {/* 프로필 상세 링크 */}
        <button
          onClick={() => navigate('/settings/profile')}
          className={`${card} w-full text-left flex items-center justify-between transition-colors`}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-hover)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ''; }}
        >
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>프로필 상세 정보</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>
              경력 · 희망 직군 · 역량 · 업종 · 자기소개서
            </p>
          </div>
          <span style={{ color: 'var(--color-muted)' }}>→</span>
        </button>

        {/* 보안 */}
        <div className={card}>
          <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text)' }}>보안</h2>
          {!pwOpen ? (
            <button
              onClick={() => { setPwOpen(true); setPwSuccess(''); setPwError(''); }}
              className="text-sm px-4 py-2 rounded-xl border transition-colors"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}
            >
              비밀번호 변경
            </button>
          ) : (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!isPasswordValid(newPw)) { setPwError('새 비밀번호 조건을 모두 충족해 주세요.'); return; }
                if (newPw !== confirmPw) { setPwError('새 비밀번호가 일치하지 않습니다.'); return; }
                setPwSaving(true); setPwError(''); setPwSuccess('');
                try {
                  await changePassword(currentPw, newPw);
                  setPwSuccess('비밀번호가 변경되었습니다. 다시 로그인해 주세요.');
                  setTimeout(async () => {
                    try { await logout(); } catch { /* ignore */ }
                    navigate('/login');
                  }, 1500);
                } catch (err: unknown) {
                  const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
                  setPwError(msg || '비밀번호 변경에 실패했습니다.');
                } finally {
                  setPwSaving(false);
                }
              }}
              className="flex flex-col gap-3"
            >
              <div>
                <label className={labelCls} style={labelStyle}>현재 비밀번호</label>
                <div className="relative">
                  <input
                    type={showCurrentPw ? 'text' : 'password'}
                    value={currentPw}
                    onChange={(e) => { setCurrentPw(e.target.value); setCurrentPwValid(null); }}
                    onBlur={handleCurrentPwBlur}
                    required autoFocus
                    className={inputCls}
                    style={{ ...inputStyle, borderColor: currentPwValid === true ? '#4ade80' : currentPwValid === false ? '#ff9090' : inputStyle.borderColor, paddingRight: '4rem' }}
                  />
                  <button type="button" onClick={() => setShowCurrentPw((v) => !v)}
                    className="absolute right-8 top-1/2 -translate-y-1/2 text-xs" style={{ color: 'var(--color-muted)' }}>
                    {showCurrentPw ? '숨김' : '보기'}
                  </button>
                  {currentPwChecking && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px]" style={{ color: 'var(--color-muted)' }}>…</span>}
                  {!currentPwChecking && currentPwValid === true && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[13px]" style={{ color: '#4ade80' }}>✓</span>}
                  {!currentPwChecking && currentPwValid === false && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[13px]" style={{ color: '#ff9090' }}>✕</span>}
                </div>
                {currentPwValid === false && <p className="text-[11px] mt-1" style={{ color: '#ff9090' }}>비밀번호가 올바르지 않습니다.</p>}
              </div>
              <div>
                <label className={labelCls} style={labelStyle}>새 비밀번호</label>
                <div className="relative">
                  <input type={showNewPw ? 'text' : 'password'} value={newPw}
                    onChange={(e) => setNewPw(e.target.value)} required
                    placeholder="8자 이상, 영문·숫자·특수문자 포함"
                    className={inputCls} style={{ ...inputStyle, paddingRight: '3rem' }} />
                  <button type="button" onClick={() => setShowNewPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: 'var(--color-muted)' }}>
                    {showNewPw ? '숨김' : '보기'}
                  </button>
                </div>
                {newPw && (
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                    {PW_RULES.map((rule) => (
                      <span key={rule.label} className="text-[11px] flex items-center gap-1 transition-colors"
                        style={{ color: rule.test(newPw) ? '#4ade80' : 'var(--color-muted)' }}>
                        {rule.test(newPw) ? '✓' : '○'} {rule.label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className={labelCls} style={labelStyle}>새 비밀번호 확인</label>
                <div className="relative">
                  <input type={showConfirmPw ? 'text' : 'password'} value={confirmPw}
                    onChange={(e) => setConfirmPw(e.target.value)} required
                    className={inputCls}
                    style={{ ...inputStyle, paddingRight: '3rem', borderColor: confirmPw && confirmPw !== newPw ? '#ff9090' : inputStyle.borderColor }} />
                  <button type="button" onClick={() => setShowConfirmPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: 'var(--color-muted)' }}>
                    {showConfirmPw ? '숨김' : '보기'}
                  </button>
                </div>
                {confirmPw && confirmPw !== newPw && <p className="text-[11px] mt-1" style={{ color: '#ff9090' }}>비밀번호가 일치하지 않습니다.</p>}
              </div>
              {pwError && <p className="text-[#ff9090] text-xs">{pwError}</p>}
              {pwSuccess && <p className="text-[#10a37f] text-xs">{pwSuccess}</p>}
              <div className="flex gap-2">
                <button type="submit" disabled={pwSaving}
                  className="px-4 py-2 rounded-xl text-sm font-medium bg-accent text-white hover:opacity-90 disabled:opacity-40 transition-opacity">
                  {pwSaving ? '변경 중...' : '변경'}
                </button>
                <button type="button"
                  onClick={() => { setPwOpen(false); setCurrentPw(''); setNewPw(''); setConfirmPw(''); setPwError(''); setCurrentPwValid(null); setShowCurrentPw(false); setShowNewPw(false); setShowConfirmPw(false); }}
                  className="px-4 py-2 rounded-xl text-sm border transition-colors"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}>
                  취소
                </button>
              </div>
            </form>
          )}
        </div>

        {/* 회원 탈퇴 */}
        <div className={card}>
          <h2 className="text-sm font-semibold mb-1" style={{ color: 'var(--color-text)' }}>회원 탈퇴</h2>
          <p className="text-xs mb-4" style={{ color: 'var(--color-muted)' }}>
            탈퇴 시 모든 데이터(대화 내역, 관심 기업)가 영구 삭제되며 복구할 수 없습니다.
          </p>
          <button
            onClick={() => navigate('/withdraw')}
            className="text-sm px-4 py-2 rounded-xl border transition-colors"
            style={{ borderColor: 'rgba(255,144,144,0.4)', color: '#ff9090' }}
          >
            회원 탈퇴
          </button>
        </div>

      </div>
    </div>
  );
}
