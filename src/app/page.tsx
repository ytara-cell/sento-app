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

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-4 py-3 sticky top-0 z-10" style={{ backgroundColor: 'white', color: 'black' }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'black' }}>♨ 銭湯めぐり</h1>
            <p className="text-sm" style={{ color: '#6b7280' }}>{checked.size} / {sentos.length} 軒制覇</p>
          </div>
          {/* リスト/マップ切り替え */}
          <div className="flex border rounded-lg overflow-hidden">
            <button
              onClick={() => setView('list')}
              className={`px-3 py-1.5 text-xs font-medium transition-all ${
                view === 'list' ? 'bg-teal-500 text-white' : 'bg-white text-gray-500'
              }`}
            >
              リスト
            </button>
            <button
              onClick={() => setView('map')}
              className={`px-3 py-1.5 text-xs font-medium transition-all ${
                view === 'map' ? 'bg-teal-500 text-white' : 'bg-white text-gray-500'
              }`}
            >
              地図
            </button>
          </div>
        </div>
        <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-teal-500 rounded-full transition-all"
            style={{ width: `${sentos.length ? (checked.size / sentos.length) * 100 : 0}%` }}
          />
        </div>
        {view === 'list' && (
          <div className="flex gap-2 mt-2">
            {(['all', 'unchecked', 'checked'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`text-xs px-3 py-1 rounded-full border transition-all ${
                  filter === f
                    ? 'bg-teal-500 text-white border-teal-500'
                    : 'bg-white text-gray-500 border-gray-300'
                }`}
              >
                {f === 'all' ? 'すべて' : f === 'unchecked' ? '未訪問' : '訪問済み'}
              </button>
            ))}
          </div>
        )}
        {view === 'list' && (
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="銭湯名・住所で検索..."
            className="mt-2 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-teal-400"
            style={{ backgroundColor: 'white', color: 'black' }}
          />
        )}
      </header>

      {/* 地図表示 */}
      {view === 'map' && (
        <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!}>
          <div style={{ height: 'calc(100vh - 120px)' }}>
            <Map
              defaultCenter={{ lat: 35.6762, lng: 139.6503 }}
              defaultZoom={11}
            >
              {mapSentos.map(s => (
                <Marker
                  key={s.id}
                  position={{ lat: s.lat, lng: s.lng }}
                  onClick={() => setSelected(s)}
                  label="♨"
                />
              ))}
              {selected && (
                <InfoWindow
                  position={{ lat: selected.lat, lng: selected.lng }}
                  onCloseClick={() => setSelected(null)}
                >
                  <div className="p-1 min-w-32">
                    <h3 className="font-bold text-sm">{selected.name}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">{selected.address}</p>
                    {selected.open_hours && (
                      <p className="text-xs text-gray-400">{selected.open_hours}</p>
                    )}
                    <button
                      onClick={() => { toggleCheck(selected.id); setSelected(null) }}
                      className={`mt-2 w-full text-xs py-1 rounded-full font-medium ${
                        checked.has(selected.id)
                          ? 'bg-gray-100 text-gray-500'
                          : 'bg-teal-500 text-white'
                      }`}
                    >
                      {checked.has(selected.id) ? '✓ 訪問済み' : '行った！'}
                    </button>
                  </div>
                </InfoWindow>
              )}
            </Map>
          </div>
        </APIProvider>
      )}

      {/* リスト表示 */}
      {view === 'list' && (
        <div>
          {recommended.length > 0 && (
            <div className="px-4 pt-4">
              <h2 className="text-sm font-bold text-gray-700 mb-2">🎯 今日のおすすめ</h2>
              <div className="flex flex-col gap-2 mb-4">
                {recommended.map(s => (
                  <div
                    key={s.id}
                    onClick={() => toggleCheck(s.id)}
                    className="bg-teal-500 rounded-xl p-4 flex items-center gap-3 cursor-pointer"
                  >
                    <span className="text-2xl">♨</span>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-sm text-white">{s.name}</h3>
                      <p className="text-xs text-teal-100 truncate">{s.address}</p>
                      {s.open_hours && <p className="text-xs text-teal-100">{s.open_hours}</p>}
                    </div>
                    <span className="text-xs bg-white text-teal-600 px-2 py-0.5 rounded-full flex-shrink-0 font-bold">
                      行く！
                    </span>
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
                  <div
                    key={s.id}
                    onClick={() => toggleCheck(s.id)}
                    className={`bg-white rounded-xl p-4 border flex items-center gap-3 cursor-pointer transition-all ${
                      checked.has(s.id) ? 'border-teal-400 bg-teal-50' : 'border-gray-200'
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      checked.has(s.id) ? 'bg-teal-500 border-teal-500' : 'border-gray-300'
                    }`}>
                      {checked.has(s.id) && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className={`font-bold text-sm ${checked.has(s.id) ? 'text-teal-700' : 'text-gray-800'}`}>
                        {s.name}
                      </h2>
                      <p className="text-xs text-gray-400 truncate">{s.address}</p>
                      {s.open_hours && <p className="text-xs text-gray-400">{s.open_hours}</p>}
                    </div>
                    {checked.has(s.id) && (
                      <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full flex-shrink-0">
                        訪問済み
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  )
}