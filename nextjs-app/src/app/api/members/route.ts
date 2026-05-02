import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { getMembers, addMember, removeMember } from '@/lib/kv';
import { backupMemberData, deleteMemberBackup } from '@/lib/github';

// SHA-256 해시 (원본 비밀번호는 저장소에 노출되지 않음)
const ADMIN_PASSWORD_HASH = '20c2624df470adfa41004928c0713817635b1df0ff1e986299f498a8e59a509d';

function verifyPassword(password: string): boolean {
  if (!password) return false;
  const hash = createHash('sha256').update(password).digest('hex');
  return hash === ADMIN_PASSWORD_HASH;
}

// GET /api/members - 전체 멤버 조회
export async function GET() {
  const members = await getMembers();
  return NextResponse.json(members);
}

// POST /api/members - 멤버 추가
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { id, name, color } = body;

  if (!id || !/^[a-zA-Z0-9_]+$/.test(id)) {
    return NextResponse.json({ error: '유효하지 않은 아이디' }, { status: 400 });
  }

  const existing = await getMembers();
  if (existing.some(m => m.id === id)) {
    return NextResponse.json({ error: '이미 존재하는 아이디' }, { status: 409 });
  }

  const members = await addMember({ id, name: name || id.toUpperCase(), color: color || '#7ee787' });

  // GitHub 백업 커밋
  try {
    await backupMemberData(id, { member: { id, name, color }, submissions: [] });
  } catch (e) {
    console.warn('GitHub 백업 실패:', e);
  }

  return NextResponse.json(members, { status: 201 });
}

// DELETE /api/members?id=xxx - 멤버 삭제 (관리자 비밀번호 필요)
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id 필요' }, { status: 400 });

  // 비밀번호 검증
  const password = req.headers.get('x-admin-password') || '';
  if (!verifyPassword(password)) {
    return NextResponse.json({ error: '비밀번호가 일치하지 않습니다' }, { status: 401 });
  }

  const members = await removeMember(id);

  // GitHub 백업 삭제 커밋
  try {
    await deleteMemberBackup(id);
  } catch (e) {
    console.warn('GitHub 백업 삭제 실패:', e);
  }

  return NextResponse.json(members);
}
