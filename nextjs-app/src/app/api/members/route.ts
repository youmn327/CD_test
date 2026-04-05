import { NextRequest, NextResponse } from 'next/server';
import { getMembers, addMember, removeMember } from '@/lib/kv';
import { backupMemberData, deleteMemberBackup } from '@/lib/github';

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

// DELETE /api/members?id=xxx - 멤버 삭제
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id 필요' }, { status: 400 });

  const members = await removeMember(id);

  // GitHub 백업 삭제 커밋
  try {
    await deleteMemberBackup(id);
  } catch (e) {
    console.warn('GitHub 백업 삭제 실패:', e);
  }

  return NextResponse.json(members);
}
