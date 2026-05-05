'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { Member, Submission } from '@/lib/types';
import { groupByLevel, paginateProblems, type Problem } from '@/lib/problems';
import Toast, { toast } from './Toast';

interface Props {
  member: Member;
  initialSubmissions: Submission[];
  problems: Problem[];
  initialMaintenance?: boolean;
}

export default function MemberPage({ member, initialSubmissions, problems, initialMaintenance = false }: Props) {
  const [submissions, setSubmissions] = useState(initialSubmissions);
  const [selectedProblem, setSelectedProblem] = useState('');
  const [code, setCode] = useState('');
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [expandedTs, setExpandedTs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [maintenance] = useState(initialMaintenance);
  const [activeLevel, setActiveLevel] = useState(0);
  const [activePage, setActivePage] = useState(0);
  const [showStats, setShowStats] = useState(false);

  // 레벨별 그룹 + 페이지 분할
  const grouped = groupByLevel(problems);
  const availableLevels = Object.keys(grouped).map(Number).sort();
  const currentLevelProblems = grouped[activeLevel] || [];
  const pages = paginateProblems(currentLevelProblems, 30);
  const currentPageProblems = pages[activePage] || [];

  // 레벨별 풀이 통계
  const problemIdToLevel: Record<string, number> = {};
  problems.forEach(p => { problemIdToLevel[p.id] = p.level; });
  const levelStats: Record<number, { solved: number, total: number }> = {};
  [0, 1, 2, 3, 4, 5].forEach(lv => {
    levelStats[lv] = { solved: 0, total: (grouped[lv] || []).length };
  });
  // 중복 제출 제거 (같은 문제 여러번 제출 시 1번으로 카운트)
  const solvedSet = new Set<string>();
  submissions.forEach(s => {
    if (!solvedSet.has(s.problemId)) {
      solvedSet.add(s.problemId);
      const lv = problemIdToLevel[s.problemId];
      if (lv !== undefined && levelStats[lv]) levelStats[lv].solved++;
    }
  });

  // 한국 시간 기준 날짜
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  const todayISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const todayDisplay = `${todayISO} (${days[now.getDay()]}요일)`;

  // 이미지 붙여넣기
  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          processImage(item.getAsFile()!);
          break;
        }
      }
    };
    document.addEventListener('paste', handler);
    return () => document.removeEventListener('paste', handler);
  }, []);

  function processImage(file: File) {
    if (!file.type.startsWith('image/')) return toast('이미지 파일만 가능합니다.', 'error');
    const reader = new FileReader();
    reader.onload = (e) => setImageBase64(e.target?.result as string);
    reader.readAsDataURL(file);
  }

  // 제출
  async function handleSubmit() {
    if (maintenance) return toast('운영자가 업데이트 중입니다. 잠시 후 다시 시도해주세요.', 'error');
    if (!selectedProblem) return toast('문제를 선택하세요.', 'error');
    if (!code.trim()) return toast('코드를 입력하세요.', 'error');

    setLoading(true);
    setLoadingMsg('제출 및 GitHub 백업 커밋 중...');

    const problem = problems.find(p => p.id === selectedProblem)!;
    const res = await fetch('/api/submissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        member: member.id,
        problemId: problem.id,
        problemName: problem.name,
        code: code.trim(),
        date: todayISO,
        image: imageBase64,
      }),
    });

    if (res.status === 503) { setLoading(false); return toast('운영자가 업데이트 중입니다. 잠시 후 다시 시도해주세요.', 'error'); }
    if (!res.ok) { setLoading(false); return toast('제출 실패', 'error'); }
    const entry = await res.json();
    setSubmissions(prev => [...prev, entry]);
    setCode('');
    setSelectedProblem('');
    setImageBase64(null);
    setLoading(false);
    toast(`${problem.name} 제출 완료! 백업 커밋됨`);
  }

  // 삭제
  async function handleDelete(timestamp: string) {
    setLoading(true);
    setLoadingMsg('삭제 및 백업 커밋 중...');
    const res = await fetch(`/api/submissions?timestamp=${timestamp}&member=${member.id}`, { method: 'DELETE' });
    if (!res.ok) { setLoading(false); return toast('삭제 실패', 'error'); }
    setSubmissions(prev => prev.filter(s => s.timestamp !== timestamp));
    setLoading(false);
    toast('삭제 완료! 백업 업데이트됨');
  }

  function toggleExpand(ts: string) {
    setExpandedTs(prev => {
      const next = new Set(prev);
      next.has(ts) ? next.delete(ts) : next.add(ts);
      return next;
    });
  }

  function escapeHtml(str: string) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  const submittedIds = new Set(submissions.map(s => s.problemId));

  return (
    <>
      {/* 로딩 오버레이 */}
      {loading && (
        <div className="fixed inset-0 bg-black/70 flex flex-col items-center justify-center z-[2000]">
          <div className="w-12 h-12 border-4 border-[#30363d] border-t-[#58a6ff] rounded-full animate-spin mb-4" />
          <div className="text-white text-base font-semibold">{loadingMsg}</div>
          <div className="text-[#8b949e] text-sm mt-2">GitHub에 백업 커밋 중입니다. 잠시만 기다려주세요.</div>
        </div>
      )}

      <Link href="/" className="inline-block mb-4 text-sm text-[#8b949e] hover:text-[#58a6ff]">&larr; 대시보드로 돌아가기</Link>

      {/* 점검 중 배너 */}
      {maintenance && (
        <div className="bg-yellow-500/15 border border-yellow-500/40 rounded-lg p-4 mb-4 text-center">
          <div className="text-yellow-400 font-bold text-base mb-1">⚙️ 운영자가 업데이트 중입니다</div>
          <div className="text-[#8b949e] text-sm">점검이 완료되면 다시 제출 가능합니다. 잠시만 기다려주세요.</div>
        </div>
      )}

      <div className="text-center mb-8 pb-6 border-b border-[#30363d]">
        <div className="w-14 h-14 rounded-full flex items-center justify-center font-bold text-2xl text-white mx-auto mb-3" style={{ background: member.color }}>
          {member.name[0]}
        </div>
        <h1 className="text-2xl font-bold">{member.name}</h1>
        <p className="text-[#8b949e] text-sm mb-3">프로그래머스 풀이 제출</p>
        <button
          onClick={() => setShowStats(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] rounded-lg text-sm text-[#8b949e] hover:text-white transition-colors cursor-pointer"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M1.5 1.75a.75.75 0 00-1.5 0v12.5c0 .414.336.75.75.75h14.5a.75.75 0 000-1.5H1.5V1.75zm14.28 2.53a.75.75 0 00-1.06-1.06L10 7.94 7.53 5.47a.75.75 0 00-1.06 0L3.22 8.72a.75.75 0 001.06 1.06L7 7.06l2.47 2.47a.75.75 0 001.06 0l5.25-5.25z"/></svg>
          <span>📊 레벨별 풀이 통계</span>
        </button>
      </div>

      {/* 레벨별 통계 모달 */}
      {showStats && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[1500] p-4 overflow-y-auto" onClick={e => { if (e.target === e.currentTarget) setShowStats(false); }}>
          <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-6 w-full max-w-[500px] my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-[#30363d]">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <span className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-white" style={{ background: member.color }}>{member.name[0]}</span>
                <span>{member.name} 레벨별 통계</span>
              </h3>
              <button onClick={() => setShowStats(false)} className="text-[#8b949e] hover:text-white text-2xl cursor-pointer leading-none">×</button>
            </div>

            {/* 전체 요약 */}
            <div className="bg-[#0d1117] border border-[#21262d] rounded-lg p-4 mb-4 text-center">
              <div className="text-xs text-[#8b949e] mb-1">총 풀이</div>
              <div className="text-3xl font-bold" style={{ color: member.color }}>
                {solvedSet.size}<span className="text-base text-[#8b949e]"> / {problems.length}</span>
              </div>
              <div className="text-xs text-[#8b949e] mt-1">
                {Math.round((solvedSet.size / problems.length) * 100)}% 완료
              </div>
            </div>

            {/* 레벨별 통계 */}
            <div className="space-y-2.5">
              {[0, 1, 2, 3, 4, 5].map(lv => {
                const stat = levelStats[lv];
                if (stat.total === 0) return null;
                const pct = stat.total > 0 ? Math.round((stat.solved / stat.total) * 100) : 0;
                const colors = ['#7ee787', '#58a6ff', '#a371f7', '#f0883e', '#f85149', '#db61a2'];
                const color = colors[lv];
                return (
                  <div key={lv} className="bg-[#0d1117] border border-[#21262d] rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-xs font-bold text-white" style={{ background: color }}>Lv.{lv}</span>
                        <span className="text-sm font-semibold">{stat.solved}<span className="text-[#8b949e]"> / {stat.total}문제</span></span>
                      </div>
                      <span className="text-xs font-bold" style={{ color }}>{pct}%</span>
                    </div>
                    <div className="w-full h-2 bg-[#21262d] rounded overflow-hidden">
                      <div className="h-full rounded transition-all" style={{ width: `${pct}%`, background: color }} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 pt-4 border-t border-[#30363d] flex justify-end">
              <button onClick={() => setShowStats(false)} className="px-5 py-2 bg-[#238636] hover:bg-[#2ea043] rounded-lg text-sm font-semibold text-white cursor-pointer">
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 제출 폼 */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4 pb-3 border-b border-[#30363d]">풀이 제출</h2>

        <div className="mb-4">
          <label className="block text-sm text-[#8b949e] mb-1.5">문제 선택</label>

          {/* 레벨 탭 */}
          <div className="flex gap-1 mb-2 bg-[#21262d] rounded-lg p-1 overflow-x-auto">
            {[0, 1, 2, 3, 4, 5].map(lv => {
              const has = availableLevels.includes(lv);
              return (
                <button
                  key={lv}
                  onClick={() => { setActiveLevel(lv); setActivePage(0); setSelectedProblem(''); }}
                  disabled={!has}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                    activeLevel === lv
                      ? 'bg-[#30363d] text-white'
                      : has
                      ? 'text-[#8b949e] hover:text-white'
                      : 'text-[#484f58] cursor-not-allowed'
                  }`}
                >
                  Lv.{lv}{has ? ` (${grouped[lv].length})` : ''}
                </button>
              );
            })}
          </div>

          {/* 페이지 탭 (30문제 초과 시) */}
          {pages.length > 1 && (
            <div className="flex gap-1 mb-2 flex-wrap">
              {pages.map((page, i) => (
                <button
                  key={i}
                  onClick={() => { setActivePage(i); setSelectedProblem(''); }}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                    activePage === i
                      ? 'bg-[#58a6ff] text-white'
                      : 'bg-[#21262d] text-[#8b949e] hover:text-white'
                  }`}
                >
                  {i * 30 + 1}-{i * 30 + page.length}
                </button>
              ))}
            </div>
          )}

          <select
            value={selectedProblem}
            onChange={e => setSelectedProblem(e.target.value)}
            className="w-full px-3 py-2.5 bg-[#0d1117] border border-[#30363d] rounded-lg text-sm text-white outline-none focus:border-[#58a6ff]"
          >
            <option value="">-- 문제를 선택하세요 --</option>
            {currentPageProblems.map(p => (
              <option key={p.id} value={p.id} style={submittedIds.has(p.id) ? { color: '#7ee787' } : {}}>
                {submittedIds.has(p.id) ? '✓ ' : ''}{p.id} - {p.name} ({p.rate}%)
              </option>
            ))}
          </select>
          {selectedProblem && (() => {
            const p = problems.find(pr => pr.id === selectedProblem);
            return p ? (
              <a href={p.url} target="_blank" rel="noopener noreferrer"
                className="inline-block mt-2 text-xs text-[#58a6ff] hover:underline">
                프로그래머스에서 문제 보기 &rarr;
              </a>
            ) : null;
          })()}
        </div>

        <div className="mb-4">
          <label className="block text-sm text-[#8b949e] mb-1.5">풀이 코드</label>
          <textarea
            value={code}
            onChange={e => setCode(e.target.value)}
            className="code-textarea"
            placeholder="풀이 코드를 입력하세요..."
            spellCheck={false}
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm text-[#8b949e] mb-1.5">스크린샷 첨부 (선택)</label>
          <div
            className="border-2 border-dashed border-[#30363d] rounded-lg transition-colors hover:border-[#58a6ff]"
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); if (e.dataTransfer.files[0]) processImage(e.dataTransfer.files[0]); }}
          >
            {imageBase64 ? (
              <div className="p-3 text-center">
                <img src={imageBase64} className="max-w-full max-h-[200px] rounded-md border border-[#30363d] mx-auto" />
                <button onClick={() => setImageBase64(null)} className="mt-2 px-3 py-1 text-xs text-red-400 border border-red-400/30 rounded hover:bg-red-400/10 cursor-pointer">이미지 제거</button>
              </div>
            ) : (
              <label className="block p-8 text-center text-sm text-[#484f58] cursor-pointer hover:text-[#8b949e]">
                클릭, 드래그, 또는 Ctrl+V로 이미지를 붙여넣으세요
                <input type="file" accept="image/*" className="hidden" onChange={e => { if (e.target.files?.[0]) processImage(e.target.files[0]); }} />
              </label>
            )}
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm text-[#8b949e] mb-1.5">제출 날짜</label>
          <input type="text" readOnly value={todayDisplay} className="w-full px-3 py-2.5 bg-[#0d1117] border border-[#30363d] rounded-lg text-sm text-[#8b949e] outline-none" />
        </div>

        <button
          onClick={handleSubmit}
          disabled={maintenance}
          className={`px-6 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors ${
            maintenance
              ? 'bg-gray-600 cursor-not-allowed opacity-60'
              : 'bg-[#238636] hover:bg-[#2ea043] cursor-pointer'
          }`}
        >
          {maintenance ? '점검 중 - 제출 불가' : '업로드'}
        </button>
      </div>

      {/* 제출 기록 */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-4 pb-3 border-b border-[#30363d]">
          제출 기록 ({submissions.length}건)
        </h2>
        {submissions.length === 0 ? (
          <div className="text-center py-8 text-[#484f58] text-sm">아직 제출한 풀이가 없습니다.</div>
        ) : (
          [...submissions].reverse().map(s => (
            <div key={s.timestamp} className="border-b border-[#21262d] last:border-0">
              <div
                className="flex items-center justify-between py-3 cursor-pointer"
                onClick={() => toggleExpand(s.timestamp)}
              >
                <div>
                  <div className="text-sm font-semibold">
                    {s.image && <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 mr-1.5">IMG</span>}
                    {s.problemId} - {s.problemName}
                  </div>
                  <div className="text-xs text-[#8b949e]">{s.date}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[#8b949e] text-xs">{expandedTs.has(s.timestamp) ? '▼' : '▶'}</span>
                  <button
                    onClick={e => { e.stopPropagation(); handleDelete(s.timestamp); }}
                    className="px-2 py-1 text-xs text-red-400 hover:bg-red-400/10 rounded cursor-pointer"
                  >
                    삭제
                  </button>
                </div>
              </div>
              {expandedTs.has(s.timestamp) && (
                <div className="mb-3">
                  <pre className="bg-[#0d1117] border border-[#21262d] rounded-lg p-3.5 text-[13px] font-mono text-[#e6edf3] leading-relaxed overflow-x-auto whitespace-pre-wrap break-all">
                    {escapeHtml(s.code)}
                  </pre>
                  {s.image && (
                    <img src={s.image} className="max-w-full max-h-[300px] rounded-md border border-[#21262d] mt-2.5 cursor-pointer hover:opacity-80" />
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <Toast />
    </>
  );
}
