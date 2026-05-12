import pandas as pd
import os
import json
import requests

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

def update_sento(name, images, description, website):
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
    }
    # 名前で銭湯を検索して更新
    params = {"name": f"eq.{name}"}
    body = {}
    if images:
        body["images"] = images
    if description:
        body["description"] = description
    if website:
        body["website"] = website

    if not body:
        return False

    res = requests.patch(
        f"{SUPABASE_URL}/rest/v1/sentos",
        headers=headers,
        params=params,
        json=body,
        timeout=10
    )
    return res.status_code in [200, 204]

def main():
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")

    if not url or not key:
        print("❌ 環境変数を設定してください:")
        print("   export SUPABASE_URL='https://xxxx.supabase.co'")
        print("   export SUPABASE_SERVICE_KEY='your_service_role_key'")
        return

    input_path = os.path.expanduser(
        "~/Desktop/sento-app/scripts/sentos_images.csv"
    )
    df = pd.read_csv(input_path)
    print(f"画像データ: {len(df)}件")

    success = 0
    for i, row in df.iterrows():
        name = str(row.get("name", "")).strip()
        images = str(row.get("images", "[]")).strip()
        description = str(row.get("description", "")).strip()
        website = str(row.get("website", "")).strip()

        if not name:
            continue

        ok = update_sento(
            name,
            images if images != "[]" else None,
            description if description and description != "nan" else None,
            website if website and website != "nan" else None,
        )
        if ok:
            success += 1
            print(f"  ✅ [{i+1}] {name}")
        else:
            print(f"  ⚠️  [{i+1}] {name} — 更新失敗")

    print(f"\n✅ {success}/{len(df)}件を更新しました")

if __name__ == "__main__":
    main()