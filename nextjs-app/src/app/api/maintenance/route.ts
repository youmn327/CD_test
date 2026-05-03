import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { getMaintenanceMode, setMaintenanceMode } from '@/lib/kv';

const ADMIN_PASSWORD_HASH = '20c2624df470adfa41004928c0713817635b1df0ff1e986299f498a8e59a509d';

function verifyPassword(password: string): boolean {
  if (!password) return false;
  const hash = createHash('sha256').update(password).digest('hex');
  return hash === ADMIN_PASSWORD_HASH;
}

// GET /api/maintenance - 점검 모드 상태 조회
export async function GET() {
  const active = await getMaintenanceMode();
  return NextResponse.json({ active });
}

// POST /api/maintenance - 점검 모드 토글 (관리자 비밀번호 필요)
export async function POST(req: NextRequest) {
  const password = req.headers.get('x-admin-password') || '';
  if (!verifyPassword(password)) {
    return NextResponse.json({ error: '비밀번호가 일치하지 않습니다' }, { status: 401 });
  }

  const body = await req.json();
  const enabled = !!body.active;
  await setMaintenanceMode(enabled);
  return NextResponse.json({ active: enabled });
}
