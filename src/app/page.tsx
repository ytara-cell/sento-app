'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { APIProvider, Map, Marker, InfoWindow } from '@vis.gl/react-google-maps'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function Home() {
  const [sentos, setSentos] = useState<any[]>([])
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'unchecked' | 'checked'>('all')
  const [view, setView] = useState<'list' | 'map'>('list')
  const [selected, setSelected] = useState<any>(null)
  const [search, setSearch] = useState('')
  const [detail, setDetail] = useState<any>(null)
  const [memo, setMemo] = useState('')
  const [savedMemo, setSavedMemo] = useState('')
  const [memoSaving, setMemoSaving] = useState(false)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('sentos')
        .select('*')
        .order('name')
      setSentos(data ?? [])
      setLoading(false)
    }
    load()
    const saved = localStorage.getItem('checked_sentos')
    if (saved) setChecked(new Set(JSON.parse(saved)))
  }, [])

  function toggleCheck(id: string) {
    setChecked(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      localStorage.setItem('checked_sentos', JSON.stringify([...next]))
      return next
    })
  }

  async function openDetail(s: any) {
    console.log('openDetail called', s.name)
    setDetail(s)
    setMemo('')
    setSavedMemo('')
    const userKey = getUserKey()
    const { data } = await supabase
      .from('memos')
      .select('body')
      .eq('sento_id', s.id)
      .eq('user_key', userKey)
      .single()
    if (data) {
      setMemo(data.body)
      setSavedMemo(data.body)
    }
  }

  function getUserKey() {
    let key = localStorage.getItem('user_key')
    if (!key) {
      key = Math.random().toString(36).slice(2)
      localStorage.setItem('user_key', key)
    }
    return key
  }

  async function saveMemo() {
    if (!detail) return
    setMemoSaving(true)
    const userKey = getUserKey()
    await supabase.from('memos').upsert({
      sento_id: detail.id,
      user_key: userKey,
      body: memo,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'sento_id,user_key' })
    setSavedMemo(memo)
    setMemoSaving(false)
  }

  const filtered = sentos.filter(s => {
    const matchFilter =
      filter === 'checked' ? checked.has(s.id) :
      filter === 'unchecked' ? !checked.has(s.id) : true
    const matchSearch = search === '' ||
      s.name.includes(search) ||
      (s.address && s.address.includes(search))
    return matchFilter && matchSearch
  })

  const recommended = sentos
    .filter(s => !checked.has(s.id))
    .sort(() => Math.random() - 0.5)
    .slice(0, 3)

  const mapSentos = sentos.filter(s => s.lat && s.lng)
  const images = detail?.images ? JSON.parse(detail.images) : []

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-4 py-3 sticky top-0 z-10" style={{ backgroundColor: 'white', color: 'black' }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'black' }}>♨ 銭湯めぐり</h1>
            <p className="text-sm" style={{ color: '#6b7280' }}>{checked.size} / {sentos.length} 軒制覇</p>
          </div>
          <div className="flex border rounded-lg overflow-hidden">
            <button onClick={() => setView('list')} className={`px-3 py-1.5 text-xs font-medium transition-all ${view === 'list' ? 'bg-teal-500 text-white' : 'bg-white text-gray-500'}`}>リスト</button>
            <button onClick={() => setView('map')} className={`px-3 py-1.5 text-xs font-medium transition-all ${view === 'map' ? 'bg-teal-500 text-white' : 'bg-white text-gray-500'}`}>地図</button>
          </div>
        </div>
        <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full bg-teal-500 rounded-full transition-all" style={{ width: `${sentos.length ? (checked.size / sentos.length) * 100 : 0}%` }} />
        </div>
        {view === 'list' && (
          <>
            <div className="flex gap-2 mt-2">
              {(['all', 'unchecked', 'checked'] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)} className={`text-xs px-3 py-1 rounded-full border transition-all ${filter === f ? 'bg-teal-500 text-white border-teal-500' : 'bg-white text-gray-500 border-gray-300'}`}>
                  {f === 'all' ? 'すべて' : f === 'unchecked' ? '未訪問' : '訪問済み'}
                </button>
              ))}
            </div>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="銭湯名・住所で検索..." className="mt-2 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-teal-400" style={{ backgroundColor: 'white', color: 'black' }} />
          </>
        )}
      </header>
      {view === 'map' && (
        <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!}>
          <div style={{ height: 'calc(100vh - 120px)' }}>
            <Map defaultCenter={{ lat: 35.6762, lng: 139.6503 }} defaultZoom={11}>
              {mapSentos.map(s => (
                <Marker key={s.id} position={{ lat: s.lat, lng: s.lng }} onClick={() => setSelected(s)} label="♨" />
              ))}
              {selected && (
                <InfoWindow position={{ lat: selected.lat, lng: selected.lng }} onCloseClick={() => setSelected(null)}>
                  <div className="p-1 min-w-32">
                    <h3 className="font-bold text-sm">{selected.name}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">{selected.address}</p>
                    <div className="flex gap-1 mt-2">
                      <button onClick={() => { toggleCheck(selected.id); setSelected(null) }} className={`flex-1 text-xs py-1 rounded-full font-medium ${checked.has(selected.id) ? 'bg-gray-100 text-gray-500' : 'bg-teal-500 text-white'}`}>
                        {checked.has(selected.id) ? '✓ 訪問済み' : '行った！'}
                      </button>
                      <button onClick={() => { openDetail(selected); setSelected(null) }} className="flex-1 text-xs py-1 rounded-full font-medium bg-gray-100 text-gray-600">詳細</button>
                    </div>
                  </div>
                </InfoWindow>
              )}
            </Map>
          </div>
        </APIProvider>
      )}

      {view === 'list' && (
        <div>
          {recommended.length > 0 && (
            <div className="px-4 pt-4">
              <h2 className="text-sm font-bold text-gray-700 mb-2">🎯 今日のおすすめ</h2>
              <div className="flex flex-col gap-2 mb-4">
                {recommended.map(s => (
                  <div key={s.id} className="bg-teal-500 rounded-xl p-4 flex items-center gap-3">
                    <span className="text-2xl cursor-pointer" onClick={() => toggleCheck(s.id)}>♨</span>
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => openDetail(s)}>
                      <h3 className="font-bold text-sm text-white">{s.name}</h3>
                      <p className="text-xs text-teal-100 truncate">{s.address}</p>
                    </div>
                    <span onClick={() => toggleCheck(s.id)} className="text-xs bg-white text-teal-600 px-2 py-0.5 rounded-full flex-shrink-0 font-bold cursor-pointer">行く！</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="p-4">
            {loading ? (
              <p className="text-center text-gray-400 mt-10">読み込み中...</p>
            ) : (
              <div className="flex flex-col gap-2">
                {filtered.map(s => (
                  <div key={s.id} className={`bg-white rounded-xl p-4 border flex items-center gap-3 transition-all ${checked.has(s.id) ? 'border-teal-400 bg-teal-50' : 'border-gray-200'}`}>
                    <div onClick={() => toggleCheck(s.id)} className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 cursor-pointer ${checked.has(s.id) ? 'bg-teal-500 border-teal-500' : 'border-gray-300'}`}>
                      {checked.has(s.id) && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => openDetail(s)}>
                      <h2 className={`font-bold text-sm ${checked.has(s.id) ? 'text-teal-700' : 'text-gray-800'}`}>{s.name}</h2>
                      <p className="text-xs text-gray-400 truncate">{s.address}</p>
                      {s.open_hours && <p className="text-xs text-gray-400">{s.open_hours}</p>}
                    </div>
                    {checked.has(s.id) && (
                      <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full flex-shrink-0">訪問済み</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => setDetail(null)}>
          <div className="bg-white w-full max-w-lg rounded-t-2xl overflow-y-auto" style={{ maxHeight: '85vh' }} onClick={e => e.stopPropagation()}>
            {images.length > 0 ? (
              <div className="w-full h-48 overflow-hidden">
                <img src={images[0]} alt={detail.name} className="w-full h-full object-cover" onError={e => (e.currentTarget.style.display = 'none')} />
              </div>
            ) : (
              <div className="w-full h-32 bg-teal-50 flex items-center justify-center">
                <span className="text-5xl">♨</span>
              </div>
            )}
            <div className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h2 className="text-xl font-bold text-gray-800">{detail.name}</h2>
                  <p className="text-sm text-gray-500 mt-0.5">{detail.address}</p>
                </div>
                <button onClick={() => toggleCheck(detail.id)} className={`ml-3 flex-shrink-0 px-4 py-2 rounded-full text-sm font-bold transition-all ${checked.has(detail.id) ? 'bg-teal-500 text-white' : 'bg-gray-100 text-gray-600'}`}>
                  {checked.has(detail.id) ? '✓ 訪問済み' : '行った！'}
                </button>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 mb-4 space-y-1.5">
                {detail.open_hours && (
                  <div className="flex gap-2 text-sm">
                    <span className="text-gray-400 w-16 flex-shrink-0">営業時間</span>
                    <span className="text-gray-700">{detail.open_hours}</span>
                  </div>
                )}
                {detail.closed_days && (
                  <div className="flex gap-2 text-sm">
                    <span className="text-gray-400 w-16 flex-shrink-0">定休日</span>
                    <span className="text-gray-700">{detail.closed_days}</span>
                  </div>
                )}
                {detail.phone && (
                  <div className="flex gap-2 text-sm">
                    <span className="text-gray-400 w-16 flex-shrink-0">電話</span>
                    <a href={`tel:${detail.phone}`} className="text-teal-600">{detail.phone}</a>
                  </div>
                )}
                {detail.price_adult && (
                  <div className="flex gap-2 text-sm">
                    <span className="text-gray-400 w-16 flex-shrink-0">料金</span>
                    <span className="text-gray-700">大人 ¥{detail.price_adult}</span>
                  </div>
                )}
                {detail.website && (
                  <div className="flex gap-2 text-sm">
                    <span className="text-gray-400 w-16 flex-shrink-0">公式HP</span>
                    <a href={detail.website} target="_blank" rel="noreferrer" className="text-teal-600 underline">リンク</a>
                  </div>
                )}
              </div>
              {detail.description && (
                <p className="text-sm text-gray-600 leading-relaxed mb-4">{detail.description}</p>
              )}
              <div className="mb-4">
                <h3 className="text-sm font-bold text-gray-700 mb-2">📝 一言メモ</h3>
                <textarea
                  value={memo}
                  onChange={e => setMemo(e.target.value)}
                  placeholder="この銭湯の感想を書いてみよう..."
                  className="w-full text-sm border border-gray-200 rounded-xl p-3 outline-none focus:border-teal-400 resize-none"
                  style={{ backgroundColor: 'white', color: 'black' }}
                  rows={3}
                />
                <button
                  onClick={saveMemo}
                  disabled={memoSaving || memo === savedMemo}
                  className={`mt-2 w-full py-2 rounded-xl text-sm font-bold transition-all ${memo === savedMemo ? 'bg-gray-100 text-gray-400' : 'bg-teal-500 text-white'}`}
                >
                  {memoSaving ? '保存中...' : memo === savedMemo ? '保存済み ✓' : 'メモを保存'}
                </button>
              </div>
              <button onClick={() => setDetail(null)} className="w-full py-3 rounded-xl text-sm font-bold bg-gray-100 text-gray-600">
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}