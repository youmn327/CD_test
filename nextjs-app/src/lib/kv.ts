import { Redis } from '@upstash/redis';
import type { Member, Submission } from './types';

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

const MEMBERS_KEY = 'members';
const SUBMISSIONS_KEY = 'submissions';

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
