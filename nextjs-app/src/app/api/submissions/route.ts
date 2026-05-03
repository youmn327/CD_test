import { NextRequest, NextResponse } from 'next/server';
import { getSubmissions, getSubmissionsByMember, addSubmission, removeSubmission, getMaintenanceMode } from '@/lib/kv';
import { backupMemberData } from '@/lib/github';
import { getMembers } from '@/lib/kv';

// GET /api/submissions?member=jjw
export async function GET(req: NextRequest) {
  const memberId = req.nextUrl.searchParams.get('member');
  if (memberId) {
    return NextResponse.json(await getSubmissionsByMember(memberId));
  }
  return NextResponse.json(await getSubmissions());
}

// POST /api/submissions - 제출 추가
export async function POST(req: NextRequest) {
  // 점검 모드 체크
  if (await getMaintenanceMode()) {
    return NextResponse.json({ error: '운영자가 업데이트 중입니다. 잠시 후 다시 시도해주세요.' }, { status: 503 });
  }

  const body = await req.json();
  const { member, problemId, problemName, code, date, image } = body;

  if (!member || !problemId || !code || !date) {
    return NextResponse.json({ error: '필수 항목 누락' }, { status: 400 });
  }

  const entry = await addSubmission({ member, problemId, problemName, code, date, image: image || null });

  // GitHub 백업 커밋
  try {
    const members = await getMembers();
    const memberInfo = members.find(m => m.id === member);
    const subs = await getSubmissionsByMember(member);
    await backupMemberData(member, { member: memberInfo || { id: member }, submissions: subs });
  } catch (e) {
    console.warn('GitHub 백업 실패:', e);
  }

  return NextResponse.json(entry, { status: 201 });
}

// DELETE /api/submissions?timestamp=xxx
export async function DELETE(req: NextRequest) {
  const timestamp = req.nextUrl.searchParams.get('timestamp');
  const memberId = req.nextUrl.searchParams.get('member');
  if (!timestamp) return NextResponse.json({ error: 'timestamp 필요' }, { status: 400 });

  await removeSubmission(timestamp);

  // GitHub 백업 업데이트
  if (memberId) {
    try {
      const members = await getMembers();
      const memberInfo = members.find(m => m.id === memberId);
      const subs = await getSubmissionsByMember(memberId);
      await backupMemberData(memberId, { member: memberInfo || { id: memberId }, submissions: subs });
    } catch (e) {
      console.warn('GitHub 백업 실패:', e);
    }
  }

  return NextResponse.json({ ok: true });
}
