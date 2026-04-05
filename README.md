# Coding Test Dashboard

프로그래머스 Lv.0 코딩테스트 풀이를 관리하고, 월별/일별 현황을 확인할 수 있는 웹 애플리케이션입니다.

## 배포 주소

https://cd-test-woad.vercel.app

## 주요 기능

### 대시보드
- 멤버별 풀이 진행률 카드
- **월별 현황** - 연도별 1~12월 풀이 수 테이블
- **일별 현황** - 캘린더 뷰로 날짜별 풀이 확인 (멤버별 뱃지)
- 월간 요약 (멤버별 풀이 수, 활동 일수, 일평균)
- 최근 제출 목록

### 풀이 제출 (`/{멤버ID}`)
- 문제 드롭다운 선택 (60문제, 정답률 표시, 프로그래머스 링크)
- 코드 입력 (모노스페이스 에디터)
- 스크린샷 첨부 (클릭, 드래그, Ctrl+V 붙여넣기)
- 날짜 자동 표시 (한국 시간 기준)
- 제출 기록 조회 (코드 펼쳐보기, 이미지 미리보기, 삭제)

### 멤버 관리
- 대시보드에서 멤버 추가/삭제
- 동적 라우트로 폴더 생성 불필요
- 추가/삭제 시 GitHub에 자동 백업 커밋

### 자동 백업 (GitHub 커밋)
- 풀이 제출/삭제 시 `backups/{멤버ID}/submissions.json` 자동 커밋
- 이미지는 `backups/{멤버ID}/{문제ID}_{날짜}.png` 로 별도 커밋
- 멤버 추가/삭제 시에도 자동 커밋

## 기술 스택

- **Next.js** (App Router)
- **Upstash Redis** (데이터 저장)
- **GitHub API** (자동 백업 커밋)
- **Tailwind CSS** (스타일링)
- **Vercel** (배포)

## 파일 구조

```
CD_test/
├── nextjs-app/
│   └── src/
│       ├── app/
│       │   ├── page.tsx                # 대시보드
│       │   ├── [memberId]/page.tsx     # 멤버 제출 페이지 (동적)
│       │   └── api/
│       │       ├── members/route.ts    # 멤버 CRUD + 백업
│       │       └── submissions/route.ts # 제출 CRUD + 백업
│       ├── components/
│       │   ├── Dashboard.tsx
│       │   ├── MemberPage.tsx
│       │   └── Toast.tsx
│       └── lib/
│           ├── kv.ts          # Upstash Redis
│           ├── github.ts      # GitHub API 자동 커밋
│           ├── problems.ts    # 문제 60개
│           └── types.ts
├── backups/                   # 자동 생성되는 백업 데이터
├── problem/
│   └── programmers_lv0.md     # 문제 목록 원본
└── README.md
```

## 환경변수

| Key | 설명 |
|-----|------|
| `KV_REST_API_URL` | Upstash Redis URL (Vercel 자동 연결) |
| `KV_REST_API_TOKEN` | Upstash Redis 토큰 (Vercel 자동 연결) |
| `GITHUB_TOKEN` | GitHub Personal Access Token (repo 권한) |
| `GITHUB_OWNER` | GitHub 사용자명 |
| `GITHUB_REPO` | GitHub 저장소명 |
| `GITHUB_BRANCH` | 브랜치명 |

## 멤버 추가 방법

대시보드에서 **"+" 카드** 클릭 → 아이디, 이름, 색상 입력 → 생성
