import pandas as pd
import os

input_path = os.path.expanduser("~/Desktop/sento-app/scripts/sentos_clean.csv")
output_path = os.path.expanduser("~/Desktop/sento-app/scripts/sentos_import.csv")

df = pd.read_csv(input_path)

# Supabaseのテーブル構造に合わせて必要なカラムだけ残す
df_import = df[["name", "address", "lat", "lng", "price_adult", "open_hours", "closed_days", "phone"]].copy()

# NaNを空文字に変換
df_import = df_import.fillna("")

df_import.to_csv(output_path, index=False, encoding="utf-8-sig")
print(f"✅ {len(df_import)}件を sentos_import.csv に保存しました")
print(df_import.head(5).to_string())