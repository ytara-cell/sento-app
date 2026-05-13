import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'プライバシーポリシー | YuMeguru Tokyo',
}

export default function PrivacyPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#F7F5F0',
      color: '#1A1A2E',
    }}>
    <div style={{
      maxWidth: 680,
      margin: '0 auto',
      padding: '40px 24px 80px',
      fontFamily: "'Noto Sans JP', sans-serif",
      color: '#1A1A2E',
      lineHeight: 1.8,
      fontSize: 14,
    }}>
      <h1 style={{ fontFamily: 'serif', fontSize: 22, fontWeight: 700, marginBottom: 8, color: '#1A1A2E' }}>プライバシーポリシー</h1>
      <p style={{ color: '#9A9890', fontSize: 12, marginBottom: 40 }}>最終更新日：2026年5月13日</p>

      <section style={{ marginBottom: 32 }}>
        <h2 style={h2}>1. はじめに</h2>
        <p>
          本アプリ「銭湯めぐり」（以下「本アプリ」）は、東京都内の銭湯情報の閲覧・記録を目的とした個人向けサービスです。
          本ポリシーでは、本アプリが収集・利用する情報について説明します。
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={h2}>2. 収集する情報</h2>
        <h3 style={h3}>（1）端末に保存される情報（ローカルストレージ）</h3>
        <p>以下の情報はお使いの端末のローカルストレージに保存されます。サーバーには送信されません。</p>
        <ul style={ul}>
          <li>訪問済み銭湯のID一覧</li>
          <li>お気に入り銭湯のID一覧</li>
          <li>匿名ユーザーキー（ランダムな文字列。氏名・メールアドレス等の個人情報は含まれません）</li>
        </ul>

        <h3 style={h3}>（2）サーバーに保存される情報（Supabase）</h3>
        <p>以下の情報は匿名ユーザーキーに紐付けてデータベースに保存されます。</p>
        <ul style={ul}>
          <li>銭湯ごとのメモ（任意入力）</li>
          <li>コレクションカード保有状況</li>
        </ul>
        <p>
          匿名ユーザーキーは端末内にのみ存在するランダムな文字列であり、
          特定の個人を識別することはできません。
        </p>

        <h3 style={h3}>（3）位置情報</h3>
        <p>
          「近い順」機能を使用する場合、ブラウザの位置情報APIを通じて現在地を取得します。
          取得した位置情報は距離計算にのみ使用され、サーバーには送信・保存されません。
          位置情報の利用はユーザーの明示的な許可が必要です。
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={h2}>3. 第三者サービスの利用</h2>
        <h3 style={h3}>Google Maps Platform</h3>
        <p>
          地図表示機能にGoogle Maps Platformを使用しています。
          Google Maps利用時のデータ取り扱いについては
          <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer" style={{ color: '#1565C0' }}>Googleプライバシーポリシー</a>
          をご参照ください。
        </p>

        <h3 style={h3}>Google AdSense</h3>
        <p>
          本アプリはGoogle AdSenseによる広告を掲載しています。
          Google AdSenseはCookieを使用して、ユーザーの興味に基づく広告を配信することがあります。
          広告のパーソナライズはGoogleの
          <a href="https://adssettings.google.com/" target="_blank" rel="noreferrer" style={{ color: '#1565C0' }}>広告設定</a>
          から変更できます。詳細は
          <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer" style={{ color: '#1565C0' }}>Googleプライバシーポリシー</a>
          をご確認ください。
        </p>

        <h3 style={h3}>Supabase</h3>
        <p>
          データベースサービスにSupabaseを使用しています。
          詳細は<a href="https://supabase.com/privacy" target="_blank" rel="noreferrer" style={{ color: '#1565C0' }}>Supabaseプライバシーポリシー</a>をご参照ください。
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={h2}>4. 情報の利用目的</h2>
        <p>収集した情報は以下の目的にのみ使用します。</p>
        <ul style={ul}>
          <li>訪問記録・メモ・お気に入り等のユーザーデータの保存と表示</li>
          <li>現在地から近い銭湯の表示</li>
          <li>アプリの機能改善</li>
        </ul>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={h2}>5. 情報の第三者提供</h2>
        <p>
          法令に基づく場合を除き、収集した情報を第三者に提供することはありません。
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={h2}>6. データの削除</h2>
        <p>
          ローカルストレージのデータはブラウザの設定からいつでも削除できます。
          サーバー上のデータ（メモ・カード情報）の削除をご希望の場合はお問い合わせください。
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={h2}>7. ポリシーの変更</h2>
        <p>
          本ポリシーは必要に応じて改定することがあります。
          重要な変更がある場合はアプリ上でお知らせします。
        </p>
      </section>

      <section>
        <h2 style={h2}>8. お問い合わせ</h2>
        <p>
          本ポリシーに関するお問い合わせは、アプリ内の各SNSリンクよりご連絡ください。
        </p>
      </section>

      <div style={{ marginTop: 48, paddingTop: 24, borderTop: '1px solid #ECEAE4' }}>
        <a href="/" style={{ color: '#1565C0', fontSize: 13 }}>← アプリに戻る</a>
      </div>
    </div>
    </div>
  )
}

const h2: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 700,
  marginBottom: 10,
  marginTop: 0,
  paddingBottom: 6,
  borderBottom: '1px solid #ECEAE4',
  color: '#1A1A2E',
}

const h3: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  marginTop: 16,
  marginBottom: 6,
  color: '#5A5850',
}

const ul: React.CSSProperties = {
  paddingLeft: 20,
  margin: '8px 0',
  color: '#1A1A2E',
}
