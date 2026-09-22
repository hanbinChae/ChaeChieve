"""
fetch_data.py
Google Sheets API v4 → data.json 생성
GitHub Actions에서 실행됩니다.
"""

import os
import json
import requests
from datetime import datetime, timezone

# ── 설정 ──────────────────────────────────────────────────────────────────────
API_KEY        = os.environ["SHEETS_API_KEY"]
SPREADSHEET_ID = os.environ["SPREADSHEET_ID"]
SHEET_NAME     = "채카이브"
HEADER_ROW     = 2
DATA_START_ROW = 3
OUTPUT_PATH    = "data.json"


def find_idx(headers, *candidates):
    for c in candidates:
        if c in headers:
            return headers.index(c)
    return -1


def normalize_date(raw: str) -> str:
    """날짜 문자열을 'YYYY. MM. DD' 형식으로 통일"""
    return raw.replace("/", ". ").replace("-", ". ").strip()


def extract_year(date_str: str) -> str:
    import re
    m = re.search(r"(\d{4})", date_str)
    return m.group(1) if m else ""


def fetch_sheet() -> list:
    """시트에서 헤더 행부터 전체 데이터 가져오기"""
    range_name = f"{SHEET_NAME}!{HEADER_ROW}:{DATA_START_ROW + 2000}"
    url = (
        f"https://sheets.googleapis.com/v4/spreadsheets/{SPREADSHEET_ID}"
        f"/values/{requests.utils.quote(range_name)}?key={API_KEY}"
    )
    resp = requests.get(url, timeout=30)
    resp.raise_for_status()
    data = resp.json()
    if "error" in data:
        raise RuntimeError(data["error"]["message"])
    return data.get("values", [])


def parse_rows(rows: list) -> list:
    if len(rows) < 2:
        return []

    headers = [str(h).strip() for h in rows[0]]

    idx = {
        "status":   find_idx(headers, "완독여부"),
        "date":     find_idx(headers, "완독 날짜", "완독날짜"),
        "title":    find_idx(headers, "제목"),
        "author":   find_idx(headers, "저자"),
        "major":    find_idx(headers, "주류"),
        "subMajor": find_idx(headers, "강목"),
        "minor":    find_idx(headers, "요목"),
        "medium":   find_idx(headers, "매체"),
        "rating":   find_idx(headers, "평점"),
        "memo":     find_idx(headers, "메모"),
        "duration": find_idx(headers, "완독 기간", "완독기간"),
        "decimal":  find_idx(headers, "십진분류법"),
    }

    books = []
    for row in rows[1:]:  # 헤더 제외
        def g(i):
            return str(row[i]).strip() if i >= 0 and i < len(row) else ""

        title = g(idx["title"])
        if not title:
            continue

        date_str = normalize_date(g(idx["date"]))
        year     = extract_year(date_str)

        try:
            rating = float(g(idx["rating"])) if g(idx["rating"]) else 0.0
        except ValueError:
            rating = 0.0

        books.append({
            "status":   g(idx["status"]),
            "date":     date_str,
            "year":     year,
            "title":    title,
            "author":   g(idx["author"]),
            "major":    g(idx["major"]),
            "subMajor": g(idx["subMajor"]),
            "minor":    g(idx["minor"]),
            "medium":   g(idx["medium"]),
            "rating":   rating,
            "memo":     g(idx["memo"]),
            "duration": g(idx["duration"]),
            "decimal":  g(idx["decimal"]),
        })

    return books


def main():
    print("📚 Google Sheets에서 데이터 가져오는 중...")
    rows  = fetch_sheet()
    books = parse_rows(rows)
    print(f"✅ {len(books)}권 파싱 완료")

    now_kst = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M KST")
    output  = {
        "updated_at": now_kst,
        "count":      len(books),
        "books":      books,
    }

    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"💾 {OUTPUT_PATH} 저장 완료 ({len(books)}권)")


if __name__ == "__main__":
    main()
