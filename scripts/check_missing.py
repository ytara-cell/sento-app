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
        h2 = soup.find("h2")
        if not h2:
            return None
        name_raw = h2.get_text(strip=True)
        name = re.sub(r"\s*\[.*?\]", "", name_raw).strip()
        if not name or name == "東京銭湯リストTOKYO SENTO":
            return None
        return {"num": num, "name": name}
    except:
        return None

def main():
    print("全件の銭湯名を取得中...")
    all_sentos = []
    consecutive_empty = 0
    i = 1

    while True:
        data = scrape_sento_page(i)
        if data:
            all_sentos.append(data)
            print(f"[{i}] {data['name']}")
            consecutive_empty = 0
        else:
            consecutive_empty += 1
            print(f"[{i}] なし")

        if consecutive_empty >= 20:
            break

        i += 1
        time.sleep(0.5)

    df = pd.DataFrame(all_sentos)
    df.to_csv(
        "/Users/yuichitara/Desktop/sento-app/scripts/all_sentos_web.csv",
        index=False, encoding="utf-8-sig"
    )
    print(f"\n✅ サイト上の総件数: {len(df)}件")

    # CSVと比較
    db = pd.read_csv("/Users/yuichitara/Desktop/sento-app/scripts/sentos_clean.csv")
    print(f"DB上の件数: {len(db)}件")

    web_names = set(df["name"].tolist())
    db_names = set(db["name"].tolist())

    missing = web_names - db_names
    print(f"\n欠損している銭湯: {len(missing)}件")
    for name in sorted(missing):
        print(f"  - {name}")

if __name__ == "__main__":
    main()