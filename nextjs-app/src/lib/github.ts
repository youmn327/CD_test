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

async function getFileSha(path: string): Promise<string | null> {
  const res = await githubApi(`/contents/${path}?ref=${BRANCH}`);
  if (res.status === 404) return null;
  const data = await res.json();
  return data.sha;
}

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

// base64 데이터를 파일로 커밋 (이미지용)
export async function commitBase64File(path: string, base64Data: string, message: string) {
  const sha = await getFileSha(path);
  const body: Record<string, string> = {
    message,
    content: base64Data,
    branch: BRANCH,
  };
  if (sha) body.sha = sha;

  await githubApi(`/contents/${path}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export async function deleteFile(path: string, message: string) {
  const sha = await getFileSha(path);
  if (!sha) return;

  await githubApi(`/contents/${path}`, {
    method: 'DELETE',
    body: JSON.stringify({
      message,
      sha,
      branch: BRANCH,
    }),
  });
}

// 폴더 내 파일 목록 가져오기
async function listFiles(dirPath: string): Promise<{ name: string; sha: string }[]> {
  const res = await githubApi(`/contents/${dirPath}?ref=${BRANCH}`);
  if (res.status === 404) return [];
  const data = await res.json();
  if (!Array.isArray(data)) return [];
  return data.map((f: { name: string; sha: string }) => ({ name: f.name, sha: f.sha }));
}

// 멤버 백업: JSON + 이미지 파일
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function backupMemberData(memberId: string, data: { member: any; submissions: any[] }) {
  // 이미지를 별도 파일로 저장하고 JSON에서는 경로만 참조
  const subsForJson = [];
  for (const sub of data.submissions) {
    if (sub.image && typeof sub.image === 'string' && sub.image.startsWith('data:')) {
      // data:image/png;base64,xxxx → 파일로 분리
      const match = sub.image.match(/^data:image\/(\w+);base64,(.+)$/);
      if (match) {
        const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
        const base64 = match[2];
        const imgPath = `backups/${memberId}/${sub.timestamp}.${ext}`;
        try {
          await commitBase64File(imgPath, base64, `backup: ${memberId} 이미지 저장`);
        } catch (e) {
          console.warn('이미지 커밋 실패:', e);
        }
        subsForJson.push({ ...sub, image: imgPath });
      } else {
        subsForJson.push(sub);
      }
    } else {
      subsForJson.push(sub);
    }
  }

  const content = JSON.stringify({ member: data.member, submissions: subsForJson }, null, 2);
  await commitFile(
    `backups/${memberId}/submissions.json`,
    content,
    `backup: ${memberId} 데이터 업데이트`
  );
}

// 멤버 백업 폴더 삭제
export async function deleteMemberBackup(memberId: string) {
  const files = await listFiles(`backups/${memberId}`);
  for (const file of files) {
    await deleteFile(
      `backups/${memberId}/${file.name}`,
      `backup: ${memberId} 멤버 삭제`
    );
  }
}
