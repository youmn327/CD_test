# Coding Test Dashboard

프로그래머스 Lv.0 코딩테스트 풀이를 관리하고, 월별/일별 현황을 확인할 수 있는 GitHub Pages 기반 웹 애플리케이션입니다.

## 주요 기능

### 대시보드 (`index.html`)
- 멤버별 풀이 진행률 카드
- **월별 현황** — 연도별 1~12월 풀이 수 테이블
- **일별 현황** — 캘린더 뷰로 날짜별 풀이 확인
- 월간 요약 (멤버별 풀이 수, 활동 일수, 일평균)
- 최근 제출 목록
- JSON 내보내기 / 가져오기

### 풀이 제출 페이지 (`jjw/index.html`, `nym/index.html`)
- 문제 드롭다운 선택 (60문제, 정답률 표시)
- 코드 입력 (모노스페이스 에디터)
- 스크린샷 첨부 (클릭, 드래그, Ctrl+V 붙여넣기)
- 날짜 자동 표시 (읽기 전용)
- 업로드 → localStorage + 폴더 파일 저장
- 제출 기록 조회 (코드 펼쳐보기, 이미지 미리보기)
- 제출 삭제

### 폴더 연결 (File System Access API)
- 최초 1회 폴더 선택 후 `submissions.json`에 자동 저장
- Chrome / Edge에서 지원

## 파일 구조

```
CD_test/
├── index.html              # 메인 대시보드
├── css/style.css           # 공통 스타일 (다크 테마)
├── js/
│   ├── config.js           # 문제 목록 (60문제) + 멤버 설정
│   └── storage.js          # localStorage CRUD
├── jjw/index.html          # JJW 풀이 제출 페이지
├── nym/index.html          # NYM 풀이 제출 페이지
├── problem/
│   └── programmers_lv0.md  # 문제 목록 원본
└── README.md
```

## 멤버 추가 방법

1. `js/config.js`의 `MEMBERS` 배열에 추가:
```js
{ id: 'abc', name: 'ABC', color: '#7ee787' }
```

2. `abc/index.html` 생성 (기존 페이지 복사 후 수정):
```js
const CURRENT_MEMBER = 'abc';  // 이 부분만 변경
```

## 기술 스택

- HTML / CSS / JavaScript (Vanilla, 프레임워크 없음)
- localStorage (데이터 저장)
- File System Access API (로컬 파일 저장)
- GitHub Pages (호스팅)

---

## GitHub Pages 배포 방법

### 1. 변경사항 커밋 & 푸시

```bash
cd D:/code/CD_test

# 변경된 파일 확인
git status

# 파일 추가
git add .

# 커밋
git commit -m "feat: 코딩테스트 대시보드 및 풀이 제출 페이지 구현"

# 푸시
git push origin main
```
