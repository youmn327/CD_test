'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { Member, Submission } from '@/lib/types';
import type { Problem } from '@/lib/problems';
import Toast, { toast } from './Toast';

interface Props {
  member: Member;
  initialSubmissions: Submission[];
  problems: Problem[];
}

export default function MemberPage({ member, initialSubmissions, problems }: Props) {
  const [submissions, setSubmissions] = useState(initialSubmissions);
  const [selectedProblem, setSelectedProblem] = useState('');
  const [code, setCode] = useState('');
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [expandedTs, setExpandedTs] = useState<Set<string>>(new Set());

  const todayISO = new Date().toISOString().slice(0, 10);
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const todayDisplay = `${todayISO} (${days[new Date().getDay()]}요일)`;

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
    if (!selectedProblem) return toast('문제를 선택하세요.', 'error');
    if (!code.trim()) return toast('코드를 입력하세요.', 'error');

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

    if (!res.ok) return toast('제출 실패', 'error');
    const entry = await res.json();
    setSubmissions(prev => [...prev, entry]);
    setCode('');
    setSelectedProblem('');
    setImageBase64(null);
    toast(`${problem.name} 제출 완료! 백업 커밋됨`);
  }

  // 삭제
  async function handleDelete(timestamp: string) {
    const res = await fetch(`/api/submissions?timestamp=${timestamp}&member=${member.id}`, { method: 'DELETE' });
    if (!res.ok) return toast('삭제 실패', 'error');
    setSubmissions(prev => prev.filter(s => s.timestamp !== timestamp));
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
      <Link href="/" className="inline-block mb-4 text-sm text-[#8b949e] hover:text-[#58a6ff]">&larr; 대시보드로 돌아가기</Link>

      <div className="text-center mb-8 pb-6 border-b border-[#30363d]">
        <div className="w-14 h-14 rounded-full flex items-center justify-center font-bold text-2xl text-white mx-auto mb-3" style={{ background: member.color }}>
          {member.name[0]}
        </div>
        <h1 className="text-2xl font-bold">{member.name}</h1>
        <p className="text-[#8b949e] text-sm">프로그래머스 Lv.0 풀이 제출</p>
      </div>

      {/* 제출 폼 */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4 pb-3 border-b border-[#30363d]">풀이 제출</h2>

        <div className="mb-4">
          <label className="block text-sm text-[#8b949e] mb-1.5">문제 선택</label>
          <select
            value={selectedProblem}
            onChange={e => setSelectedProblem(e.target.value)}
            className="w-full px-3 py-2.5 bg-[#0d1117] border border-[#30363d] rounded-lg text-sm text-white outline-none focus:border-[#58a6ff]"
          >
            <option value="">-- 문제를 선택하세요 --</option>
            {problems.map(p => (
              <option key={p.id} value={p.id} style={submittedIds.has(p.id) ? { color: '#7ee787' } : {}}>
                {submittedIds.has(p.id) ? '✓ ' : ''}{p.id} - {p.name} ({p.rate}%)
              </option>
            ))}
          </select>
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

        <button onClick={handleSubmit} className="px-6 py-2.5 bg-[#238636] rounded-lg text-sm font-semibold text-white hover:bg-[#2ea043] cursor-pointer">
          업로드
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
