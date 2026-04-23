import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { updateProfile, uploadResume } from '../api/index';
import { DESIRED_JOBS, DESIRED_INDUSTRIES } from '../utils/profileOptions';
import ProfileFormFields, { parseCareerLevel, type ProfileValues } from '../components/ProfileFormFields';

export default function ProfileDetailPage() {
  const navigate = useNavigate();
  const { name, careerLevel, desiredJob, techStack, desiredIndustry, resumeText, setAuth, hasPassword, provider } = useAuthStore();

  const isCustomJob = desiredJob ? !DESIRED_JOBS.includes(desiredJob) : false;
  const isCustomIndustry = desiredIndustry ? !DESIRED_INDUSTRIES.includes(desiredIndustry) : false;
  const initialCareer = parseCareerLevel(careerLevel);

  const [profile, setProfile] = useState<ProfileValues>({
    ...initialCareer,
    desiredJob: desiredJob ?? '',
    jobDropdown: isCustomJob ? '직접 입력' : (desiredJob ?? ''),
    techStack: techStack ?? '',
    desiredIndustry: desiredIndustry ?? '',
    industryDropdown: isCustomIndustry ? '직접 입력' : (desiredIndustry ?? ''),
    resumeText: resumeText ?? '',
  });

  const [uploadingResume, setUploadingResume] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const resumeFileRef = useRef<HTMLInputElement>(null);

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const handleProfileChange = (updates: Partial<ProfileValues>) => {
    setProfile((prev) => ({ ...prev, ...updates }));
  };

  const handleResumeFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError('');
    setUploadingResume(true);
    try {
      const res = await uploadResume(file);
      setProfile((prev) => ({ ...prev, resumeText: res.resumeText }));
    } catch {
      setUploadError('파일 파싱에 실패했습니다. PDF, DOCX, TXT 형식을 확인해 주세요.');
    } finally {
      setUploadingResume(false);
      if (resumeFileRef.current) resumeFileRef.current.value = '';
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (profile.careerTrack === '경력 n년차' && !profile.careerYears) {
      setSuccess('');
      setError('경력 n년차를 선택했다면 정확한 년차를 골라 주세요.');
      return;
    }
    setSaving(true);
    setSuccess('');
    setError('');
    try {
      const res = await updateProfile({
        name: name ?? '',
        careerLevel: profile.careerLevel || null,
        desiredJob: profile.desiredJob || null,
        techStack: profile.techStack || null,
        desiredIndustry: profile.desiredIndustry || null,
        resumeText: profile.resumeText || null,
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

        <div className={card}>
          <button
            onClick={() => navigate('/settings')}
            className="inline-block px-4 py-1.5 mb-4 rounded-lg border border-[var(--color-border)] text-sm font-semibold transition-colors"
            style={{ color: 'var(--color-muted)', background: 'transparent' }}
          >
            ← 설정으로 돌아가기
          </button>
          <h1 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>프로필 상세 정보</h1>
          <p className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>
            저장하면 AI가 나에게 맞는 답변을 제공합니다.
          </p>
        </div>

        <div className={card}>
          <form onSubmit={handleSave} className="flex flex-col gap-4">
            <ProfileFormFields
              values={profile}
              onChange={handleProfileChange}
              inputCls={inputCls}
              labelCls={labelCls}
              inputStyle={inputStyle}
              labelStyle={labelStyle}
              layout="grid"
              showArrow
              resumeRows={6}
              showFileUpload
              uploadingResume={uploadingResume}
              uploadError={uploadError}
              onFileUploadClick={() => resumeFileRef.current?.click()}
              fileInputRef={resumeFileRef}
              onFileChange={handleResumeFileChange}
            />

            {error && <p className="text-[#ff9090] text-xs">{error}</p>}
            {success && <p className="text-[#10a37f] text-xs">{success}</p>}

            <button
              type="submit"
              disabled={saving || (profile.careerTrack === '경력 n년차' && !profile.careerYears)}
              className="self-start px-5 py-2 rounded-xl text-sm font-medium bg-accent text-white hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              {saving ? '저장 중...' : '저장'}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
