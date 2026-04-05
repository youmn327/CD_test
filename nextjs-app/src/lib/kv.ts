import { kv } from '@vercel/kv';
import type { Member, Submission } from './types';

const MEMBERS_KEY = 'members';
const SUBMISSIONS_KEY = 'submissions';

// === Members ===
export async function getMembers(): Promise<Member[]> {
  const members = await kv.get<Member[]>(MEMBERS_KEY);
  return members || [
    { id: 'jjw', name: 'JJW', color: '#58a6ff' },
    { id: 'nym', name: 'NYM', color: '#f78166' },
  ];
}

export async function addMember(member: Member): Promise<Member[]> {
  const members = await getMembers();
  members.push(member);
  await kv.set(MEMBERS_KEY, members);
  return members;
}

export async function removeMember(id: string): Promise<Member[]> {
  const members = (await getMembers()).filter(m => m.id !== id);
  await kv.set(MEMBERS_KEY, members);
  // 해당 멤버 제출 데이터도 삭제
  const subs = (await getSubmissions()).filter(s => s.member !== id);
  await kv.set(SUBMISSIONS_KEY, subs);
  return members;
}

// === Submissions ===
export async function getSubmissions(): Promise<Submission[]> {
  return (await kv.get<Submission[]>(SUBMISSIONS_KEY)) || [];
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
  await kv.set(SUBMISSIONS_KEY, all);
  return entry;
}

export async function removeSubmission(timestamp: string): Promise<void> {
  const all = (await getSubmissions()).filter(s => s.timestamp !== timestamp);
  await kv.set(SUBMISSIONS_KEY, all);
}
