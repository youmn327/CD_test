'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Member, Submission } from '@/lib/types';
import type { Problem } from '@/lib/problems';
import Toast, { toast } from './Toast';

interface Props {
  initialMembers: Member[];
  initialSubmissions: Submission[];
  problems: Problem[];
}

export default function Dashboard({ initialMembers, initialSubmissions, problems }: Props) {
  const [members, setMembers] = useState(initialMembers);
  const [submissions, setSubmissions] = useState(initialSubmissions);
  const [tab, setTab] = useState<'monthly' | 'daily'>('monthly');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedDailyYear, setSelectedDailyYear] = useState(new Date().getFullYear());
  const [showModal, setShowModal] = useState(false);
  const [newId, setNewId] = useState('');
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#7ee787');

  const defaultIds = ['jjw', 'nym'];

  // === 멤버 추가 ===
  async function createMember() {
    const id = newId.trim().toLowerCase();
    const name = newName.trim() || id.toUpperCase();
    if (!id || !/^[a-zA-Z0-9_]+$/.test(id)) return toast('아이디는 영문, 숫자, _만 가능합니다.', 'error');
    if (members.some(m => m.id === id)) return toast('이미 존재하는 아이디입니다.', 'error');

    const res = await fetch('/api/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name, color: newColor }),
    });
    if (!res.ok) return toast('멤버 추가 실패', 'error');

    const updated = await res.json();
    setMembers(updated);
    setShowModal(false);
    setNewId('');
    setNewName('');
    setNewColor('#7ee787');
    toast(`${name} 멤버 추가 + 백업 커밋 완료!`);
  }

  // === 멤버 삭제 ===
  async function deleteMember(id: string) {
    if (!confirm(`"${id}" 멤버를 삭제하시겠습니까?\n제출 데이터와 백업도 함께 삭제됩니다.`)) return;
    const res = await fetch(`/api/members?id=${id}`, { method: 'DELETE' });
    if (!res.ok) return toast('삭�� 실패', 'error');
    const updated = await res.json();
    setMembers(updated);
    setSubmissions(submissions.filter(s => s.member !== id));
    toast(`${id} 멤버 + 백업 삭제 완료!`);
  }

  // === 월별 데이터 ===
  function getMonthlyData() {
    const summary: Record<string, Record<string, number>> = {};
    members.forEach(m => { summary[m.id] = {}; });
    submissions.forEach(s => {
      const month = s.date.slice(0, 7);
      if (!summary[s.member]) summary[s.member] = {};
      summary[s.member][month] = (summary[s.member][month] || 0) + 1;
    });
    return summary;
  }

  // === 일별 데이터 ===
  function getDailyData() {
    const m = selectedMonth + 1;
    const monthKey = `${selectedDailyYear}-${String(m).padStart(2, '0')}`;
    const data: Record<number, Record<string, number>> = {};
    submissions.forEach(s => {
      if (s.date.startsWith(monthKey)) {
        const day = parseInt(s.date.split('-')[2]);
        if (!data[day]) data[day] = {};
        data[day][s.member] = (data[day][s.member] || 0) + 1;
      }
    });
    return data;
  }

  const monthlyData = getMonthlyData();
  const dailyData = getDailyData();
  const m = selectedMonth + 1;
  const daysInMonth = new Date(selectedDailyYear, m, 0).getDate();
  const firstDay = new Date(selectedDailyYear, selectedMonth, 1).getDay();
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const today = new Date();

  // 월간 요약
  const monthKey = `${selectedDailyYear}-${String(m).padStart(2, '0')}`;
  const monthSubs = submissions.filter(s => s.date.startsWith(monthKey));

  return (
    <>
      {/* 멤버 카드 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {members.map(member => {
          const solved = submissions.filter(s => s.member === member.id).length;
          const pct = Math.round((solved / problems.length) * 100);
          const isCustom = !defaultIds.includes(member.id);
          return (
            <div key={member.id} className="relative">
              {isCustom && (
                <button
                  onClick={() => deleteMember(member.id)}
                  className="absolute top-2 right-2 w-6 h-6 rounded-full bg-red-500/15 text-red-400 text-sm flex items-center justify-center z-10 opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
                  style={{ opacity: undefined }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
                >
                  &times;
                </button>
              )}
              <Link href={`/${member.id}`}>
                <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-5 hover:border-[#58a6ff] transition-colors cursor-pointer">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg text-white" style={{ background: member.color }}>
                      {member.name[0]}
                    </div>
                    <span className="text-lg font-semibold">{member.name}</span>
                  </div>
                  <div className="text-3xl font-bold mb-1">
                    {solved}<span className="text-base text-[#8b949e]"> / {problems.length}</span>
                  </div>
                  <div className="text-xs text-[#8b949e] mb-3">문제 풀이 완료 ({pct}%)</div>
                  <div className="w-full h-2 bg-[#21262d] rounded overflow-hidden">
                    <div className="h-full rounded transition-all" style={{ width: `${pct}%`, background: member.color }} />
                  </div>
                </div>
              </Link>
            </div>
          );
        })}
        {/* 추가 카드 */}
        <div
          onClick={() => setShowModal(true)}
          className="border-2 border-dashed border-[#30363d] rounded-xl flex flex-col items-center justify-center min-h-[160px] cursor-pointer hover:border-[#58a6ff] transition-colors group"
        >
          <div className="text-4xl text-[#484f58] group-hover:text-[#58a6ff] transition-colors">+</div>
          <div className="text-sm text-[#484f58] group-hover:text-[#8b949e] mt-1">멤버 추가</div>
        </div>
      </div>

      {/* 탭 헤더 */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between mb-5 pb-3 border-b border-[#30363d] flex-wrap gap-3">
          <div className="flex bg-[#21262d] rounded-lg p-0.5">
            <button
              onClick={() => setTab('monthly')}
              className={`px-5 py-2 rounded-md text-sm font-semibold transition-colors cursor-pointer ${tab === 'monthly' ? 'bg-[#30363d] text-white' : 'text-[#8b949e] hover:text-white'}`}
            >
              월별
            </button>
            <button
              onClick={() => setTab('daily')}
              className={`px-5 py-2 rounded-md text-sm font-semibold transition-colors cursor-pointer ${tab === 'daily' ? 'bg-[#30363d] text-white' : 'text-[#8b949e] hover:text-white'}`}
            >
              일별
            </button>
          </div>
          {tab === 'monthly' ? (
            <div className="flex items-center gap-3">
              <button onClick={() => setSelectedYear(y => y - 1)} className="w-8 h-8 bg-[#21262d] border border-[#30363d] rounded-md flex items-center justify-center hover:bg-[#30363d] cursor-pointer">&larr;</button>
              <span className="text-base font-semibold min-w-[60px] text-center">{selectedYear}</span>
              <button onClick={() => setSelectedYear(y => y + 1)} className="w-8 h-8 bg-[#21262d] border border-[#30363d] rounded-md flex items-center justify-center hover:bg-[#30363d] cursor-pointer">&rarr;</button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <button onClick={() => {
                if (selectedMonth === 0) { setSelectedMonth(11); setSelectedDailyYear(y => y - 1); }
                else setSelectedMonth(m => m - 1);
              }} className="w-8 h-8 bg-[#21262d] border border-[#30363d] rounded-md flex items-center justify-center hover:bg-[#30363d] cursor-pointer">&larr;</button>
              <span className="text-base font-semibold min-w-[100px] text-center">{selectedDailyYear}년 {selectedMonth + 1}월</span>
              <button onClick={() => {
                if (selectedMonth === 11) { setSelectedMonth(0); setSelectedDailyYear(y => y + 1); }
                else setSelectedMonth(m => m + 1);
              }} className="w-8 h-8 bg-[#21262d] border border-[#30363d] rounded-md flex items-center justify-center hover:bg-[#30363d] cursor-pointer">&rarr;</button>
            </div>
          )}
        </div>

        {/* 월별 테이블 */}
        {tab === 'monthly' && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className="text-left text-[#8b949e] font-medium p-2">이름</th>
                  {Array.from({ length: 12 }, (_, i) => (
                    <th key={i} className="text-center text-[#8b949e] font-medium p-2 text-xs">{i + 1}월</th>
                  ))}
                  <th className="text-center text-[#8b949e] font-medium p-2">합계</th>
                </tr>
              </thead>
              <tbody>
                {members.map(member => {
                  const data = monthlyData[member.id] || {};
                  let yearTotal = 0;
                  return (
                    <tr key={member.id} className="border-t border-[#21262d]">
                      <td className="p-2 font-semibold" style={{ color: member.color }}>{member.name}</td>
                      {Array.from({ length: 12 }, (_, i) => {
                        const key = `${selectedYear}-${String(i + 1).padStart(2, '0')}`;
                        const count = data[key] || 0;
                        yearTotal += count;
                        return (
                          <td key={i} className="p-2 text-center">
                            <span className={`inline-block min-w-[28px] px-1.5 py-0.5 rounded font-semibold ${count > 0 ? 'bg-[#58a6ff]/10 text-[#58a6ff]' : 'text-[#484f58]'}`}>
                              {count || '-'}
                            </span>
                          </td>
                        );
                      })}
                      <td className="p-2 text-center text-[#58a6ff] font-bold">{yearTotal}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 일별 캘린더 */}
        {tab === 'daily' && (
          <>
            <div className="w-full">
              {/* 요일 헤더 */}
              <div className="grid grid-cols-7 gap-1 mb-1">
                {dayNames.map((name, i) => (
                  <div key={i} className={`text-center text-xs font-semibold py-1.5 ${i === 0 || i === 6 ? 'text-red-400' : 'text-[#8b949e]'}`}>{name}</div>
                ))}
              </div>
              {/* 날짜 셀 */}
              {Array.from({ length: Math.ceil((firstDay + daysInMonth) / 7) }, (_, week) => (
                <div key={week} className="grid grid-cols-7 gap-1">
                  {Array.from({ length: 7 }, (_, dow) => {
                    const idx = week * 7 + dow;
                    const day = idx - firstDay + 1;
                    if (idx < firstDay || day > daysInMonth) {
                      return <div key={dow} className="min-h-[80px]" />;
                    }
                    const isToday = selectedDailyYear === today.getFullYear() && selectedMonth === today.getMonth() && day === today.getDate();
                    const isWeekend = dow === 0 || dow === 6;
                    const dayData = dailyData[day] || {};
                    const hasData = Object.values(dayData).some(v => v > 0);
                    return (
                      <div key={dow} className={`min-h-[80px] bg-[#0d1117] border rounded-lg p-2 flex flex-col transition-colors ${isToday ? 'border-[#58a6ff] bg-[#58a6ff]/5' : 'border-[#21262d]'} ${hasData ? 'bg-green-500/5' : ''}`}>
                        <div className={`text-xs font-semibold mb-1.5 ${isWeekend ? 'text-red-400' : 'text-[#8b949e]'}`}>{day}</div>
                        <div className="flex flex-col gap-0.5 items-center">
                          {members.map(member => {
                            const cnt = dayData[member.id] || 0;
                            if (cnt === 0) return null;
                            return (
                              <span key={member.id} className="inline-block px-1.5 py-0.5 rounded text-[11px] font-semibold text-white" style={{ background: member.color }}>
                                {member.name[0]} {cnt}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            {/* 월간 요약 */}
            <div className="mt-5 pt-5 border-t border-[#21262d]">
              <div className="text-sm font-semibold mb-3">{selectedDailyYear}년 {m}월 요약</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                {members.map(member => {
                  const memberMonthSubs = monthSubs.filter(s => s.member === member.id);
                  const activeDays = new Set(memberMonthSubs.map(s => s.date)).size;
                  const avg = activeDays > 0 ? (memberMonthSubs.length / activeDays).toFixed(1) : '0';
                  return (
                    <div key={member.id} className="flex items-center gap-3 bg-[#0d1117] border border-[#21262d] rounded-lg p-3">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-white shrink-0" style={{ background: member.color }}>
                        {member.name[0]}
                      </div>
                      <div>
                        <div className="text-xs font-semibold" style={{ color: member.color }}>{member.name}</div>
                        <div className="text-xl font-bold">{memberMonthSubs.length}문제</div>
                        <div className="text-[11px] text-[#8b949e]">{activeDays}일 활동 · 일평균 {avg}문제</div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="text-xs text-[#8b949e] text-right">이번 달 전체: {monthSubs.length}문제</div>
            </div>
          </>
        )}
      </div>

      {/* 최근 제출 */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4 pb-3 border-b border-[#30363d]">최근 제출</h2>
        {submissions.length === 0 ? (
          <div className="text-center py-8 text-[#484f58] text-sm">아직 제출된 풀이가 없습니다.</div>
        ) : (
          [...submissions].reverse().slice(0, 10).map(s => {
            const member = members.find(m => m.id === s.member);
            return (
              <div key={s.timestamp} className="flex items-center justify-between py-3 border-b border-[#21262d] last:border-0">
                <div>
                  <div className="text-sm font-semibold">
                    <span style={{ color: member?.color || '#8b949e' }}>[{s.member}]</span>{' '}
                    {s.problemId} - {s.problemName}
                  </div>
                  <div className="text-xs text-[#8b949e]">{s.date}</div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 멤버 추가 모달 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-6" onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-6 w-full max-w-[420px]">
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-[#30363d]">
              <h3 className="text-lg font-semibold">새 멤버 추가</h3>
              <button onClick={() => setShowModal(false)} className="text-[#8b949e] hover:text-white text-2xl cursor-pointer">&times;</button>
            </div>
            <div className="mb-4">
              <label className="block text-sm text-[#8b949e] mb-1.5">아이디 (영문, 폴더명)</label>
              <input type="text" value={newId} onChange={e => setNewId(e.target.value)} placeholder="예: hong"
                className="w-full px-3 py-2.5 bg-[#0d1117] border border-[#30363d] rounded-lg text-sm text-white outline-none focus:border-[#58a6ff]" />
            </div>
            <div className="mb-4">
              <label className="block text-sm text-[#8b949e] mb-1.5">표시 이름</label>
              <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="예: HONG"
                className="w-full px-3 py-2.5 bg-[#0d1117] border border-[#30363d] rounded-lg text-sm text-white outline-none focus:border-[#58a6ff]" />
            </div>
            <div className="mb-5">
              <label className="block text-sm text-[#8b949e] mb-1.5">테마 색상</label>
              <div className="flex items-center gap-3">
                <input type="color" value={newColor} onChange={e => setNewColor(e.target.value)}
                  className="w-12 h-9 bg-[#0d1117] border border-[#30363d] rounded-md cursor-pointer" />
                <div className="w-9 h-9 rounded-full" style={{ background: newColor }} />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowModal(false)} className="px-5 py-2.5 border border-[#30363d] rounded-lg text-sm font-semibold text-[#8b949e] hover:text-white hover:border-[#8b949e] cursor-pointer">취소</button>
              <button onClick={createMember} className="px-5 py-2.5 bg-[#238636] rounded-lg text-sm font-semibold text-white hover:bg-[#2ea043] cursor-pointer">생성</button>
            </div>
          </div>
        </div>
      )}

      <Toast />
    </>
  );
}
