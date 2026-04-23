import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { updateProfile } from '../api/index';
import ProfileFormFields, { parseCareerLevel, type ProfileValues } from '../components/ProfileFormFields';
import BrandLogo from '../components/BrandLogo';

type Step = 'name' | 'profile';

export default function SocialSetupPage() {
  const navigate = useNavigate();
  const { name: storedName, setAuth, hasPassword, provider } = useAuthStore();
  const initialCareer = parseCareerLevel('');

  const [step, setStep] = useState<Step>('name');
  const [name, setName] = useState(storedName ?? '');

  const [profile, setProfile] = useState<ProfileValues>({
    ...initialCareer,
    desiredJob: '',
    jobDropdown: '',
    techStack: '',
    desiredIndustry: '',
    industryDropdown: '',
    resumeText: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleNameNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || name.trim().length < 2) { setError('닉네임은 2자 이상 입력해 주세요.'); return; }
    setError('');
    setStep('profile');
  };

  const handleComplete = async (skipProfile = false) => {
    if (!skipProfile && profile.careerTrack === '경력 n년차' && !profile.careerYears) {
      setError('경력 n년차를 선택했다면 정확한 년차를 골라 주세요.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await updateProfile({
        name: name.trim(),
        careerLevel: skipProfile ? null : (profile.careerLevel || null),
        desiredJob: skipProfile ? null : (profile.desiredJob || null),
        techStack: skipProfile ? null : (profile.techStack || null),
        desiredIndustry: skipProfile ? null : (profile.desiredIndustry || null),
        resumeText: skipProfile ? null : (profile.resumeText || null),
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
      navigate('/chat');
    } catch {
      setError('저장에 실패했습니다. 다시 시도해 주세요.');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = { backgroundColor: 'var(--color-input)', border: '1px solid var(--color-input-border)', color: 'var(--color-text)' };
  const req = <span style={{ color: '#ff6b6b', marginLeft: '2px' }}>*</span>;

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: 'var(--color-bg)' }}>
      <div className="relative w-full max-w-sm rounded-2xl p-8" style={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)' }}>

        <BrandLogo size="compact" className="mb-6" />

        {/* 단계 인디케이터 */}
        <div className="flex items-center gap-1.5 mb-6">
          {(['name', 'profile'] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-1.5">
              <div
                className="w-2 h-2 rounded-full transition-colors"
                style={{
                  backgroundColor: step === s || (s === 'name' && step === 'profile') ? '#4ade80' : 'var(--color-border)',
                  opacity: step === s ? 1 : 0.4,
                }}
              />
              {i < 1 && <div className="w-6 h-px" style={{ backgroundColor: 'var(--color-border)' }} />}
            </div>
          ))}
          <span className="ml-2 text-xs" style={{ color: 'var(--color-muted)' }}>
            {step === 'name' ? '1/2 닉네임 설정' : '2/2 프로필 설정'}
          </span>
        </div>

        {/* 1단계: 닉네임 */}
        {step === 'name' && (
          <>
            <h1 className="text-xl font-semibold mb-2" style={{ color: 'var(--color-text)' }}>닉네임 설정</h1>
            <p className="text-xs mb-5" style={{ color: 'var(--color-muted)' }}>
              소셜 계정에서 가져온 이름입니다. 원하시면 수정하세요.
            </p>
            <form onSubmit={handleNameNext} className="flex flex-col gap-4">
              <div>
                <label className="text-sm block mb-1" style={{ color: 'var(--color-muted)' }}>닉네임{req}</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value.replace(/[^가-힣ㄱ-ㅎㅏ-ㅣa-zA-Z0-9]/g, ''))}
                  required
                  minLength={2}
                  maxLength={20}
                  placeholder="홍길동"
                  className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                  style={inputStyle}
                  autoFocus
                />
                {name.length > 0 && name.length < 2 && (
                  <p className="text-[11px] mt-1" style={{ color: '#ff9090' }}>닉네임은 2자 이상 입력해 주세요.</p>
                )}
                <p className="text-[11px] mt-1" style={{ color: 'var(--color-muted)' }}>한글, 영문, 숫자만 사용 가능 (특수문자·공백 불가)</p>
              </div>
              {error && <p className="text-xs" style={{ color: '#ff9090' }}>{error}</p>}
              <button
                type="submit"
                disabled={name.length < 2 || !/^[가-힣ㄱ-ㅎㅏ-ㅣa-zA-Z0-9]+$/.test(name)}
                className="w-full py-2.5 rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
                style={{ backgroundColor: '#4ade80', color: '#fff' }}
              >
                다음
              </button>
            </form>
          </>
        )}

        {/* 2단계: 프로필 */}
        {step === 'profile' && (
          <>
            <h1 className="text-xl font-semibold mb-1" style={{ color: 'var(--color-text)' }}>프로필 설정</h1>
            <p className="text-xs mb-5" style={{ color: 'var(--color-muted)' }}>
              입력하면 AI가 나에게 맞는 답변을 제공합니다. 나중에 설정에서 수정할 수 있습니다.
            </p>

            <ProfileFormFields
              values={profile}
              onChange={(updates) => setProfile((prev) => ({ ...prev, ...updates }))}
              inputCls="w-full rounded-xl px-3 py-2 text-sm outline-none"
              labelCls="text-sm block mb-1"
              inputStyle={inputStyle}
              labelStyle={{ color: 'var(--color-muted)' }}
            />

            {error && <p className="text-xs mt-3" style={{ color: '#ff9090' }}>{error}</p>}
            <div className="flex flex-col gap-2 mt-5">
              <button
                onClick={() => handleComplete(false)}
                disabled={loading || (profile.careerTrack === '경력 n년차' && !profile.careerYears)}
                className="w-full py-2.5 rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
                style={{ backgroundColor: '#4ade80', color: '#fff' }}
              >
                {loading ? '저장 중...' : '완료'}
              </button>
              <button
                type="button"
                onClick={() => { setError(''); setStep('name'); }}
                disabled={loading}
                className="w-full py-2.5 rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
                style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-text)' }}
              >
                이전으로
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
