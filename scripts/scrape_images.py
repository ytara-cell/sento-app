import requests
from bs4 import BeautifulSoup
import pandas as pd
import time
import re
import json

headers = {"User-Agent": "Mozilla/5.0"}

def scrape_sento_detail(num):
    url = f"https://www.1010.or.jp/map/item/item-cnt-{num}"
    try:
        res = requests.get(url, headers=headers, timeout=10)
        if res.status_code != 200:
            return None
        soup = BeautifulSoup(res.text, "html.parser")

        # 名前
        h2 = soup.find("h2")
        if not h2:
            return None
        name_raw = h2.get_text(strip=True)
        name = re.sub(r"\s*\[.*?\]", "", name_raw).strip()
        if not name or name == "東京銭湯リストTOKYO SENTO":
            return None

        # 画像URL（ギャラリー内の画像を取得）
        images = []
        gallery = soup.select_one(".gallery")
        if gallery:
            for img in gallery.find_all("img"):
                src = img.get("src", "")
                if src and not src.endswith(".gif"):
                    if not src.startswith("http"):
                        src = "https://www.1010.or.jp" + src
                    images.append(src)

        # メイン画像も取得
        for img in soup.select(".view img, .left img"):
            src = img.get("src", "")
            if src and not src.endswith(".gif") and src not in images:
                if not src.startswith("http"):
                    src = "https://www.1010.or.jp" + src
                images.append(src)

        # 一言コメント（noteクラス）
        note_el = soup.select_one(".note")
        note = note_el.get_text(strip=True) if note_el else ""

        # 公式HP
        hp = ""
        for row in soup.select("table tr"):
            cells = row.find_all(["td", "th"])
            if len(cells) >= 2 and cells[0].get_text(strip=True) == "公式ページ":
                link = cells[1].find("a")
                if link:
                    hp = link.get("href", "")

        return {
            "name": name,
            "num": num,
            "images": json.dumps(images[:3]),  # 最大3枚
            "description": note,
            "website": hp,
        }
    except Exception as e:
        print(f"  エラー: {e}")
        return None

def main():
    print("画像・詳細情報のスクレイピング開始...")
    results = []
    consecutive_empty = 0
    i = 1

    while True:
        print(f"[{i}] 取得中...", end=" ")
        data = scrape_sento_detail(i)

        if data:
            results.append(data)
            img_count = len(json.loads(data["images"]))
            print(f"✅ {data['name']} (画像{img_count}枚)")
            consecutive_empty = 0
        else:
            print("⚠️  スキップ")
            consecutive_empty += 1

        if consecutive_empty >= 20:
            break

        # 50件ごとに中間保存
        if len(results) % 50 == 0 and len(results) > 0:
            df_tmp = pd.DataFrame(results)
            df_tmp.to_csv(
                "/Users/yuichitara/Desktop/sento-app/scripts/sentos_images.csv",
                index=False, encoding="utf-8-sig"
            )
            print(f"\n💾 中間保存: {len(results)}件\n")

        i += 1
        time.sleep(0.8)

    df = pd.DataFrame(results)
    df.to_csv(
        "/Users/yuichitara/Desktop/sento-app/scripts/sentos_images.csv",
        index=False, encoding="utf-8-sig"
    )
    print(f"\n✅ {len(df)}件を sentos_images.csv に保存しました")

if __name__ == "__main__":
    main()