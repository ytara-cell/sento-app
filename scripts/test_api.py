import requests
from bs4 import BeautifulSoup

headers = {"User-Agent": "Mozilla/5.0"}

# 1件目の詳細を確認
res = requests.get("https://www.1010.or.jp/map/item/item-cnt-1", headers=headers, timeout=10)
soup = BeautifulSoup(res.text, "html.parser")

# h1〜h4を全部表示
print("=== 見出し ===")
for tag in ["h1","h2","h3","h4"]:
    for el in soup.find_all(tag):
        print(f"  <{tag}>: {el.get_text(strip=True)}")

# tableの中身
print("\n=== テーブル ===")
for table in soup.find_all("table"):
    for row in table.find_all("tr"):
        cells = [td.get_text(strip=True) for td in row.find_all(["td","th"])]
        if cells:
            print(f"  {cells}")

# divのclass名一覧
print("\n=== 主なdivのclass ===")
seen = set()
for div in soup.find_all("div", class_=True):
    cls = " ".join(div.get("class",[]))
    if cls not in seen:
        seen.add(cls)
        text = div.get_text(strip=True)[:50]
        print(f"  .{cls}: {text}")