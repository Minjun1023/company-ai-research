import { useState } from 'react';
import type { SessionType } from '../../types';
import { trim } from './chatShared';

type StarterSubmitHandler = (prompt: string) => void;

export function WorkspaceStarterForm({
  workspaceType,
  loading,
  onSubmit,
}: {
  workspaceType: SessionType;
  loading: boolean;
  onSubmit: StarterSubmitHandler;
}) {
  const [company, setCompany] = useState('');
  const [companyA, setCompanyA] = useState('');
  const [companyB, setCompanyB] = useState('');
  const [jobRole, setJobRole] = useState('');
  const [focus, setFocus] = useState('');
  const [difficulty, setDifficulty] = useState('실무형');
  const [taskKind, setTaskKind] = useState('초안 작성');
  const [careerYears, setCareerYears] = useState('');
  const [currentSalary, setCurrentSalary] = useState('');
  const [offerStatus, setOfferStatus] = useState('오퍼 전');
  const [targetSalary, setTargetSalary] = useState('');

  const inputCls = 'w-full rounded-[18px] border border-transparent bg-input px-4 py-3 text-sm text-text outline-none transition-colors placeholder:text-muted focus:border-surface-2';
  const selectCls = `${inputCls} appearance-none`;

  const submit = () => {
    const prompt = (() => {
      switch (workspaceType) {
        case 'research':
          return `${trim(company)}${trim(focus) ? ` ${trim(focus)} 중심으로` : ''} 심층 분석해줘`;
        case 'compare':
          return `${trim(companyA)}와 ${trim(companyB)}를${trim(focus) ? ` ${trim(focus)} 기준으로` : ''} 비교해줘`;
        case 'interview':
          return `${trim(company)} ${trim(jobRole) || '지원 직무'} 면접 준비를 ${difficulty} 난이도로 도와줘${trim(focus) ? `. 특히 ${trim(focus)} 중심으로 준비해줘` : ''}`;
        case 'coverletter':
          if (taskKind === '피드백') {
            return `${trim(company)} ${trim(jobRole) || '지원 직무'} 자기소개서 피드백해줘${trim(focus) ? `. 참고할 내용: ${trim(focus)}` : ''}`;
          }
          return `${trim(company)} ${trim(jobRole) || '지원 직무'} 자기소개서 초안 써줘${trim(focus) ? `. 특히 ${trim(focus)}를 강조해줘` : ''}`;
        case 'salary':
          return `${trim(company)} ${trim(jobRole) || '지원 직무'} 연봉 협상 도와줘. ${trim(careerYears) || '경력 정보 미입력'}, 현재 연봉 ${trim(currentSalary) || '미입력'}, 상태는 ${offerStatus}${trim(targetSalary) ? `, 목표 연봉은 ${trim(targetSalary)}` : ''}.`;
        case 'general':
        default:
          return `${trim(company) ? `${trim(company)} 기준으로 ` : ''}${trim(focus) || '기업 조사와 취업 준비를 도와줘'}`;
      }
    })();

    if (!trim(prompt)) return;
    onSubmit(prompt);
  };

  const canSubmit = (() => {
    switch (workspaceType) {
      case 'research':
      case 'interview':
      case 'coverletter':
      case 'salary':
        return Boolean(trim(company));
      case 'compare':
        return Boolean(trim(companyA) && trim(companyB));
      case 'general':
      default:
        return Boolean(trim(company) || trim(focus));
    }
  })();

  return (
    <div className="glass-card rounded-[26px] p-5">
      <div className="mb-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted">Structured Start</p>
        <p className="mt-2 text-base font-semibold text-text">워크스페이스에 맞는 입력으로 시작</p>
        <p className="mt-1 text-sm leading-6 text-text-sub">필수 항목만 채우면 첫 요청을 더 정확한 형태로 만들어 보냅니다.</p>
      </div>

      <div className="grid gap-3">
        {workspaceType === 'general' && (
          <>
            <input
              value={company}
              onChange={(event) => setCompany(event.target.value)}
              placeholder="회사명 선택 사항"
              className={inputCls}
            />
            <input
              value={focus}
              onChange={(event) => setFocus(event.target.value)}
              placeholder="예: 복지 비교, 취업 전략, 최근 이슈"
              className={inputCls}
            />
          </>
        )}

        {workspaceType === 'research' && (
          <>
            <input
              value={company}
              onChange={(event) => setCompany(event.target.value)}
              placeholder="분석할 회사명"
              className={inputCls}
            />
            <input
              value={focus}
              onChange={(event) => setFocus(event.target.value)}
              placeholder="중점 분석 포인트 선택 사항"
              className={inputCls}
            />
          </>
        )}

        {workspaceType === 'compare' && (
          <>
            <input
              value={companyA}
              onChange={(event) => setCompanyA(event.target.value)}
              placeholder="첫 번째 회사"
              className={inputCls}
            />
            <input
              value={companyB}
              onChange={(event) => setCompanyB(event.target.value)}
              placeholder="두 번째 회사"
              className={inputCls}
            />
            <input
              value={focus}
              onChange={(event) => setFocus(event.target.value)}
              placeholder="예: 복지, 성장성, 안정성, 기술문화"
              className={inputCls}
            />
          </>
        )}

        {workspaceType === 'interview' && (
          <>
            <input
              value={company}
              onChange={(event) => setCompany(event.target.value)}
              placeholder="지원 회사명"
              className={inputCls}
            />
            <input
              value={jobRole}
              onChange={(event) => setJobRole(event.target.value)}
              placeholder="지원 직무"
              className={inputCls}
            />
            <select
              value={difficulty}
              onChange={(event) => setDifficulty(event.target.value)}
              className={selectCls}
            >
              <option>실무형</option>
              <option>기초형</option>
              <option>압박형</option>
            </select>
            <input
              value={focus}
              onChange={(event) => setFocus(event.target.value)}
              placeholder="예: 지원동기, 직무역량, 프로젝트 경험"
              className={inputCls}
            />
          </>
        )}

        {workspaceType === 'coverletter' && (
          <>
            <input
              value={company}
              onChange={(event) => setCompany(event.target.value)}
              placeholder="지원 회사명"
              className={inputCls}
            />
            <input
              value={jobRole}
              onChange={(event) => setJobRole(event.target.value)}
              placeholder="지원 직무"
              className={inputCls}
            />
            <select
              value={taskKind}
              onChange={(event) => setTaskKind(event.target.value)}
              className={selectCls}
            >
              <option>초안 작성</option>
              <option>피드백</option>
            </select>
            <input
              value={focus}
              onChange={(event) => setFocus(event.target.value)}
              placeholder="강조할 경험 또는 참고 메모"
              className={inputCls}
            />
          </>
        )}

        {workspaceType === 'salary' && (
          <>
            <input
              value={company}
              onChange={(event) => setCompany(event.target.value)}
              placeholder="대상 회사명"
              className={inputCls}
            />
            <input
              value={jobRole}
              onChange={(event) => setJobRole(event.target.value)}
              placeholder="직무"
              className={inputCls}
            />
            <input
              value={careerYears}
              onChange={(event) => setCareerYears(event.target.value)}
              placeholder="예: 3년차 백엔드 개발자"
              className={inputCls}
            />
            <input
              value={currentSalary}
              onChange={(event) => setCurrentSalary(event.target.value)}
              placeholder="현재 연봉"
              className={inputCls}
            />
            <select
              value={offerStatus}
              onChange={(event) => setOfferStatus(event.target.value)}
              className={selectCls}
            >
              <option>오퍼 전</option>
              <option>1차 오퍼 수령</option>
              <option>처우 협의 중</option>
            </select>
            <input
              value={targetSalary}
              onChange={(event) => setTargetSalary(event.target.value)}
              placeholder="목표 연봉 선택 사항"
              className={inputCls}
            />
          </>
        )}
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={loading || !canSubmit}
        className="mt-4 rounded-full bg-accent px-5 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        구조화된 시작으로 보내기
      </button>
    </div>
  );
}
