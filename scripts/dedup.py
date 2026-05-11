import pandas as pd
import os

input_path = os.path.expanduser("~/Desktop/sento-app/scripts/sentos_raw.csv")
output_path = os.path.expanduser("~/Desktop/sento-app/scripts/sentos_clean.csv")

df = pd.read_csv(input_path)
print(f"処理前: {len(df)}件")

# 名前+住所の組み合わせで重複除去
df_dedup = df.drop_duplicates(subset=["name", "address"], keep="first")
print(f"処理後: {len(df_dedup)}件")
print(f"除去した重複: {len(df) - len(df_dedup)}件")

# lat/lngがないものを確認
no_coords = df_dedup[df_dedup["lat"].isna()]
print(f"\n緯度経度なし: {len(no_coords)}件")

df_dedup.to_csv(output_path, index=False, encoding="utf-8-sig")
print(f"\n✅ sentos_clean.csv に保存しました")
print(df_dedup[["name","address","lat","lng"]].head(10).to_string())