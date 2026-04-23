import { DESIRED_JOBS, DESIRED_INDUSTRIES, TECH_STACK_PLACEHOLDERS } from '../utils/profileOptions';

const CAREER_LEVELS = ['신입', '경력 n년차', '1~3년차', '3~5년차', '5~10년차', '10년차 이상'];
const CAREER_YEAR_OPTIONS = Array.from({ length: 20 }, (_, i) => `${i + 1}`);

export interface ProfileValues {
  careerLevel: string;
  careerTrack: string;
  careerYears: string;
  desiredJob: string;
  jobDropdown: string;
  techStack: string;
  desiredIndustry: string;
  industryDropdown: string;
  resumeText: string;
}

export function parseCareerLevel(careerLevel: string | null | undefined): Pick<ProfileValues, 'careerLevel' | 'careerTrack' | 'careerYears'> {
  const normalized = careerLevel ?? '';
  const yearMatch = normalized.match(/^(\d+)년차$/);

  if (yearMatch) {
    return {
      careerLevel: normalized,
      careerTrack: '경력 n년차',
      careerYears: yearMatch[1],
    };
  }

  return {
    careerLevel: normalized,
    careerTrack: normalized,
    careerYears: '',
  };
}

interface Props {
  values: ProfileValues;
  onChange: (updates: Partial<ProfileValues>) => void;
  inputCls: string;
  labelCls: string;
  inputStyle: React.CSSProperties;
  labelStyle: React.CSSProperties;
  layout?: 'stacked' | 'grid';
  showArrow?: boolean;
  resumeRows?: number;
  showFileUpload?: boolean;
  uploadingResume?: boolean;
  uploadError?: string;
  onFileUploadClick?: () => void;
  fileInputRef?: React.RefObject<HTMLInputElement | null>;
  onFileChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export default function ProfileFormFields({
  values,
  onChange,
  inputCls,
  labelCls,
  inputStyle,
  labelStyle,
  layout = 'stacked',
  showArrow = false,
  resumeRows = 4,
  showFileUpload = false,
  uploadingResume = false,
  uploadError = '',
  onFileUploadClick,
  fileInputRef,
  onFileChange,
}: Props) {
  const selectCls = showArrow ? `${inputCls} appearance-none pr-8` : inputCls;

  const arrow = showArrow ? (
    <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs" style={labelStyle}>▾</span>
  ) : null;

  const careerField = (
    <div className="flex flex-col gap-1.5">
      <label className={labelCls} style={labelStyle}>경력 단계</label>
      <div className="relative">
        <select
          value={values.careerTrack}
          onChange={(e) => {
            const nextTrack = e.target.value;
            onChange({
              careerTrack: nextTrack,
              careerYears: nextTrack === '경력 n년차' ? values.careerYears : '',
              careerLevel:
                nextTrack === '신입'
                  ? '신입'
                  : nextTrack === '경력 n년차'
                    ? (values.careerYears ? `${values.careerYears}년차` : '')
                    : nextTrack,
            });
          }}
          className={selectCls}
          style={inputStyle}
        >
          <option value="">선택 안함</option>
          {CAREER_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        {arrow}
      </div>
      {values.careerTrack === '경력 n년차' && (
        <div className="relative">
          <select
            value={values.careerYears}
            onChange={(e) => {
              const careerYears = e.target.value;
              onChange({
                careerTrack: '경력 n년차',
                careerYears,
                careerLevel: careerYears ? `${careerYears}년차` : '',
              });
            }}
            className={selectCls}
            style={inputStyle}
          >
            <option value="">년차 선택</option>
            {CAREER_YEAR_OPTIONS.map((year) => (
              <option key={year} value={year}>{year}년차</option>
            ))}
          </select>
          {arrow}
        </div>
      )}
    </div>
  );

  const jobField = (
    <div className="flex flex-col gap-1.5">
      <label className={labelCls} style={labelStyle}>희망 직군</label>
      <div className="relative">
        <select
          value={values.jobDropdown}
          onChange={(e) => {
            const val = e.target.value;
            onChange({ jobDropdown: val, desiredJob: val !== '직접 입력' ? val : '' });
          }}
          className={selectCls}
          style={inputStyle}
        >
          <option value="">선택 안함</option>
          {DESIRED_JOBS.map((j) => <option key={j} value={j}>{j}</option>)}
        </select>
        {arrow}
      </div>
      {values.jobDropdown === '직접 입력' && (
        <input
          type="text"
          value={values.desiredJob}
          onChange={(e) => onChange({ desiredJob: e.target.value })}
          placeholder="희망 직군을 입력하세요"
          className={inputCls}
          style={inputStyle}
          autoFocus
        />
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-3">
      {layout === 'grid' ? (
        <div className="grid grid-cols-2 gap-3 items-start">
          {careerField}
          {jobField}
        </div>
      ) : (
        <>
          {careerField}
          {jobField}
        </>
      )}

      <div>
        <label className={labelCls} style={labelStyle}>보유 역량 / 툴</label>
        <input
          type="text"
          value={values.techStack}
          onChange={(e) => onChange({ techStack: e.target.value })}
          placeholder={
            TECH_STACK_PLACEHOLDERS[values.jobDropdown]
              ? `예) ${TECH_STACK_PLACEHOLDERS[values.jobDropdown]}`
              : '예) Java, React / Figma, Jira / 퍼포먼스 마케팅'
          }
          className={inputCls}
          style={inputStyle}
        />
      </div>

      <div className="flex flex-col gap-1.5">
          <label className={labelCls} style={labelStyle}>희망 업종</label>
          <div className="relative">
            <select
              value={values.industryDropdown}
              onChange={(e) => {
                const val = e.target.value;
                onChange({ industryDropdown: val, desiredIndustry: val !== '직접 입력' ? val : '' });
              }}
              className={selectCls}
              style={inputStyle}
            >
              <option value="">선택 안함</option>
              {DESIRED_INDUSTRIES.map((ind) => <option key={ind} value={ind}>{ind}</option>)}
            </select>
            {arrow}
          </div>
          {values.industryDropdown === '직접 입력' && (
            <input
              type="text"
              value={values.desiredIndustry}
              onChange={(e) => onChange({ desiredIndustry: e.target.value })}
              placeholder="희망 업종을 입력하세요"
              className={inputCls}
              style={inputStyle}
              autoFocus
            />
          )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className={labelCls} style={labelStyle}>
            자기소개서 / 이력서
            <span className="ml-1 text-xs" style={{ color: '#ff9090' }}>(면접 준비 및 자소서 작성에 활용)</span>
          </label>
          {showFileUpload && (
            <>
              <button
                type="button"
                onClick={onFileUploadClick}
                disabled={uploadingResume}
                className="text-xs px-2.5 py-1 rounded-lg border transition-colors disabled:opacity-50"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)', backgroundColor: 'transparent' }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-hover)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                {uploadingResume ? '파싱 중...' : '파일로 불러오기'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.txt"
                className="hidden"
                onChange={onFileChange}
              />
            </>
          )}
        </div>
        {showFileUpload && (
          <p className="text-xs mb-1.5" style={{ color: '#ff9090' }}>
            PDF, DOCX, TXT 형식 지원 · 최대 10MB · HWP는 PDF로 변환 후 업로드
          </p>
        )}
        {uploadError && <p className="text-xs mb-1" style={{ color: '#ff9090' }}>{uploadError}</p>}
        <textarea
          value={values.resumeText}
          onChange={(e) => onChange({ resumeText: e.target.value })}
          placeholder="자기소개서나 이력서 내용을 붙여넣거나 파일로 불러오세요..."
          rows={resumeRows}
          className={`${inputCls} resize-none leading-relaxed`}
          style={inputStyle}
        />
      </div>
    </div>
  );
}
