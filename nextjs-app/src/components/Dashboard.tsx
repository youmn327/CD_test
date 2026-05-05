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
  initialMaintenance?: boolean;
}

export default function Dashboard({ initialMembers, initialSubmissions, problems, initialMaintenance = false }: Props) {
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
  const [showHelp, setShowHelp] = useState(false);
  const [maintenance, setMaintenance] = useState(initialMaintenance);

  // === 점검 모드 토글 ===
  async function toggleMaintenance() {
    const next = !maintenance;
    const action = next ? '점검 모드를 활성화' : '점검 모드를 해제';
    if (!confirm(`${action}하시겠습니까?\n${next ? '활성화 시 사용자가 문제를 제출할 수 없습니다.' : '해제 시 사용자가 다시 제출 가능합니다.'}`)) return;
    const password = prompt('관리자 비밀번호를 입력하세요:');
    if (password === null) return;
    if (!password) return toast('비밀번호를 입력해야 합니다.', 'error');

    setLoading(true);
    setLoadingMsg(`${action} 중...`);
    const res = await fetch('/api/maintenance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
      body: JSON.stringify({ active: next }),
    });
    if (res.status === 401) { setLoading(false); return toast('비밀번호가 일치하지 않습니다.', 'error'); }
    if (!res.ok) { setLoading(false); return toast('변경 실패', 'error'); }
    const data = await res.json();
    setMaintenance(data.active);
    setLoading(false);
    toast(next ? '⚙️ 점검 모드 활성화됨' : '✅ 점검 모드 해제됨');
  }

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

  // === 벌금 계산: 부족한 문제 1개당 1,000원 (하루 1문제 = 1,000원) ===
  // === 크레딧 보너스: 하루 2문제 이상을 연속 2일 이상 풀면 day-2부터 +1 크레딧 ===
  // === 1크레딧 = 부족 문제 1개 면제 (= 1,000원 절감) ===
  const FINE_PER_PROBLEM = 1000;
  const PERIOD_DAYS = 2;
  const REQUIRED_PROBLEMS = 2;
  const REQUIRED_DAILY_FOR_CREDIT = 2; // 하루 2문제 이상이면 streak 유효
  const BET_START_DATE = '2026-05-01'; // 내기 시작일

  // 멤버별 일별 풀이 수
  function getDailyByMember(memberId: string): Record<string, number> {
    const result: Record<string, number> = {};
    submissions.forEach(s => {
      if (s.member === memberId) result[s.date] = (result[s.date] || 0) + 1;
    });
    return result;
  }

  // 멤버별 누적 크레딧 (BET_START_DATE부터 todayDate까지)
  function calculateCredits(memberId: string, todayDate: Date): number {
    const startDate = new Date(BET_START_DATE);
    if (todayDate < startDate) return 0;
    const dailyCounts = getDailyByMember(memberId);
    let streak = 0;
    let credits = 0;
    const cur = new Date(startDate);
    while (cur <= todayDate) {
      const dateStr = cur.toISOString().slice(0, 10);
      const cnt = dailyCounts[dateStr] || 0;
      if (cnt >= REQUIRED_DAILY_FOR_CREDIT) {
        streak++;
        if (streak >= 2) credits++;
      } else {
        streak = 0;
      }
      cur.setDate(cur.getDate() + 1);
    }
    return credits;
  }

  function calculateFines() {
    const startDate = new Date(BET_START_DATE);
    const todayDate = new Date(today.toISOString().slice(0, 10));

    // 시작일이 아직 안 됐으면 빈 결과
    if (todayDate < startDate) {
      return {
        byMember: {} as Record<string, number>,
        total: 0,
        periods: [] as Array<{start: string, end: string, missed: Array<{member: string, count: number, fineAfterCredits: number, usedCredits: number}>}>,
        creditsByMember: {} as Record<string, { earned: number, used: number, remaining: number }>,
      };
    }

    // 1단계: 각 버킷마다 부족 문제 수집 (멤버별, 시간순)
    const bucketsByMember: Record<string, Array<{ start: string, end: string, count: number, missing: number }>> = {};
    members.forEach(m => { bucketsByMember[m.id] = []; });

    const cur = new Date(startDate);
    while (cur <= todayDate) {
      const periodStart = new Date(cur);
      const periodEnd = new Date(cur);
      periodEnd.setDate(periodEnd.getDate() + PERIOD_DAYS - 1);
      if (periodEnd > todayDate) break;

      const startStr = periodStart.toISOString().slice(0, 10);
      const endStr = periodEnd.toISOString().slice(0, 10);

      members.forEach(m => {
        const count = submissions.filter(s =>
          s.member === m.id && s.date >= startStr && s.date <= endStr
        ).length;
        const missing = Math.max(0, REQUIRED_PROBLEMS - count);
        bucketsByMember[m.id].push({ start: startStr, end: endStr, count, missing });
      });

      cur.setDate(cur.getDate() + PERIOD_DAYS);
    }

    // 2단계: 멤버별 크레딧 계산 + 시간순으로 부족 문제에 적용
    const byMember: Record<string, number> = {};
    const creditsByMember: Record<string, { earned: number, used: number, remaining: number }> = {};
    const periodsMap: Record<string, Array<{ member: string, count: number, fineAfterCredits: number, usedCredits: number }>> = {};

    members.forEach(mem => {
      const earned = calculateCredits(mem.id, todayDate);
      let available = earned;
      let totalFine = 0;
      let totalUsed = 0;

      bucketsByMember[mem.id].forEach(b => {
        if (b.missing > 0) {
          const useHere = Math.min(b.missing, available);
          available -= useHere;
          totalUsed += useHere;
          const remainingMissing = b.missing - useHere;
          const fineHere = remainingMissing * FINE_PER_PROBLEM;
          totalFine += fineHere;

          const key = `${b.start}~${b.end}`;
          if (!periodsMap[key]) periodsMap[key] = [];
          periodsMap[key].push({ member: mem.id, count: b.count, fineAfterCredits: fineHere, usedCredits: useHere });
        }
      });

      byMember[mem.id] = totalFine;
      creditsByMember[mem.id] = { earned, used: totalUsed, remaining: earned - totalUsed };
    });

    // periods 배열로 변환
    const periods = Object.entries(periodsMap).map(([key, missed]) => {
      const [start, end] = key.split('~');
      return { start, end, missed };
    }).sort((a, b) => a.start.localeCompare(b.start));

    const total = Object.values(byMember).reduce((a, b) => a + b, 0);
    return { byMember, total, periods, creditsByMember };
  }

  const fines = calculateFines();

  // === 월별 벌금 정산 (크레딧 반영): { memberId: { 'YYYY-MM': fine } } ===
  function calculateFinesByMonth() {
    const startDate = new Date(BET_START_DATE);
    const todayDate = new Date(today.toISOString().slice(0, 10));
    const result: Record<string, Record<string, number>> = {};
    members.forEach(mem => { result[mem.id] = {}; });
    if (todayDate < startDate) return result;

    // 각 멤버별 시간순 버킷 처리 + 크레딧 적용
    members.forEach(mem => {
      let available = calculateCredits(mem.id, todayDate);
      const cur = new Date(startDate);
      while (cur <= todayDate) {
        const periodStart = new Date(cur);
        const periodEnd = new Date(cur);
        periodEnd.setDate(periodEnd.getDate() + PERIOD_DAYS - 1);
        if (periodEnd > todayDate) break;

        const startStr = periodStart.toISOString().slice(0, 10);
        const endStr = periodEnd.toISOString().slice(0, 10);
        const monthKey = startStr.slice(0, 7);

        const count = submissions.filter(s =>
          s.member === mem.id && s.date >= startStr && s.date <= endStr
        ).length;
        const missing = Math.max(0, REQUIRED_PROBLEMS - count);
        if (missing > 0) {
          const useHere = Math.min(missing, available);
          available -= useHere;
          const remainingMissing = missing - useHere;
          if (remainingMissing > 0) {
            result[mem.id][monthKey] = (result[mem.id][monthKey] || 0) + remainingMissing * FINE_PER_PROBLEM;
          }
        }

        cur.setDate(cur.getDate() + PERIOD_DAYS);
      }
    });
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

      {/* 점검 중 배너 */}
      {maintenance && (
        <div className="bg-yellow-500/15 border border-yellow-500/40 rounded-lg p-3 mb-4 flex items-center gap-2 text-sm">
          <span className="text-yellow-400 font-bold">⚙️ 점검 모드 활성화됨</span>
          <span className="text-[#8b949e]">— 운영자가 업데이트 중입니다. 문제 제출이 일시 중단됩니다.</span>
        </div>
      )}

      {/* 상단 액션 버튼 */}
      <div className="flex justify-end gap-2 mb-4">
        <button
          onClick={toggleMaintenance}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
            maintenance
              ? 'bg-yellow-500/20 hover:bg-yellow-500/30 border-yellow-500/50 text-yellow-300'
              : 'bg-[#21262d] hover:bg-[#30363d] border-[#30363d] text-[#8b949e] hover:text-white'
          }`}
          title={maintenance ? '점검 해제 (관리자 비밀번호 필요)' : '점검 모드 활성화 (관리자 비밀번호 필요)'}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0a1 1 0 00-1 1v1.07A6.002 6.002 0 002.07 7H1a1 1 0 100 2h1.07A6.002 6.002 0 007 13.93V15a1 1 0 102 0v-1.07A6.002 6.002 0 0013.93 9H15a1 1 0 100-2h-1.07A6.002 6.002 0 009 2.07V1a1 1 0 00-1-1zM4 8a4 4 0 118 0 4 4 0 01-8 0z"/></svg>
          <span>{maintenance ? '점검 해제' : '점검 모드'}</span>
        </button>
        <button
          onClick={() => setShowHelp(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] rounded-lg text-sm text-[#8b949e] hover:text-white transition-colors cursor-pointer"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0a8 8 0 100 16A8 8 0 008 0zM7.25 11.5a.75.75 0 111.5 0 .75.75 0 01-1.5 0zm.5-7.5C6.34 4 5.5 4.79 5.5 5.83a.75.75 0 001.5 0c0-.27.32-.58.75-.58.43 0 .75.31.75.58 0 .31-.16.53-.5.78l-.31.21c-.45.32-.94.78-.94 1.43v.5a.75.75 0 001.5 0V8.5c0-.06.04-.18.5-.5l.27-.18c.43-.3.98-.74.98-1.49C9.75 4.79 8.91 4 7.75 4z"/></svg>
          <span>도움말</span>
        </button>
      </div>

      {/* 도움말 모달 */}
      {showHelp && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[1500] p-4 overflow-y-auto" onClick={e => { if (e.target === e.currentTarget) setShowHelp(false); }}>
          <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-6 w-full max-w-[600px] my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-[#30363d]">
              <h3 className="text-xl font-bold flex items-center gap-2">📘 도움말</h3>
              <button onClick={() => setShowHelp(false)} className="text-[#8b949e] hover:text-white text-2xl cursor-pointer leading-none">×</button>
            </div>

            <div className="space-y-5 text-sm">
              {/* 서비스 소개 */}
              <section>
                <h4 className="text-base font-semibold text-[#58a6ff] mb-2">🧑‍💻 서비스 소개</h4>
                <p className="text-[#e6edf3] leading-relaxed">
                  팀원들과 함께 프로그래머스 코딩테스트 문제를 풀고, 진행 상황을 공유하는 대시보드입니다.
                  Lv.0 ~ Lv.5 총 689문제를 등록해두었으며, 풀이 코드와 스크린샷을 제출하면 GitHub에 자동으로 백업됩니다.
                </p>
              </section>

              {/* 사용법 */}
              <section>
                <h4 className="text-base font-semibold text-[#58a6ff] mb-2">📝 사용법</h4>
                <ul className="space-y-1.5 text-[#e6edf3] list-disc list-inside leading-relaxed">
                  <li><b>풀이 제출</b>: 멤버 카드 클릭 → 문제 선택 → 코드 입력 → 업로드</li>
                  <li><b>이미지 첨부</b>: 클릭, 드래그, Ctrl+V로 스크린샷 추가 가능</li>
                  <li><b>멤버 추가</b>: 대시보드의 <b>+</b> 카드 클릭 → 아이디/이름/색상 입력</li>
                  <li><b>멤버 삭제</b>: 카드 우측 상단 휴지통 아이콘 클릭 (관리자 비밀번호 필요)</li>
                  <li><b>제출 기록 삭제</b>: 멤버 페이지에서 각 항목의 삭제 버튼</li>
                </ul>
              </section>

              {/* 벌금 규칙 */}
              <section className="bg-red-500/5 border border-red-500/30 rounded-lg p-4">
                <h4 className="text-base font-semibold text-red-400 mb-2">💰 벌금 규칙</h4>
                <div className="space-y-2 text-[#e6edf3] leading-relaxed">
                  <p><b>시작일</b>: 2026-05-01부터 적용</p>
                  <p><b>규칙</b>: 매 2일마다 합산 <b>2문제</b>가 목표 (하루 1문제 페이스)</p>
                  <p><b>벌금</b>: 부족한 문제 <b>1개당 1,000원</b> (= 하루 안 풀면 1,000원)</p>
                  <div className="bg-[#0d1117] rounded p-3 mt-2 text-xs">
                    <div className="font-semibold mb-1.5 text-[#8b949e]">예시 (2일 단위 평가)</div>
                    <div className="space-y-0.5 font-mono">
                      <div className="text-[#7ee787]">✓ 1일 1 + 2일 1 = 2문제 → 0원</div>
                      <div className="text-[#7ee787]">✓ 1일 0 + 2일 2 = 2문제 → 0원</div>
                      <div className="text-[#7ee787]">✓ 1일 2 + 2일 0 = 2문제 → 0원</div>
                      <div className="text-yellow-300">△ 1일 0 + 2일 1 = 1문제 → <b>1,000원</b> (1개 부족)</div>
                      <div className="text-red-400">✗ 1일 0 + 2일 0 = 0문제 → <b>2,000원</b> (2개 부족)</div>
                    </div>
                  </div>
                  <p className="text-xs text-[#8b949e] mt-2">⚠️ 각 2일 버킷은 독립적으로 평가됩니다.</p>
                </div>
              </section>

              {/* 연속 풀이 보너스 */}
              <section className="bg-yellow-500/5 border border-yellow-500/30 rounded-lg p-4">
                <h4 className="text-base font-semibold text-yellow-400 mb-2">⭐ 연속 풀이 보너스 (크레딧)</h4>
                <div className="space-y-2 text-[#e6edf3] leading-relaxed">
                  <p><b>획득 조건</b>: 하루 <b>2문제 이상</b>을 <b>연속 2일 이상</b> 풀이 시</p>
                  <p><b>적립</b>: 연속 2일째부터 매일 <b>+1 크레딧</b></p>
                  <p><b>사용</b>: 부족한 문제 1개당 <b>1 크레딧</b>으로 자동 면제 (= 1,000원 절감)</p>
                  <div className="bg-[#0d1117] rounded p-3 mt-2 text-xs">
                    <div className="font-semibold mb-1.5 text-[#8b949e]">예시</div>
                    <div className="space-y-0.5 font-mono">
                      <div>5/1: 2문제 → streak 1 (크레딧 0)</div>
                      <div>5/2: 2문제 → streak 2 → <span className="text-yellow-300">+1 ⭐</span></div>
                      <div>5/3: 2문제 → streak 3 → <span className="text-yellow-300">+1 ⭐</span></div>
                      <div>5/4: 0문제 → streak 끊김 (크레딧 2개 보유)</div>
                      <div>5/5~6 버킷: 0+0=0 (2부족) → <span className="text-yellow-300">⭐2 사용</span> → <span className="text-[#7ee787]">0원 ✓</span></div>
                    </div>
                  </div>
                  <p className="text-xs text-[#8b949e] mt-2">💡 미리 많이 풀어두면 휴식일을 만들 수 있습니다.</p>
                </div>
              </section>

              {/* 캘린더 색상 */}
              <section>
                <h4 className="text-base font-semibold text-[#58a6ff] mb-2">🎨 캘린더 색상 의미</h4>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                  <div className="bg-[#0d1117] border border-[#21262d] rounded p-2 text-center">
                    <div className="text-[#8b949e]">0문제</div>
                  </div>
                  <div className="bg-green-500/10 border border-[#21262d] rounded p-2 text-center">
                    <div>1문제</div>
                  </div>
                  <div className="bg-green-500/20 border border-[#21262d] rounded p-2 text-center">
                    <div>2-4문제</div>
                  </div>
                  <div className="bg-green-500/30 border border-[#21262d] rounded p-2 text-center">
                    <div>5-9문제</div>
                  </div>
                  <div className="bg-green-500/40 border border-[#21262d] rounded p-2 text-center">
                    <div>10+문제</div>
                  </div>
                </div>
              </section>

              {/* 점검 모드 */}
              <section>
                <h4 className="text-base font-semibold text-[#58a6ff] mb-2">⚙️ 점검 모드 (운영자 전용)</h4>
                <p className="text-[#e6edf3] leading-relaxed mb-2">
                  운영자가 데이터를 업데이트하는 동안 사용자의 동시 제출을 막아 데이터 충돌을 방지하는 기능입니다.
                </p>
                <ul className="space-y-1 text-[#e6edf3] list-disc list-inside text-xs">
                  <li>대시보드 우측 상단 <b>점검 모드</b> 버튼 → 비밀번호 입력 → 활성화</li>
                  <li>활성화 중에는 모든 멤버의 제출이 차단되고 노란 배너가 표시됨</li>
                  <li>업데이트 완료 후 같은 버튼으로 해제 (비밀번호 필요)</li>
                </ul>
              </section>

              {/* 백업 */}
              <section>
                <h4 className="text-base font-semibold text-[#58a6ff] mb-2">💾 자동 백업</h4>
                <p className="text-[#e6edf3] leading-relaxed">
                  모든 풀이는 GitHub의 <code className="bg-[#0d1117] px-1.5 py-0.5 rounded text-xs">backups/{`{멤버ID}`}/</code> 폴더에 자동 커밋됩니다.
                  코드는 <code className="bg-[#0d1117] px-1.5 py-0.5 rounded text-xs">submissions.json</code>에, 이미지는 <code className="bg-[#0d1117] px-1.5 py-0.5 rounded text-xs">{`{문제ID}_{날짜}.png`}</code> 파일로 저장됩니다.
                </p>
              </section>
            </div>

            <div className="mt-5 pt-4 border-t border-[#30363d] flex justify-end">
              <button onClick={() => setShowHelp(false)} className="px-5 py-2 bg-[#238636] hover:bg-[#2ea043] rounded-lg text-sm font-semibold text-white cursor-pointer">
                확인
              </button>
            </div>
          </div>
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

                    // 2일 버킷 그룹 표시 (BET_START_DATE 이후만)
                    const cellDate = new Date(dateStr);
                    const betStart = new Date(BET_START_DATE);
                    let bucketIdx = -1;
                    let posInBucket = -1; // 0: 첫째날, 1: 둘째날
                    if (cellDate >= betStart) {
                      const dayDiff = Math.floor((cellDate.getTime() - betStart.getTime()) / (24 * 60 * 60 * 1000));
                      bucketIdx = Math.floor(dayDiff / PERIOD_DAYS);
                      posInBucket = dayDiff % PERIOD_DAYS;
                    }
                    // 버킷 시각화 클래스 (짝/홀로 살짝 다르게)
                    const bucketBgTint = bucketIdx >= 0
                      ? (bucketIdx % 2 === 0 ? 'border-l-2 border-l-blue-400/50' : 'border-l-2 border-l-purple-400/50')
                      : '';
                    const bucketRightTint = bucketIdx >= 0 && posInBucket === 1
                      ? (bucketIdx % 2 === 0 ? 'border-r-2 border-r-blue-400/50' : 'border-r-2 border-r-purple-400/50')
                      : '';

                    return (
                      <div key={dow} className={`min-h-[100px] border rounded-lg p-2 flex flex-col transition-all ${isToday ? 'border-[#58a6ff] ring-1 ring-[#58a6ff]/40' : 'border-[#21262d] hover:border-[#30363d]'} ${bucketBgTint} ${bucketRightTint} ${isFuture ? 'opacity-30' : ''} ${bgColors[intensity]}`} title={`${dateStr} - ${totalCount}문제${bucketIdx >= 0 ? ` · 버킷 ${bucketIdx + 1} (${posInBucket + 1}/2)` : ''}`}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className={`text-xs font-bold ${isToday ? 'text-[#58a6ff]' : isWeekend ? 'text-red-400' : 'text-[#e6edf3]'}`}>{day}</span>
                          <div className="flex items-center gap-1">
                            {bucketIdx >= 0 && (
                              <span className={`text-[9px] font-bold px-1 rounded ${bucketIdx % 2 === 0 ? 'bg-blue-400/20 text-blue-300' : 'bg-purple-400/20 text-purple-300'}`} title={`버킷 ${bucketIdx + 1} - ${posInBucket + 1}일째`}>
                                {posInBucket === 0 ? '①' : '②'}
                              </span>
                            )}
                            {totalCount > 0 && (
                              <span className="text-[10px] text-[#8b949e] font-semibold">{totalCount}</span>
                            )}
                          </div>
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
                            벌금 {memberMonthFine.toLocaleString()}원 ({memberMonthFine / FINE_PER_PROBLEM}문제 부족)
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
            <p className="text-xs text-[#8b949e] mt-1">규칙: 하루 1문제 (2일 합산 2문제 목표). 부족분 1개당 1,000원. 시작: 2026-05-01</p>
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
            const missingProblems = Math.floor(fine / FINE_PER_PROBLEM);
            const credits = fines.creditsByMember[member.id] || { earned: 0, used: 0, remaining: 0 };
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
                  {missingProblems > 0 && (
                    <div className="text-[11px] text-[#8b949e]">총 {missingProblems}문제 부족</div>
                  )}
                  {credits.earned > 0 && (
                    <div className="text-[11px] text-yellow-400 font-semibold mt-0.5" title="연속 풀이 보너스">
                      ⭐ 크레딧 {credits.remaining}개 (획득 {credits.earned} · 사용 {credits.used})
                    </div>
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
                      const fineDisplay = m.fineAfterCredits > 0 ? `-${(m.fineAfterCredits/1000).toFixed(0)}K` : '면제';
                      const tooltip = `${m.count}문제 풀이${m.usedCredits > 0 ? ` · 크레딧 ${m.usedCredits}개 사용` : ''} · 벌금 ${m.fineAfterCredits.toLocaleString()}원`;
                      return (
                        <span key={m.member} className={`px-1.5 py-0.5 rounded text-[10px] font-bold text-white ${m.fineAfterCredits === 0 ? 'opacity-60' : ''}`} style={{ background: member?.color || '#8b949e' }} title={tooltip}>
                          {member?.name[0] || m.member[0]} {m.count}/2 {m.usedCredits > 0 && <span className="text-yellow-200">⭐{m.usedCredits}</span>} {fineDisplay}
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
