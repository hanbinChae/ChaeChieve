# 채카이브 독서 대시보드

HanbinChae의 개인 독서 기록 대시보드입니다.  
Google Sheets 데이터를 GitHub Actions로 매일 자동 갱신합니다.

🌐 **라이브**: https://hanbinChae.github.io/ChaeChieve/

---

## 아키텍처

```
Google Sheets (채카이브)
        ↓  매일 자정 KST
GitHub Actions (fetch_data.py)
        ↓
data.json (레포에 커밋)
        ↓
index.html + src/ (GitHub Pages, data.json fetch)
```

- **API Key 없음** — 브라우저에서 직접 외부 API 호출하지 않음
- **빠른 로드** — GitHub CDN에서 정적 JSON 서빙
- **변경 이력** — 매일 커밋으로 데이터 스냅샷 보존

---

## 파일 구조

```
reading-dashboard/
├── index.html                       # 마크업 뼈대 + CSS 링크 + <script type="module">
├── data.json                        # 독서 데이터 (Actions 자동 갱신)
├── src/
│   ├── main.js                      # 진입점: 데이터 로드 → 컴포넌트 렌더 → 이벤트 바인딩
│   ├── state.js                     # 공유 가변 상태 (연도/정렬/페이지 등) + Chart.js 인스턴스 보관
│   ├── constants.js                 # DATA_URL, 색상 팔레트, MAJOR_COLORS, PAGE_SIZE
│   ├── utils.js                     # escHtml, starsHtml, parseBookDate, debounce
│   ├── styles/
│   │   ├── global.css               # 변수, 로딩, 헤더, 레이아웃
│   │   ├── components.css           # KPI 카드, 섹션 공통, 연도 필터, 랭킹 피커
│   │   ├── charts.css               # 타임라인, 차트 카드, Diverging, Inspector
│   │   ├── table.css                # 도서 목록 표, Top Books, 뷰 토글
│   │   ├── bookshelf.css            # 호두나무 북 레일(서재)
│   │   ├── modal.css                # 도서관 대출증 / 메모 모달
│   │   └── onThisDay.css            # 이날의 책 (일력 / 연도 스크러버)
│   ├── data/
│   │   ├── dataFetcher.js           # data.json 로드, 상태 배지
│   │   └── statsCalculator.js       # 완독/필터 헬퍼, KPI 기본 지표 계산
│   └── components/
│       ├── summaryCards.js          # 요약 카드 + 호버 인사이트
│       ├── timelineChart.js         # 타임라인 (Diverging SVG, 범례/장르 필터)
│       ├── donutChart.js            # 장르 선버스트 (드릴다운)
│       ├── lineChart.js             # 연도별 추이 라인/영역 차트
│       ├── radarChart.js            # Reading Spectrum 레이더
│       ├── ratingChart.js           # Star Distribution 폴라 에어리어
│       ├── ratingCompare.js         # 랭킹 연도 피커 + My Best & Worst
│       ├── topBooks.js              # Top 10 리스트
│       ├── bookshelf.js             # 서재(북 레일) 뷰
│       ├── onThisDay.js             # 최근 완독(기본) ↔ 이날의 책(같은 월/일 과거 완독서) 토글 카드
│       ├── bookTable.js             # 표 / 페이지네이션 / 필터 / 뷰 전환
│       ├── modals.js                # 대출증 / 메모 모달
│       └── auroraHeader.js          # 헤더 Aurora WebGL 배경
├── scripts/
│   └── fetch_data.py                # 데이터 수집 스크립트
└── .github/
    └── workflows/
        └── update-data.yml          # 자동 갱신 워크플로
```

의존 방향은 `main.js → components → data / state / constants / utils` 단방향입니다.

---

## 초기 설정

### 1. GitHub Secrets 등록

레포 → **Settings → Secrets and variables → Actions → New repository secret**

| Name | Value |
|---|---|
| `SHEETS_API_KEY` | Google Cloud Console API Key |
| `SPREADSHEET_ID` | `your_spreadsheet_id_here` |

### 2. Google Sheets 공유 설정

스프레드시트 → **공유 → 링크 있는 모든 사용자 → 뷰어**

### 3. 첫 데이터 수동 실행

레포 → **Actions → Update Reading Data → Run workflow**  
→ `data.json`이 실제 데이터로 갱신됩니다.

### 4. GitHub Pages 활성화

레포 → **Settings → Pages → Branch: main / root → Save**

---

## 차트 구성

| 섹션 | 타입 |
|---|---|
| Latest Read / On This Day | 일력 카드 (최근 완독 ↔ 이날의 책 토글) + 연도 스크러버 |
| Reading Timeline | SVG 커스텀 |
| How Books Consumed | Canvas 선버스트 (드릴다운) |
| Reading Spectrum | 레이더 차트 |
| Star Distribution | 폴라 에어리어 |
| Books per Year | 에어리어 차트 |
| My Best & Worst Books | Diverging Bar + Inspector |
| Hanbin's Books Ranking | Top 10 리스트 |

---

## 로컬 개발

```bash
# 레포 루트에서 간단한 로컬 서버 실행 (Python)
python -m http.server 8080
# → http://localhost:8080/
```

> `file://`로 직접 열면 CORS로 `data.json` 로드가 차단되고, ES 모듈(`<script type="module">`)도 로드되지 않습니다.
> 반드시 로컬 서버를 통해 접속하세요.
