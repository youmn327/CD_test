import { getMembers, getSubmissionsByMember } from '@/lib/kv';
import { PROBLEMS } from '@/lib/problems';
import { notFound } from 'next/navigation';
import MemberPage from '@/components/MemberPage';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ memberId: string }>;
}

export default async function Page({ params }: Props) {
  const { memberId } = await params;
  const members = await getMembers();
  const member = members.find(m => m.id === memberId);

  if (!member) notFound();

  const submissions = await getSubmissionsByMember(memberId);

  return (
    <main className="max-w-[960px] mx-auto px-4 py-6">
      <MemberPage member={member} initialSubmissions={submissions} problems={PROBLEMS} />
    </main>
  );
}
