import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { getBetState, pauseBet, resumeBet } from '@/lib/kv';

const ADMIN_PASSWORD_HASH = '20c2624df470adfa41004928c0713817635b1df0ff1e986299f498a8e59a509d';

function verifyPassword(password: string): boolean {
  if (!password) return false;
  const hash = createHash('sha256').update(password).digest('hex');
  return hash === ADMIN_PASSWORD_HASH;
}

function todayKR(): string {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export async function GET() {
  const state = await getBetState();
  const last = state.pausedRanges[state.pausedRanges.length - 1];
  const isPaused = !!(last && last.end === null);
  return NextResponse.json({ ...state, isPaused });
}

export async function POST(req: NextRequest) {
  const password = req.headers.get('x-admin-password') || '';
  if (!verifyPassword(password)) {
    return NextResponse.json({ error: '비밀번호가 일치하지 않습니다' }, { status: 401 });
  }
  const body = await req.json();
  const action = body.action;
  const today = todayKR();

  let state;
  if (action === 'pause') state = await pauseBet(today);
  else if (action === 'resume') state = await resumeBet(today);
  else return NextResponse.json({ error: '잘못된 action' }, { status: 400 });

  const last = state.pausedRanges[state.pausedRanges.length - 1];
  return NextResponse.json({ ...state, isPaused: !!(last && last.end === null) });
}
