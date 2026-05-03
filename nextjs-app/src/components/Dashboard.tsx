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
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');

  // === 멤버 추가 ===
  async function createMember() {
    const id = newId.trim().toLowerCase();
    const name = newName.trim() || id.toUpperCase();
    if (!id || !/^[a-zA-Z0-9_]+$/.test(id)) return toast('아이디는 영문, 숫자, _만 가능합니다.', 'error');
    if (members.some(m => m.id === id)) return toast('이미 존재하는 아이디입니다.', 'error');

    setLoading(true);
    setLoadingMsg('멤버 추가 및 GitHub 백업 커밋 중...');
    setShowModal(false);

    const res = await fetch('/api/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name, color: newColor }),
    });
    if (!res.ok) { setLoading(false); return toast('멤버 추가 실패', 'error'); }

    const updated = await res.json();
    setMembers(updated);
    setNewId('');
    setNewName('');
    setNewColor('#7ee787');
    setLoading(false);
    toast(`${name} 멤버 추가 + 백업 커밋 완료!`);
  }

  // === 멤버 삭제 (비밀번호 필요) ===
  async function deleteMember(id: string) {
    if (!confirm(`"${id}" 멤버를 삭제하시겠습니까?\n제출 데이터와 백업도 함께 삭제됩니다.`)) return;
    const password = prompt('관리자 비밀번호를 입력하세요:');
    if (password === null) return; // 사용자가 취소
    if (!password) return toast('비밀번호를 입력해야 합니다.', 'error');

    setLoading(true);
    setLoadingMsg('멤버 삭제 및 GitHub 백업 커밋 중...');

    const res = await fetch(`/api/members?id=${id}`, {
      method: 'DELETE',
      headers: { 'x-admin-password': password },
    });
    if (res.status === 401) { setLoading(false); return toast('비밀번호가 일치하지 않습니다.', 'error'); }
    if (!res.ok) { setLoading(false); return toast('삭제 실패', 'error'); }
    const updated = await res.json();
    setMembers(updated);
    setSubmissions(submissions.filter(s => s.member !== id));
    setLoading(false);
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

  // === 벌금 계산: 2일에 2문제 미만 → 2,000원 ===
  const FINE_PER_PERIOD = 2000;
  const PERIOD_DAYS = 2;
  const REQUIRED_PROBLEMS = 2;
  const BET_START_DATE = '2026-05-01'; // 내기 시작일

  function calculateFines() {
    const startDate = new Date(BET_START_DATE);
    const todayDate = new Date(today.toISOString().slice(0, 10));

    // 시작일이 아직 안 됐으면 빈 결과
    if (todayDate < startDate) {
      return { byMember: {} as Record<string, number>, total: 0, periods: [] as Array<{start: string, end: string, missed: Array<{member: string, count: number}>}> };
    }

    const byMember: Record<string, number> = {};
    members.forEach(m => { byMember[m.id] = 0; });
    const periods: Array<{start: string, end: string, missed: Array<{member: string, count: number}>}> = [];

    const cur = new Date(startDate);
    while (cur <= todayDate) {
      const periodStart = new Date(cur);
      const periodEnd = new Date(cur);
      periodEnd.setDate(periodEnd.getDate() + PERIOD_DAYS - 1);

      // 현재 진행 중인 기간은 제외 (아직 끝나지 않음)
      if (periodEnd > todayDate) break;

      const startStr = periodStart.toISOString().slice(0, 10);
      const endStr = periodEnd.toISOString().slice(0, 10);
      const missed: Array<{member: string, count: number}> = [];

      members.forEach(m => {
        const count = submissions.filter(s =>
          s.member === m.id && s.date >= startStr && s.date <= endStr
        ).length;
        if (count < REQUIRED_PROBLEMS) {
          byMember[m.id] = (byMember[m.id] || 0) + FINE_PER_PERIOD;
          missed.push({ member: m.id, count });
        }
      });

      if (missed.length > 0) {
        periods.push({ start: startStr, end: endStr, missed });
      }

      cur.setDate(cur.getDate() + PERIOD_DAYS);
    }

    const total = Object.values(byMember).reduce((a, b) => a + b, 0);
    return { byMember, total, periods };
  }

  const fines = calculateFines();

  // === 월별 벌금 정산: { memberId: { 'YYYY-MM': fine } } ===
  function calculateFinesByMonth() {
    const startDate = new Date(BET_START_DATE);
    const todayDate = new Date(today.toISOString().slice(0, 10));
    const result: Record<string, Record<string, number>> = {};
    members.forEach(mem => { result[mem.id] = {}; });
    if (todayDate < startDate) return result;

    const cur = new Date(startDate);
    while (cur <= todayDate) {
      const periodStart = new Date(cur);
      const periodEnd = new Date(cur);
      periodEnd.setDate(periodEnd.getDate() + PERIOD_DAYS - 1);
      if (periodEnd > todayDate) break;

      const startStr = periodStart.toISOString().slice(0, 10);
      const endStr = periodEnd.toISOString().slice(0, 10);
      const monthKey = startStr.slice(0, 7);

      members.forEach(mem => {
        const count = submissions.filter(s =>
          s.member === mem.id && s.date >= startStr && s.date <= endStr
        ).length;
        if (count < REQUIRED_PROBLEMS) {
          result[mem.id][monthKey] = (result[mem.id][monthKey] || 0) + FINE_PER_PERIOD;
        }
      });

      cur.setDate(cur.getDate() + PERIOD_DAYS);
    }
    return result;
  }

  const monthlyFines = calculateFinesByMonth();

  // 월별 합계
  const monthlyFinesTotalByMonth: Record<string, number> = {};
  Object.values(monthlyFines).forEach(byMonth => {
    Object.entries(byMonth).forEach(([month, fine]) => {
      monthlyFinesTotalByMonth[month] = (monthlyFinesTotalByMonth[month] || 0) + fine;
    });
  });

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

      {/* 멤버 카드 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {members.map(member => {
          const solved = submissions.filter(s => s.member === member.id).length;
          const pct = Math.round((solved / problems.length) * 100);
          return (
            <div key={member.id} className="relative">
              <button
                onClick={() => deleteMember(member.id)}
                className="absolute top-2 right-2 w-7 h-7 rounded-md bg-red-500/15 hover:bg-red-500/30 text-red-400 hover:text-red-300 text-sm flex items-center justify-center z-10 cursor-pointer transition-all border border-red-500/30 hover:border-red-500/60"
                title="멤버 삭제 (비밀번호 필요)"
                aria-label="멤버 삭제"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M6.5 1.75a.25.25 0 01.25-.25h2.5a.25.25 0 01.25.25V3h-3V1.75zm4.5 0V3h2.25a.75.75 0 010 1.5H2.75a.75.75 0 010-1.5H5V1.75C5 .784 5.784 0 6.75 0h2.5C10.216 0 11 .784 11 1.75zM4.496 6.675a.75.75 0 10-1.492.15l.66 6.6A1.75 1.75 0 005.405 15h5.19c.9 0 1.652-.681 1.741-1.576l.66-6.6a.75.75 0 00-1.492-.149l-.66 6.6a.25.25 0 01-.249.225h-5.19a.25.25 0 01-.249-.225l-.66-6.6z"/></svg>
              </button>
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
                  const fineData = monthlyFines[member.id] || {};
                  let yearTotal = 0;
                  let yearFine = 0;
                  return (
                    <tr key={member.id} className="border-t border-[#21262d]">
                      <td className="p-2 font-semibold" style={{ color: member.color }}>{member.name}</td>
                      {Array.from({ length: 12 }, (_, i) => {
                        const key = `${selectedYear}-${String(i + 1).padStart(2, '0')}`;
                        const count = data[key] || 0;
                        const fine = fineData[key] || 0;
                        yearTotal += count;
                        yearFine += fine;
                        return (
                          <td key={i} className="p-2 text-center align-top">
                            <span className={`inline-block min-w-[28px] px-1.5 py-0.5 rounded font-semibold ${count > 0 ? 'bg-[#58a6ff]/10 text-[#58a6ff]' : 'text-[#484f58]'}`}>
                              {count || '-'}
                            </span>
                            {fine > 0 && (
                              <div className="text-[10px] text-red-400 font-semibold mt-0.5">
                                -{(fine/1000).toFixed(0)}K
                              </div>
                            )}
                          </td>
                        );
                      })}
                      <td className="p-2 text-center align-top">
                        <div className="text-[#58a6ff] font-bold">{yearTotal}</div>
                        {yearFine > 0 && (
                          <div className="text-[11px] text-red-400 font-semibold mt-0.5">
                            -{yearFine.toLocaleString()}원
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {/* 월별 합계 행 */}
                <tr className="border-t-2 border-[#30363d] bg-[#0d1117]">
                  <td className="p-2 font-semibold text-[#8b949e] text-xs">월별 벌금</td>
                  {Array.from({ length: 12 }, (_, i) => {
                    const key = `${selectedYear}-${String(i + 1).padStart(2, '0')}`;
                    const monthFine = monthlyFinesTotalByMonth[key] || 0;
                    return (
                      <td key={i} className="p-2 text-center text-xs">
                        {monthFine > 0 ? (
                          <span className="text-red-400 font-bold">{(monthFine/1000).toFixed(0)}K</span>
                        ) : (
                          <span className="text-[#484f58]">-</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="p-2 text-center text-red-400 font-bold text-xs">
                    {Object.entries(monthlyFinesTotalByMonth)
                      .filter(([k]) => k.startsWith(String(selectedYear)))
                      .reduce((a, [, v]) => a + v, 0)
                      .toLocaleString()}원
                  </td>
                </tr>
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
                    const totalCount = Object.values(dayData).reduce((a, b) => a + b, 0);
                    // 활동량에 따른 배경 강도
                    const intensity = totalCount === 0 ? 0 : totalCount < 2 ? 1 : totalCount < 5 ? 2 : totalCount < 10 ? 3 : 4;
                    const bgColors = ['', 'bg-green-500/10', 'bg-green-500/20', 'bg-green-500/30', 'bg-green-500/40'];
                    const dateStr = `${selectedDailyYear}-${String(m).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                    const isFuture = new Date(dateStr) > today;
                    return (
                      <div key={dow} className={`min-h-[100px] border rounded-lg p-2 flex flex-col transition-all ${isToday ? 'border-[#58a6ff] ring-1 ring-[#58a6ff]/40' : 'border-[#21262d] hover:border-[#30363d]'} ${isFuture ? 'opacity-30' : ''} ${bgColors[intensity]}`} title={`${dateStr} - ${totalCount}문제`}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className={`text-xs font-bold ${isToday ? 'text-[#58a6ff]' : isWeekend ? 'text-red-400' : 'text-[#e6edf3]'}`}>{day}</span>
                          {totalCount > 0 && (
                            <span className="text-[10px] text-[#8b949e] font-semibold">{totalCount}</span>
                          )}
                        </div>
                        <div className="flex flex-col gap-0.5 items-stretch">
                          {members.map(member => {
                            const cnt = dayData[member.id] || 0;
                            if (cnt === 0) return null;
                            return (
                              <span key={member.id} className="inline-flex items-center justify-between gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold text-white" style={{ background: member.color }} title={`${member.name}: ${cnt}문제`}>
                                <span className="truncate">{member.name}</span>
                                <span className="shrink-0">{cnt}</span>
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
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div className="text-sm font-semibold">{selectedDailyYear}년 {m}월 요약</div>
                {(monthlyFinesTotalByMonth[monthKey] || 0) > 0 && (
                  <div className="text-xs">
                    <span className="text-[#8b949e]">이번 달 벌금: </span>
                    <span className="text-red-400 font-bold">{(monthlyFinesTotalByMonth[monthKey] || 0).toLocaleString()}원</span>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                {members.map(member => {
                  const memberMonthSubs = monthSubs.filter(s => s.member === member.id);
                  const activeDays = new Set(memberMonthSubs.map(s => s.date)).size;
                  const avg = activeDays > 0 ? (memberMonthSubs.length / activeDays).toFixed(1) : '0';
                  const memberMonthFine = (monthlyFines[member.id] || {})[monthKey] || 0;
                  return (
                    <div key={member.id} className={`flex items-center gap-3 border rounded-lg p-3 ${memberMonthFine > 0 ? 'bg-red-500/5 border-red-500/30' : 'bg-[#0d1117] border-[#21262d]'}`}>
                      <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-white shrink-0" style={{ background: member.color }}>
                        {member.name[0]}
                      </div>
                      <div className="flex-1">
                        <div className="text-xs font-semibold" style={{ color: member.color }}>{member.name}</div>
                        <div className="text-xl font-bold">{memberMonthSubs.length}문제</div>
                        <div className="text-[11px] text-[#8b949e]">{activeDays}일 활동 · 일평균 {avg}문제</div>
                        {memberMonthFine > 0 && (
                          <div className="text-[11px] text-red-400 font-semibold mt-0.5">
                            벌금 {memberMonthFine.toLocaleString()}원 ({memberMonthFine / FINE_PER_PERIOD}회 미달)
                          </div>
                        )}
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

      {/* 벌금 현황 */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#30363d] flex-wrap gap-2">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <span>💰 내기 벌금 현황</span>
            </h2>
            <p className="text-xs text-[#8b949e] mt-1">규칙: 2일 합산 2문제 이상 풀이 (1+1 또는 0+2 모두 OK). 미달 시 2,000원 · 시작: 2026-05-01</p>
          </div>
          <div className="text-right">
            <div className="text-xs text-[#8b949e]">총 벌금</div>
            <div className="text-2xl font-bold text-red-400">{fines.total.toLocaleString()}원</div>
          </div>
        </div>

        {/* 멤버별 벌금 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          {members.map(member => {
            const fine = fines.byMember[member.id] || 0;
            const periods = Math.floor(fine / FINE_PER_PERIOD);
            return (
              <div key={member.id} className={`flex items-center gap-3 border rounded-lg p-3 ${fine > 0 ? 'bg-red-500/5 border-red-500/30' : 'bg-[#0d1117] border-[#21262d]'}`}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shrink-0" style={{ background: member.color }}>
                  {member.name[0]}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold" style={{ color: member.color }}>{member.name}</div>
                  <div className={`text-lg font-bold ${fine > 0 ? 'text-red-400' : 'text-[#7ee787]'}`}>
                    {fine === 0 ? '벌금 없음 ✓' : `${fine.toLocaleString()}원`}
                  </div>
                  {periods > 0 && (
                    <div className="text-[11px] text-[#8b949e]">{periods}회 미달성</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* 미달성 기간 상세 (접을 수 있게) */}
        {fines.periods.length > 0 && (
          <details className="text-sm">
            <summary className="cursor-pointer text-[#8b949e] hover:text-white py-2">
              미달성 기간 상세 보기 ({fines.periods.length}건)
            </summary>
            <div className="mt-2 max-h-60 overflow-y-auto space-y-1 pr-2">
              {fines.periods.map((p, i) => (
                <div key={i} className="flex items-center justify-between bg-[#0d1117] border border-[#21262d] rounded px-3 py-2 text-xs">
                  <span className="text-[#8b949e]">{p.start} ~ {p.end}</span>
                  <div className="flex gap-1.5">
                    {p.missed.map(m => {
                      const member = members.find(mem => mem.id === m.member);
                      return (
                        <span key={m.member} className="px-1.5 py-0.5 rounded text-[10px] font-bold text-white" style={{ background: member?.color || '#8b949e' }} title={`${m.count}문제만 풀이`}>
                          {member?.name[0] || m.member[0]} {m.count}/2
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </details>
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
