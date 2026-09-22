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
index.html (GitHub Pages, data.json fetch)
```

- **API Key 없음** — 브라우저에서 직접 외부 API 호출하지 않음
- **빠른 로드** — GitHub CDN에서 정적 JSON 서빙
- **변경 이력** — 매일 커밋으로 데이터 스냅샷 보존

---

## 파일 구조

```
reading-dashboard/
├── index.html                       # 대시보드 메인
├── data.json                        # 독서 데이터 (Actions 자동 갱신)
├── scripts/
│   └── fetch_data.py                # 데이터 수집 스크립트
└── .github/
    └── workflows/
        └── update-data.yml          # 자동 갱신 워크플로
```

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
# 간단한 로컬 서버 실행 (Python)
python -m http.server 8080
# → http://localhost:8080/reading-dashboard/
```

> `file://`로 직접 열면 CORS로 `data.json` 로드가 차단됩니다.  
> 반드시 로컬 서버를 통해 접속하세요.
