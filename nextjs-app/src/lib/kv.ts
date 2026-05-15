import { Redis } from '@upstash/redis';
import type { Member, Submission } from './types';
import idMigration from './id_migration.json';

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

const MEMBERS_KEY = 'members';
const SUBMISSIONS_KEY = 'submissions';
const MIGRATION_KEY = 'id_migration_v1_done';
const MAINTENANCE_KEY = 'maintenance_mode';
const BET_STATE_KEY = 'bet_state_v1';

// === Maintenance mode ===
export async function getMaintenanceMode(): Promise<boolean> {
  return (await redis.get<boolean>(MAINTENANCE_KEY)) || false;
}

export async function setMaintenanceMode(enabled: boolean): Promise<void> {
  await redis.set(MAINTENANCE_KEY, enabled);
}

// === Bet pause state ===
export type PausedRange = { start: string; end: string | null };
export type BetState = { pausedRanges: PausedRange[]; sessionStart: string };

const DEFAULT_BET_STATE: BetState = { pausedRanges: [], sessionStart: '2026-05-01' };

export async function getBetState(): Promise<BetState> {
  const state = await redis.get<BetState>(BET_STATE_KEY);
  return state || DEFAULT_BET_STATE;
}

export async function setBetState(state: BetState): Promise<void> {
  await redis.set(BET_STATE_KEY, state);
}

export async function pauseBet(today: string): Promise<BetState> {
  const state = await getBetState();
  // 이미 일시정지 중이면 무시
  const last = state.pausedRanges[state.pausedRanges.length - 1];
  if (last && last.end === null) return state;
  state.pausedRanges.push({ start: today, end: null });
  await setBetState(state);
  return state;
}

export async function resumeBet(today: string): Promise<BetState> {
  const state = await getBetState();
  const last = state.pausedRanges[state.pausedRanges.length - 1];
  if (!last || last.end !== null) return state; // 일시정지 중이 아니면 무시
  // 어제 날짜로 끝 설정
  const d = new Date(today);
  d.setDate(d.getDate() - 1);
  last.end = d.toISOString().slice(0, 10);
  // 세션 재시작
  state.sessionStart = today;
  await setBetState(state);
  return state;
}

// 기존 problemId를 새 lesson_id 기반 ID로 마이그레이션
const ID_MAP: Record<string, string> = idMigration as Record<string, string>;

async function runMigrationIfNeeded(): Promise<void> {
  const done = await redis.get<boolean>(MIGRATION_KEY);
  if (done) return;
  const all = (await redis.get<Submission[]>(SUBMISSIONS_KEY)) || [];
  let changed = false;
  const migrated = all.map(s => {
    const newId = ID_MAP[s.problemId];
    if (newId && newId !== s.problemId) {
      changed = true;
      return { ...s, problemId: newId };
    }
    return s;
  });
  if (changed) {
    await redis.set(SUBMISSIONS_KEY, migrated);
  }
  await redis.set(MIGRATION_KEY, true);
}

// === Members ===
export async function getMembers(): Promise<Member[]> {
  const members = await redis.get<Member[]>(MEMBERS_KEY);
  return members || [
    { id: 'jjw', name: 'JJW', color: '#58a6ff' },
    { id: 'nym', name: 'NYM', color: '#f78166' },
  ];
}

export async function addMember(member: Member): Promise<Member[]> {
  const members = await getMembers();
  members.push(member);
  await redis.set(MEMBERS_KEY, members);
  return members;
}

export async function removeMember(id: string): Promise<Member[]> {
  const members = (await getMembers()).filter(m => m.id !== id);
  await redis.set(MEMBERS_KEY, members);
  const subs = (await getSubmissions()).filter(s => s.member !== id);
  await redis.set(SUBMISSIONS_KEY, subs);
  return members;
}

// === Submissions ===
export async function getSubmissions(): Promise<Submission[]> {
  await runMigrationIfNeeded();
  return (await redis.get<Submission[]>(SUBMISSIONS_KEY)) || [];
}

export async function getSubmissionsByMember(memberId: string): Promise<Submission[]> {
  const all = await getSubmissions();
  return all.filter(s => s.member === memberId);
}

export async function addSubmission(sub: Omit<Submission, 'timestamp'>): Promise<Submission> {
  const all = await getSubmissions();
  const entry: Submission = {
    ...sub,
    timestamp: String(Date.now()) + String(Math.random()).slice(2, 6),
  };
  all.push(entry);
  await redis.set(SUBMISSIONS_KEY, all);
  return entry;
}

export async function removeSubmission(timestamp: string): Promise<void> {
  const all = (await getSubmissions()).filter(s => s.timestamp !== timestamp);
  await redis.set(SUBMISSIONS_KEY, all);
}
