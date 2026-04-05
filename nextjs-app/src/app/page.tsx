import { getMembers, getSubmissions } from '@/lib/kv';
import { PROBLEMS } from '@/lib/problems';
import Dashboard from '@/components/Dashboard';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const members = await getMembers();
  const submissions = await getSubmissions();

  return (
    <main className="max-w-[960px] mx-auto px-4 py-6">
      <div className="text-center mb-8 pb-6 border-b border-[#30363d]">
        <h1 className="text-3xl font-bold mb-2">Coding Test Dashboard</h1>
        <p className="text-[#8b949e] text-sm">프로그래머스 Lv.0 - 풀이 현황</p>
      </div>
      <Dashboard
        initialMembers={members}
        initialSubmissions={submissions}
        problems={PROBLEMS}
      />
    </main>
  );
}
