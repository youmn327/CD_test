import { getMembers, getSubmissions, getMaintenanceMode } from '@/lib/kv';
import { PROBLEMS } from '@/lib/problems';
import Dashboard from '@/components/Dashboard';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const members = await getMembers();
  const submissions = await getSubmissions();
  const maintenance = await getMaintenanceMode();

  return (
    <main className="max-w-[960px] mx-auto px-4 py-6">
      <div className="text-center mb-8 pb-6 border-b border-[#30363d]">
        <h1 className="text-3xl font-bold mb-2">🧑‍💻 코딩테스트 챌린지</h1>
        <p className="text-[#8b949e] text-sm mb-1">프로그래머스 Lv.0 ~ Lv.5 · 총 {PROBLEMS.length}문제</p>
        <p className="text-[#484f58] text-xs mb-3">함께 풀고, 매일 성장하는 멤버 풀이 현황 대시보드</p>
        <a
          href="https://github.com/youmn327/CD_test"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-[#8b949e] hover:text-[#58a6ff] transition-colors"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
          github.com/youmn327/CD_test
        </a>
      </div>
      <Dashboard
        initialMembers={members}
        initialSubmissions={submissions}
        problems={PROBLEMS}
        initialMaintenance={maintenance}
      />
    </main>
  );
}
