import requests
from bs4 import BeautifulSoup
import pandas as pd
import time
import re

headers = {"User-Agent": "Mozilla/5.0"}

def scrape_sento_page(num):
    url = f"https://www.1010.or.jp/map/item/item-cnt-{num}"
    try:
        res = requests.get(url, headers=headers, timeout=10)
        if res.status_code != 200:
            return None

        soup = BeautifulSoup(res.text, "html.parser")

        # 名前（h2から取得）
        h2 = soup.find("h2")
        if not h2:
            return None
        name_raw = h2.get_text(strip=True)
        name = re.sub(r"\s*\[.*?\]", "", name_raw).strip()
        if not name or name == "東京銭湯リストTOKYO SENTO":
            return None

        # テーブルから情報を取得
        data = {"name": name, "url": url, "price_adult": 550}
        for row in soup.select("table tr"):
            cells = row.find_all(["td", "th"])
            if len(cells) >= 2:
                key = cells[0].get_text(strip=True)
                val = cells[1].get_text(strip=True)
                if key == "住所":
                    addr = re.sub(r"〒[\d\-]+", "", val).strip()
                    data["address"] = "東京都" + addr if not addr.startswith("東京都") else addr
                elif key == "電話番号":
                    data["phone"] = val
                elif key == "休日":
                    data["closed_days"] = val
                elif key == "営業時間":
                    data["open_hours"] = val

        # 緯度経度
        lat, lng = None, None
        for link in soup.find_all("a", href=True):
            href = link.get("href", "")
            match = re.search(r"(3[45]\.\d+),(13[89]\.\d+)", href)
            if match:
                lat = float(match.group(1))
                lng = float(match.group(2))
                break

        if not lat:
            for iframe in soup.find_all("iframe", src=True):
                src = iframe.get("src", "")
                match = re.search(r"(3[45]\.\d+),(13[89]\.\d+)", src)
                if match:
                    lat = float(match.group(1))
                    lng = float(match.group(2))
                    break

        data["lat"] = lat
        data["lng"] = lng
        return data

    except Exception as e:
        print(f"  エラー: {e}")
        return None


def main():
    sentos = []
    consecutive_empty = 0  # 連続でデータなしが続いたら終了
    print("=== 東京都浴場組合 全件スクレイピング開始 ===\n")

    i = 1
    while True:
        print(f"[{i}] 取得中...", end=" ")
        data = scrape_sento_page(i)

        if data and data.get("name"):
            sentos.append(data)
            print(f"✅ {data['name']}")
            consecutive_empty = 0
        else:
            print("⚠️  データなし")
            consecutive_empty += 1

        # 20件連続でデータなしなら終了
        if consecutive_empty >= 20:
            print(f"\n20件連続でデータなし → 終了（最終番号: {i}）")
            break

        # 50件ごとに中間保存
        if len(sentos) % 50 == 0 and len(sentos) > 0:
            df_tmp = pd.DataFrame(sentos)
            df_tmp.to_csv("sentos_raw.csv", index=False, encoding="utf-8-sig")
            print(f"\n💾 中間保存: {len(sentos)}件\n")

        i += 1
        time.sleep(0.8)

    # 最終保存
    df = pd.DataFrame(sentos)
    df.to_csv("sentos_raw.csv", index=False, encoding="utf-8-sig")
    print(f"\n✅ 完了！{len(df)}件を sentos_raw.csv に保存しました")
    print(df[["name", "address", "lat", "lng"]].head(20).to_string())

if __name__ == "__main__":
    main()