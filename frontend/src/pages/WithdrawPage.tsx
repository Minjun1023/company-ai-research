import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { deleteAccount, logout } from '../api/index';

export default function WithdrawPage() {
  const navigate = useNavigate();
  const { clearAuth, hasPassword, provider } = useAuthStore();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // 소셜 로그인 사용자는 비밀번호 불필요 (동일 이메일에 비밀번호가 존재하더라도)
  const isSocial = provider !== null && provider !== 'email';
  const needsPassword = !isSocial && hasPassword;
  const canSubmit = confirm === '회원탈퇴' && !withdrawing && (!needsPassword || password.length > 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setShowConfirmModal(true);
  };

  const handleConfirmWithdraw = async () => {
    setShowConfirmModal(false);
    setWithdrawing(true);
    setError('');
    try {
      await deleteAccount(password || undefined, provider);
      try { await logout(); } catch { /* ignore */ }
      clearAuth();
      navigate('/', { replace: true });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || '탈퇴 처리에 실패했습니다. 다시 시도해 주세요.');
      setWithdrawing(false);
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
    <>
    {showConfirmModal && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center px-4"
        style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
        onClick={() => setShowConfirmModal(false)}
      >
        <div
          className="w-full max-w-sm rounded-2xl p-6 flex flex-col gap-4"
          style={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)' }}
          onClick={(e) => e.stopPropagation()}
        >
          <h2 className="text-base font-bold" style={{ color: '#ff9090' }}>정말로 탈퇴하시겠습니까?</h2>
          <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
            탈퇴 후에는 모든 데이터가 즉시 삭제되며 복구할 수 없습니다.
          </p>
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleConfirmWithdraw}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors"
              style={{ borderColor: 'rgba(255,144,144,0.5)', color: '#ff9090', background: 'transparent' }}
            >
              탈퇴하기
            </button>
            <button
              onClick={() => setShowConfirmModal(false)}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)', background: 'transparent' }}
            >
              취소
            </button>
          </div>
        </div>
      </div>
    )}
    <div className="flex-1 overflow-y-auto py-7 px-7" style={{ backgroundColor: 'var(--color-bg)' }}>
      <div className="max-w-[480px] mx-auto flex flex-col gap-4">

        {/* Header */}
        <div className={card}>
          <button
            onClick={() => navigate('/settings')}
            className="inline-block px-4 py-1.5 mb-4 rounded-lg border text-sm font-semibold transition-colors"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)', background: 'transparent' }}
          >
            ← 설정으로 돌아가기
          </button>
          <h1 className="text-xl font-bold" style={{ color: '#ff9090' }}>회원 탈퇴</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-muted)' }}>
            탈퇴하면 아래 모든 데이터가 영구 삭제되며 복구할 수 없습니다.
          </p>
        </div>

        {/* 경고 */}
        <div
          className="rounded-[14px] p-5 flex flex-col gap-2 text-sm"
          style={{ background: 'rgba(255,144,144,0.06)', border: '1px solid rgba(255,144,144,0.25)' }}
        >
          {[
            '대화 내역 전체',
            '관심 기업 및 수집된 기업 데이터',
            '지원 현황 및 채용 공고 스크랩',
            '프로필 및 자기소개서/이력서',
          ].map((item) => (
            <div key={item} className="flex items-start gap-2">
              <span style={{ color: '#ff9090', flexShrink: 0 }}>✕</span>
              <span style={{ color: 'var(--color-text-sub)' }}>{item}</span>
            </div>
          ))}
        </div>

        {/* 탈퇴 폼 */}
        <div className={card}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {needsPassword && (
              <div>
                <label className={labelCls} style={labelStyle}>현재 비밀번호</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="현재 비밀번호"
                    className={inputCls}
                    style={{ ...inputStyle, paddingRight: '3.5rem' }}
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
            )}

            <div>
              <label className={labelCls} style={labelStyle}>
                확인 문구 입력
              </label>
              <input
                type="text"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder='"회원탈퇴"를 입력하세요'
                autoComplete="off"
                className={inputCls}
                style={{
                  ...inputStyle,
                  borderColor: confirm && confirm !== '회원탈퇴' ? '#ff9090' : inputStyle.borderColor,
                }}
              />
              {confirm && confirm !== '회원탈퇴' && (
                <p className="text-[11px] mt-1" style={{ color: '#ff9090' }}>
                  정확히 "회원탈퇴"를 입력해 주세요.
                </p>
              )}
            </div>

            {error && <p className="text-xs" style={{ color: '#ff9090' }}>{error}</p>}

            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={!canSubmit}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors disabled:opacity-40"
                style={{ borderColor: 'rgba(255,144,144,0.5)', color: '#ff9090', background: 'transparent' }}
              >
                {withdrawing ? '처리 중...' : '탈퇴하기'}
              </button>
              <button
                type="button"
                onClick={() => navigate('/settings')}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)', background: 'transparent' }}
              >
                취소
              </button>
            </div>
          </form>
        </div>

      </div>
    </div>
    </>
  );
}
