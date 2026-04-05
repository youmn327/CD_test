const GITHUB_TOKEN = process.env.GITHUB_TOKEN!;
const REPO_OWNER = process.env.GITHUB_OWNER || 'youmn327';
const REPO_NAME = process.env.GITHUB_REPO || 'CD_test';
const BRANCH = process.env.GITHUB_BRANCH || 'main';

async function githubApi(path: string, options: RequestInit = {}) {
  const res = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!res.ok && res.status !== 404) {
    const text = await res.text();
    throw new Error(`GitHub API error ${res.status}: ${text}`);
  }
  return res;
}

// 파일의 현재 SHA 가져오기 (업데이트/삭제 시 필요)
async function getFileSha(path: string): Promise<string | null> {
  const res = await githubApi(`/contents/${path}?ref=${BRANCH}`);
  if (res.status === 404) return null;
  const data = await res.json();
  return data.sha;
}

// 파일 생성 또는 업데이트
export async function commitFile(path: string, content: string, message: string) {
  const sha = await getFileSha(path);
  const body: Record<string, string> = {
    message,
    content: Buffer.from(content).toString('base64'),
    branch: BRANCH,
  };
  if (sha) body.sha = sha;

  await githubApi(`/contents/${path}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

// 파일 삭제
export async function deleteFile(path: string, message: string) {
  const sha = await getFileSha(path);
  if (!sha) return; // 파일이 없으면 무시

  await githubApi(`/contents/${path}`, {
    method: 'DELETE',
    body: JSON.stringify({
      message,
      sha,
      branch: BRANCH,
    }),
  });
}

// 멤버 백업 JSON 커밋
export async function backupMemberData(memberId: string, data: object) {
  const content = JSON.stringify(data, null, 2);
  await commitFile(
    `backups/${memberId}.json`,
    content,
    `backup: ${memberId} 데이터 업데이트`
  );
}

// 멤버 백업 삭제
export async function deleteMemberBackup(memberId: string) {
  await deleteFile(
    `backups/${memberId}.json`,
    `backup: ${memberId} 멤버 삭제`
  );
}
