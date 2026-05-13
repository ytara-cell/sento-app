'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import { APIProvider, Map, InfoWindow, useMap } from '@vis.gl/react-google-maps'
import { MarkerClusterer, SuperClusterAlgorithm } from '@googlemaps/markerclusterer'
import type { Marker } from '@googlemaps/markerclusterer'

const FACILITIES = [
  { key: 'has_sauna',     label: 'サウナ',     icon: '🔥' },
  { key: 'has_mizuburo',  label: '水風呂',     icon: '❄️' },
  { key: 'has_shampoo',   label: 'アメニティ', icon: '🧴' },
  { key: 'has_rotenburo', label: '露天風呂',   icon: '🌿' },
  { key: 'has_towel',     label: 'タオル貸出', icon: '🏷️' },
]

function markerIcon(visited: boolean) {
  return {
    path: google.maps.SymbolPath.CIRCLE,
    scale: 7,
    fillColor: visited ? '#1565C0' : '#90CAF9',
    fillOpacity: 1,
    strokeColor: '#ffffff',
    strokeWeight: 2,
  }
}

function ClusteredMarkers({ sentos, checked, onSelect }: {
  sentos: any[]
  checked: Set<string>
  onSelect: (s: any) => void
}) {
  const map = useMap()
  const clustererRef = useRef<MarkerClusterer | null>(null)
  const markerMapRef = useRef<Record<string, google.maps.Marker>>({})

  // マップ初期化時にクラスタラー作成
  useEffect(() => {
    if (!map) return
    clustererRef.current = new MarkerClusterer({
      map,
      algorithm: new SuperClusterAlgorithm({ radius: 80 }),
    })
    return () => {
      clustererRef.current?.clearMarkers()
      Object.values(markerMapRef.current).forEach(m => m.setMap(null))
      markerMapRef.current = {}
    }
  }, [map])

  // sentos が変わったときだけマーカーを作り直す
  useEffect(() => {
    if (!clustererRef.current) return
    clustererRef.current.clearMarkers()
    Object.values(markerMapRef.current).forEach(m => m.setMap(null))
    markerMapRef.current = {}

    const newMarkers: google.maps.Marker[] = []
    for (const s of sentos) {
      const marker = new google.maps.Marker({
        position: { lat: s.lat, lng: s.lng },
        icon: markerIcon(checked.has(s.id)),
      })
      marker.addListener('click', () => onSelect(s))
      markerMapRef.current[s.id] = marker
      newMarkers.push(marker)
    }
    clustererRef.current.addMarkers(newMarkers as unknown as Marker[])
  }, [sentos])

  // checked が変わったときはアイコンだけ更新（全再作成しない）
  useEffect(() => {
    for (const [id, marker] of Object.entries(markerMapRef.current)) {
      marker.setIcon(markerIcon(checked.has(id)))
    }
  }, [checked])

  return null
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function Home() {
  const [sentos, setSentos] = useState<any[]>([])
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'unchecked' | 'checked' | 'no_card'>('all')
  const [view, setView] = useState<'list' | 'map' | 'area'>('list')
  const [areaFilter, setAreaFilter] = useState<string>('')
  const [facilityFilter, setFacilityFilter] = useState<string>('')
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null)
  const [locLoading, setLocLoading] = useState(false)
  const [sort, setSort] = useState<'default' | 'nearest'>('default')
  const [selected, setSelected] = useState<any>(null)
  const [search, setSearch] = useState('')
  const [detail, setDetail] = useState<any>(null)
  const [memo, setMemo] = useState('')
  const [savedMemo, setSavedMemo] = useState('')
  const [memoSaving, setMemoSaving] = useState(false)
  const [hasCard, setHasCard] = useState(false)
  const [cardCount, setCardCount] = useState(0)
  const [cardSet, setCardSet] = useState<Set<string>>(new Set())

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('sentos').select('*').order('name')
      setSentos(data ?? [])
      setLoading(false)
    }
    load()
    const saved = localStorage.getItem('checked_sentos')
    if (saved) setChecked(new Set(JSON.parse(saved)))
  }, [])

  useEffect(() => {
    async function loadCardCount() {
      const userKey = getUserKey()
      const { data, count } = await supabase
        .from('user_cards')
        .select('sento_id', { count: 'exact' })
        .eq('user_key', userKey)
        .eq('has_card', true)
      setCardCount(count ?? 0)
      setCardSet(new Set((data ?? []).map((d: any) => d.sento_id)))
    }
    loadCardCount()
  }, [])

  function calcDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLng = (lng2 - lng1) * Math.PI / 180
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  }

  function formatDist(m: number): string {
    return m < 1000 ? `${Math.round(m)}m` : `${(m / 1000).toFixed(1)}km`
  }

  function toggleNearest() {
    if (sort === 'nearest') { setSort('default'); return }
    setLocLoading(true)
    navigator.geolocation.getCurrentPosition(
      pos => {
        setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setSort('nearest')
        setLocLoading(false)
      },
      () => {
        alert('現在地を取得できませんでした。位置情報の許可を確認してください。')
        setLocLoading(false)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  function toggleCheck(id: string) {
    setChecked(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      localStorage.setItem('checked_sentos', JSON.stringify([...next]))
      return next
    })
  }

  function getUserKey() {
    let key = localStorage.getItem('user_key')
    if (!key) { key = Math.random().toString(36).slice(2); localStorage.setItem('user_key', key) }
    return key
  }

  useEffect(() => {
    const handler = () => setDetail(null)
    window.addEventListener('popstate', handler)
    return () => window.removeEventListener('popstate', handler)
  }, [])

  function closeDetail() {
    window.history.back()
  }

  async function openDetail(s: any) {
    window.history.pushState({ detail: s.id }, '')
    setDetail(s)
    setMemo('')
    setSavedMemo('')
    setHasCard(cardSet.has(s.id))
    const userKey = getUserKey()
    const { data } = await supabase
      .from('memos').select('body')
      .eq('sento_id', s.id).eq('user_key', userKey).single()
    if (data) { setMemo(data.body); setSavedMemo(data.body) }
  }

  async function saveMemo() {
    if (!detail) return
    setMemoSaving(true)
    const userKey = getUserKey()
    await supabase.from('memos').upsert(
      { sento_id: detail.id, user_key: userKey, body: memo, updated_at: new Date().toISOString() },
      { onConflict: 'sento_id,user_key' }
    )
    setSavedMemo(memo)
    setMemoSaving(false)
  }

  async function updateFacility(key: string, val: boolean | null) {
    if (!detail) return
    const updated = { ...detail, [key]: val }
    setDetail(updated)
    setSentos(prev => prev.map(s => s.id === detail.id ? { ...s, [key]: val } : s))
    await supabase.from('sentos').update({ [key]: val }).eq('id', detail.id)
  }

  async function toggleCard() {
    if (!detail) return
    const userKey = getUserKey()
    const newVal = !hasCard
    setHasCard(newVal)
    setCardCount(prev => newVal ? prev + 1 : Math.max(0, prev - 1))
    setCardSet(prev => {
      const next = new Set(prev)
      if (newVal) next.add(detail.id)
      else next.delete(detail.id)
      return next
    })
    await supabase.from('user_cards').upsert(
      { sento_id: detail.id, user_key: userKey, has_card: newVal },
      { onConflict: 'sento_id,user_key' }
    )
  }

  function extractArea(address: string): string {
    const m = address.match(/東京都(.+?[区市])/)
    return m ? m[1] : 'その他'
  }

  const areaStats = useMemo(() => {
    const rec: Record<string, { total: number; visited: number; card: number }> = {}
    for (const s of sentos) {
      const area = extractArea(s.address ?? '')
      if (!rec[area]) rec[area] = { total: 0, visited: 0, card: 0 }
      rec[area].total++
      if (checked.has(s.id)) rec[area].visited++
      if (cardSet.has(s.id)) rec[area].card++
    }
    return Object.entries(rec)
      .map(([name, stat]) => ({ name, ...stat }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ja'))
  }, [sentos, checked, cardSet])

  const filtered = sentos.filter(s => {
    const matchFilter =
      filter === 'checked' ? checked.has(s.id) :
      filter === 'unchecked' ? !checked.has(s.id) :
      filter === 'no_card' ? checked.has(s.id) && !cardSet.has(s.id) : true
    const matchSearch = search === '' || s.name.includes(search) || (s.address && s.address.includes(search))
    const matchArea = areaFilter === '' || extractArea(s.address ?? '') === areaFilter
    const matchFacility = facilityFilter === '' || s[facilityFilter] === true
    return matchFilter && matchSearch && matchArea && matchFacility
  }).map(s => ({
    ...s,
    _dist: (sort === 'nearest' && userLoc && s.lat && s.lng)
      ? calcDistance(userLoc.lat, userLoc.lng, s.lat, s.lng)
      : null
  })).sort((a, b) => {
    if (sort === 'nearest' && a._dist !== null && b._dist !== null) return a._dist - b._dist
    return 0
  })

  const recommended = sentos.filter(s => !checked.has(s.id)).sort(() => Math.random() - 0.5).slice(0, 3)
  const mapSentos = useMemo(() => {
  return sentos.filter(s => s.lat && s.lng);
}, [sentos]);
  const images = detail?.images ? (() => { try { return JSON.parse(detail.images) } catch { return [] } })() : []
  const pct = sentos.length ? Math.round((checked.size / sentos.length) * 100) : 0
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&family=Shippori+Mincho:wght@500;700&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; background: #F7F5F0; font-family: 'Noto Sans JP', sans-serif; }
        .app { min-height: 100vh; background: #F7F5F0; }
        .header { background: #1A1A2E; padding: 20px 20px 16px; position: sticky; top: 0; z-index: 10; }
        .header-top { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 14px; }
        .app-title { font-family: 'Shippori Mincho', serif; font-size: 22px; color: #E8E0D0; font-weight: 700; letter-spacing: 0.05em; }
        .app-subtitle { font-size: 12px; color: #8B8BA0; margin-top: 2px; letter-spacing: 0.03em; }
        .view-toggle { display: flex; background: #2A2A40; border-radius: 8px; overflow: hidden; }
        .view-btn { padding: 7px 14px; font-size: 12px; border: none; cursor: pointer; font-family: 'Noto Sans JP', sans-serif; font-weight: 500; transition: all 0.2s; color: #8B8BA0; background: transparent; }
        .view-btn.active { background: #C5A55A; color: #1A1A2E; }
        .progress-track { height: 3px; background: #2A2A40; border-radius: 2px; margin-bottom: 14px; overflow: hidden; }
        .progress-fill { height: 100%; background: linear-gradient(90deg, #C5A55A, #E8C87A); border-radius: 2px; transition: width 0.5s ease; }
        .filter-row { display: flex; gap: 6px; margin-bottom: 10px; flex-wrap: wrap; }
        .filter-btn { padding: 5px 10px; border-radius: 20px; font-size: 11px; font-weight: 500; border: 1px solid #3A3A50; cursor: pointer; font-family: 'Noto Sans JP', sans-serif; transition: all 0.2s; background: transparent; color: #8B8BA0; white-space: nowrap; }
        .filter-btn.active { background: #C5A55A; color: #1A1A2E; border-color: #C5A55A; }
        .search-box { width: 100%; background: #2A2A40; border: none; border-radius: 8px; padding: 9px 14px; font-size: 13px; color: #E8E0D0; font-family: 'Noto Sans JP', sans-serif; outline: none; }
        .search-box::placeholder { color: #5A5A70; }
        .section-label { font-size: 11px; font-weight: 700; color: #8B8050; letter-spacing: 0.1em; text-transform: uppercase; padding: 18px 20px 10px; }
        .rec-card { margin: 0 16px 10px; background: linear-gradient(135deg, #2A1F3D, #1A2840); border-radius: 14px; padding: 16px; display: flex; align-items: center; gap: 12px; cursor: pointer; border: 1px solid #3A3060; position: relative; overflow: hidden; }
        .rec-card::before { content: '♨'; position: absolute; right: -10px; top: -10px; font-size: 60px; opacity: 0.06; pointer-events: none; }
        .rec-card-body { flex: 1; min-width: 0; }
        .rec-card-name { font-family: 'Shippori Mincho', serif; font-size: 15px; font-weight: 700; color: #E8E0D0; margin-bottom: 3px; }
        .rec-card-addr { font-size: 11px; color: #7A7A90; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .rec-badge { background: #C5A55A; color: #1A1A2E; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 20px; flex-shrink: 0; }
        .list-wrap { padding: 0 16px 100px; display: flex; flex-direction: column; gap: 8px; }
        .sento-card { background: white; border-radius: 12px; padding: 14px 16px; display: flex; align-items: center; gap: 12px; border: 1px solid #ECEAE4; transition: all 0.2s; }
        .sento-card.visited { background: #F0FAF5; border-color: #A8D8C0; }
        .check-circle { width: 24px; height: 24px; border-radius: 50%; border: 2px solid #D0CEC8; display: flex; align-items: center; justify-content: center; flex-shrink: 0; cursor: pointer; transition: all 0.2s; background: white; }
        .check-circle.done { background: #2D9E6A; border-color: #2D9E6A; }
        .check-icon { color: white; font-size: 12px; font-weight: 700; }
        .card-body { flex: 1; min-width: 0; cursor: pointer; }
        .card-name { font-family: 'Shippori Mincho', serif; font-size: 14px; font-weight: 700; color: #1A1A2E; margin-bottom: 2px; }
        .card-name.visited { color: #2D9E6A; }
        .card-addr { font-size: 11px; color: #9A9890; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .card-hours { font-size: 11px; color: #B0AEA8; margin-top: 1px; }
        .visited-tag { font-size: 10px; background: #E8F5EE; color: #2D9E6A; padding: 3px 8px; border-radius: 10px; flex-shrink: 0; font-weight: 500; }
        .dist-tag { font-size: 10px; background: #EEF2FF; color: #1565C0; padding: 3px 8px; border-radius: 10px; flex-shrink: 0; font-weight: 700; }
        .loading { text-align: center; padding: 60px 20px; color: #9A9890; font-size: 14px; }
        .overlay { position: fixed; inset: 0; z-index: 50; display: flex; align-items: flex-end; justify-content: center; background: rgba(10,10,20,0.7); backdrop-filter: blur(4px); }
        .popup { background: #F7F5F0; width: 100%; max-width: 480px; border-radius: 20px 20px 0 0; overflow-y: auto; max-height: 88vh; }
        .popup-drag { width: 36px; height: 4px; background: #D0CEC8; border-radius: 2px; margin: 12px auto 0; }
        .popup-images { display: flex; overflow-x: auto; gap: 8px; padding: 12px 16px; scroll-snap-type: x mandatory; }
        .popup-images::-webkit-scrollbar { display: none; }
        .popup-img-wrap { flex-shrink: 0; width: 260px; height: 160px; border-radius: 12px; overflow: hidden; scroll-snap-align: start; background: #E8E4DC; display: flex; align-items: center; justify-content: center; }
        .popup-img-wrap img { width: 100%; height: 100%; object-fit: cover; }
        .popup-no-img { width: 100%; height: 120px; background: #E8E4DC; display: flex; align-items: center; justify-content: center; font-size: 40px; color: #C0BCB4; margin-top: 12px; }
        .popup-body { padding: 0 20px 32px; }
        .popup-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 16px; }
        .popup-name { font-family: 'Shippori Mincho', serif; font-size: 22px; font-weight: 700; color: #1A1A2E; line-height: 1.3; }
        .popup-addr { font-size: 12px; color: #9A9890; margin-top: 3px; }
        .checkin-btn { flex-shrink: 0; margin-left: 12px; padding: 8px 16px; border-radius: 20px; font-size: 13px; font-weight: 700; border: none; cursor: pointer; font-family: 'Noto Sans JP', sans-serif; transition: all 0.2s; }
        .checkin-btn.done { background: #2D9E6A; color: white; }
        .checkin-btn.todo { background: #1A1A2E; color: #C5A55A; }
        .info-grid { background: white; border-radius: 12px; padding: 14px; margin-bottom: 16px; display: flex; flex-direction: column; gap: 8px; border: 1px solid #ECEAE4; }
        .info-row { display: flex; gap: 10px; font-size: 13px; }
        .info-label { color: #B0AEA8; width: 56px; flex-shrink: 0; }
        .info-val { color: #1A1A2E; }
        .info-link { color: #C5A55A; text-decoration: none; }
        .desc-text { font-size: 13px; color: #5A5850; line-height: 1.7; margin-bottom: 16px; }
        .section-title { font-size: 12px; font-weight: 700; color: #8B8050; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 8px; }
        .memo-area { width: 100%; background: white; border: 1px solid #ECEAE4; border-radius: 10px; padding: 12px; font-size: 13px; color: #1A1A2E; font-family: 'Noto Sans JP', sans-serif; resize: none; outline: none; line-height: 1.6; }
        .memo-area:focus { border-color: #C5A55A; }
        .save-btn { width: 100%; margin-top: 8px; padding: 11px; border-radius: 10px; font-size: 13px; font-weight: 700; border: none; cursor: pointer; font-family: 'Noto Sans JP', sans-serif; transition: all 0.2s; }
        .save-btn.active { background: #1A1A2E; color: #C5A55A; }
        .save-btn.saved { background: #F0EDE8; color: #B0AEA8; cursor: default; }
        .card-toggle-btn { width: 100%; padding: 13px; border-radius: 12px; font-size: 13px; font-weight: 700; cursor: pointer; font-family: 'Noto Sans JP', sans-serif; transition: all 0.2s; }
        .card-toggle-btn.has { background: #1A1A2E; color: #C5A55A; border: 2px solid #C5A55A; }
        .card-toggle-btn.none { background: white; color: #9A9890; border: 1px solid #ECEAE4; }
        .close-btn { width: 100%; margin-top: 10px; padding: 13px; border-radius: 12px; font-size: 13px; font-weight: 500; border: 1px solid #ECEAE4; cursor: pointer; font-family: 'Noto Sans JP', sans-serif; background: white; color: #9A9890; }
        .fac-badges { display: flex; gap: 4px; margin-top: 4px; flex-wrap: wrap; }
        .fac-badge { font-size: 14px; }
        .fac-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
        .fac-toggle { display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 10px 6px; border-radius: 10px; border: 1.5px solid #ECEAE4; cursor: pointer; font-family: 'Noto Sans JP', sans-serif; background: white; transition: all 0.2s; }
        .fac-toggle.yes { background: #E8F5EE; border-color: #2D9E6A; }
        .fac-toggle.no  { background: #F5F5F5; border-color: #D0CEC8; opacity: 0.6; }
        .fac-toggle.unknown { background: white; border-color: #ECEAE4; }
        .fac-toggle-icon { font-size: 20px; }
        .fac-toggle-label { font-size: 10px; color: #5A5850; font-weight: 500; }
        .fac-toggle-state { font-size: 11px; font-weight: 700; color: #2D9E6A; }
        .fac-toggle.no .fac-toggle-state { color: #B0AEA8; }
        .fac-toggle.unknown .fac-toggle-state { color: #C0BCB4; }
        .area-card { background: white; border-radius: 12px; padding: 14px 16px; cursor: pointer; border: 1px solid #ECEAE4; transition: all 0.2s; }
        .area-card:active { transform: scale(0.98); }
        .area-name { font-family: 'Shippori Mincho', serif; font-size: 15px; font-weight: 700; color: #1A1A2E; }
        .area-count { font-size: 12px; color: #9A9890; }
        .area-track { height: 6px; background: #F0EDE8; border-radius: 3px; overflow: hidden; }
        .area-fill { height: 100%; background: linear-gradient(90deg, #C5A55A, #E8C87A); border-radius: 3px; transition: width 0.5s ease; }
        .area-pct { font-size: 11px; color: #9A9890; }
        .area-link { font-size: 11px; color: #C5A55A; }
      `}</style>

      <div className="app">
        <div className="header">
          <div className="header-top">
            <div>
              <div className="app-title">♨ 銭湯めぐり</div>
              <div className="app-subtitle">{checked.size} / {sentos.length} 軒制覇　{pct > 0 ? `${pct}%` : ''}　🎴 {cardCount}枚</div>
            </div>
            <div className="view-toggle">
              <button className={`view-btn ${view === 'list' ? 'active' : ''}`} onClick={() => setView('list')}>リスト</button>
              <button className={`view-btn ${view === 'map' ? 'active' : ''}`} onClick={() => setView('map')}>地図</button>
              <button className={`view-btn ${view === 'area' ? 'active' : ''}`} onClick={() => setView('area')}>エリア</button>
            </div>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${pct}%` }} />
          </div>
          {view === 'list' && (
            <>
              {areaFilter && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: '#C5A55A', background: '#2A2A40', padding: '4px 10px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 6 }}>
                    📍 {areaFilter}
                    <button onClick={() => setAreaFilter('')} style={{ background: 'none', border: 'none', color: '#8B8BA0', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0 }}>✕</button>
                  </span>
                </div>
              )}
              <div className="filter-row">
                {(['all', 'unchecked', 'checked', 'no_card'] as const).map(f => (
                  <button key={f} className={`filter-btn ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
                    {f === 'all' ? 'すべて' : f === 'unchecked' ? '未訪問' : f === 'checked' ? '訪問済み' : '🎴未取得'}
                  </button>
                ))}
                <button className={`filter-btn ${sort === 'nearest' ? 'active' : ''}`} onClick={toggleNearest} disabled={locLoading}>
                  {locLoading ? '取得中...' : '📍 近い順'}
                </button>
              </div>
              <div className="filter-row">
                {FACILITIES.map(f => (
                  <button key={f.key} className={`filter-btn ${facilityFilter === f.key ? 'active' : ''}`}
                    onClick={() => setFacilityFilter(prev => prev === f.key ? '' : f.key)}>
                    {f.icon} {f.label}
                  </button>
                ))}
              </div>
              <input className="search-box" type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="銭湯名・住所で検索..." />
            </>
          )}
        </div>

        {view === 'area' && (
          <div style={{ padding: '0 16px 100px' }}>
            <div className="section-label" style={{ paddingLeft: 0 }}>エリア別進捗 ({areaStats.length}エリア)</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {areaStats.map(a => {
                const pct = a.total ? Math.round((a.visited / a.total) * 100) : 0
                return (
                  <div key={a.name} className="area-card" onClick={() => { setAreaFilter(a.name); setView('list') }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                      <span className="area-name">{a.name}</span>
                      <span className="area-count">{a.visited} / {a.total} 軒　🎴 {a.card}</span>
                    </div>
                    <div className="area-track">
                      <div className="area-fill" style={{ width: `${pct}%` }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                      <span className="area-pct">{pct}% 制覇</span>
                      <span className="area-link">リストを見る →</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
        {view === 'map' && (
          <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!}>
            <div style={{ height: 'calc(100vh - 90px)' }}>
              <Map
                defaultCenter={{ lat: 35.6762, lng: 139.6503 }}
                defaultZoom={13}
                gestureHandling="greedy"
              >
                <ClusteredMarkers sentos={filtered.filter(s => s.lat && s.lng)} checked={checked} onSelect={setSelected} />
                {selected && (
                  <InfoWindow position={{ lat: selected.lat, lng: selected.lng }} onCloseClick={() => setSelected(null)}>
                    <div style={{ padding: 4, minWidth: 120 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: '#0c0c0b' }}>{selected.name}</div>
                      <div style={{ fontSize: 11, color: '#111010', marginTop: 2 }}>{selected.address}</div>
                      <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                        <button onClick={() => { toggleCheck(selected.id); setSelected(null) }} style={{ flex: 1, fontSize: 11, padding: '4px 0', borderRadius: 20, border: 'none', background: checked.has(selected.id) ? '#eee' : '#2D9E6A', color: checked.has(selected.id) ? '#888' : 'white', cursor: 'pointer', fontWeight: 700 }}>
                          {checked.has(selected.id) ? '✓ 訪問済み' : '行った！'}
                        </button>
                        <button onClick={() => { openDetail(selected); setSelected(null) }} style={{ flex: 1, fontSize: 11, padding: '4px 0', borderRadius: 20, border: 'none', background: '#1A1A2E', color: '#C5A55A', cursor: 'pointer', fontWeight: 700 }}>
                          詳細
                        </button>
                      </div>
                    </div>
                  </InfoWindow>
                )}
              </Map>
            </div>
          </APIProvider>
        )}
        {view === 'list' && (
          <>
            {recommended.length > 0 && (
              <>
                <div className="section-label">今日のおすすめ</div>
                {recommended.map(s => (
                  <div key={s.id} className="rec-card" onClick={() => openDetail(s)}>
                    <div className="rec-card-body">
                      <div className="rec-card-name">{s.name}</div>
                      <div className="rec-card-addr">{s.address}</div>
                    </div>
                    <div className="rec-badge" onClick={e => { e.stopPropagation(); openDetail(s) }}>詳細 →</div>
                  </div>
                ))}
                <div className="section-label">銭湯リスト</div>
              </>
            )}
            {loading ? (
              <div className="loading">読み込み中...</div>
            ) : (
              <div className="list-wrap">
                {filtered.map(s => (
                  <div key={s.id} className={`sento-card ${checked.has(s.id) ? 'visited' : ''}`}>
                    <div className={`check-circle ${checked.has(s.id) ? 'done' : ''}`} onClick={() => toggleCheck(s.id)}>
                      {checked.has(s.id) && <span className="check-icon">✓</span>}
                    </div>
                    <div className="card-body" onClick={() => openDetail(s)}>
                      <div className={`card-name ${checked.has(s.id) ? 'visited' : ''}`}>{s.name}</div>
                      <div className="card-addr">{s.address}</div>
                      {s.open_hours && <div className="card-hours">{s.open_hours}</div>}
                      {FACILITIES.some(f => s[f.key] === true) && (
                        <div className="fac-badges">
                          {FACILITIES.filter(f => s[f.key] === true).map(f => (
                            <span key={f.key} className="fac-badge">{f.icon}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    {s._dist !== null && <span className="dist-tag">{formatDist(s._dist)}</span>}
                    {checked.has(s.id) && <span className="visited-tag">訪問済み</span>}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {detail && (
        <div className="overlay" onClick={closeDetail}>
          <div className="popup" onClick={e => e.stopPropagation()}>
            <div className="popup-drag" />
            {images.length > 0 ? (
              <div className="popup-images">
                {images.map((img: string, idx: number) => (
                  <div key={idx} className="popup-img-wrap">
                    <img src={img} alt={`${detail.name} ${idx + 1}`} onError={e => (e.currentTarget.parentElement!.style.display = 'none')} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="popup-no-img">♨</div>
            )}
            <div className="popup-body">
              <div className="popup-header">
                <div>
                  <div className="popup-name">{detail.name}</div>
                  <div className="popup-addr">{detail.address}</div>
                </div>
                <button className={`checkin-btn ${checked.has(detail.id) ? 'done' : 'todo'}`} onClick={() => toggleCheck(detail.id)}>
                  {checked.has(detail.id) ? '✓ 訪問済み' : '行った！'}
                </button>
              </div>
              <div className="info-grid">
                {detail.open_hours && <div className="info-row"><span className="info-label">営業時間</span><span className="info-val">{detail.open_hours}</span></div>}
                {detail.closed_days && <div className="info-row"><span className="info-label">定休日</span><span className="info-val">{detail.closed_days}</span></div>}
                {detail.phone && <div className="info-row"><span className="info-label">電話</span><a className="info-link" href={`tel:${detail.phone}`}>{detail.phone}</a></div>}
                {detail.price_adult && <div className="info-row"><span className="info-label">料金</span><span className="info-val">大人 ¥{detail.price_adult}</span></div>}
                {detail.website && <div className="info-row"><span className="info-label">公式HP</span><a className="info-link" href={detail.website} target="_blank" rel="noreferrer">リンク →</a></div>}
              </div>
              {detail.description && <div className="desc-text">{detail.description}</div>}
              <div style={{ marginBottom: 16 }}>
                <div className="section-title">🏨 設備情報</div>
                <div className="fac-grid">
                  {FACILITIES.map(f => {
                    const val = detail[f.key] as boolean | null | undefined
                    const next = val === null || val === undefined ? true : val === true ? false : null
                    return (
                      <button key={f.key}
                        className={`fac-toggle ${val === true ? 'yes' : val === false ? 'no' : 'unknown'}`}
                        onClick={() => updateFacility(f.key, next)}>
                        <span className="fac-toggle-icon">{f.icon}</span>
                        <span className="fac-toggle-label">{f.label}</span>
                        <span className="fac-toggle-state">{val === true ? 'あり' : val === false ? 'なし' : '?'}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <div className="section-title">🎴 コレクションカード</div>
                <button className={`card-toggle-btn ${hasCard ? 'has' : 'none'}`} onClick={toggleCard}>
                  {hasCard ? '🎴 カード保有中' : 'カードを持っていない'}
                </button>
              </div>
              <div style={{ marginBottom: 16 }}>
                <div className="section-title">📝 一言メモ</div>
                <textarea className="memo-area" value={memo} onChange={e => setMemo(e.target.value)} placeholder="この銭湯の感想を書いてみよう..." rows={3} />
                {memo.length > 0 && (
                  <button className={`save-btn ${memo === savedMemo ? 'saved' : 'active'}`} onClick={saveMemo} disabled={memoSaving || memo === savedMemo}>
                    {memoSaving ? '保存中...' : memo === savedMemo ? '保存済み ✓' : 'メモを保存'}
                  </button>
                )}
              </div>
              {detail.lat && detail.lng && (
  <button
    className="close-btn"
    style={{ marginBottom: 6, background: '#1A1A2E', color: '#C5A55A', border: 'none' }}
    onClick={() => {
      setView('map')
      setSelected(detail)
      closeDetail()
    }}
  >
    🗺 地図で見る
  </button>
)}
              <button className="close-btn" onClick={closeDetail}>閉じる</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}