'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import { APIProvider, Map, InfoWindow, useMap } from '@vis.gl/react-google-maps'
import { MarkerClusterer, SuperClusterAlgorithm } from '@googlemaps/markerclusterer'
import type { Marker } from '@googlemaps/markerclusterer'

const STOCK_LEVELS = [
  { key: 'abundant', label: '潤沢', color: '#22A06B', bg: '#E6F6F0' },
  { key: 'normal',   label: '普通', color: '#2A90BF', bg: '#E0F3FB' },
  { key: 'scarce',   label: '僅少', color: '#E07A10', bg: '#FFF3E0' },
  { key: 'soldout',  label: '売切', color: '#D94040', bg: '#FFECEC' },
]

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
  const [filter, setFilter] = useState<'all' | 'unchecked' | 'checked' | 'no_card' | 'favorite'>('all')
  const [view, setView] = useState<'list' | 'map' | 'area'>('list')
  const [areaFilter, setAreaFilter] = useState<string>('')
  const [facilityFilter, setFacilityFilter] = useState<string>('')
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null)
  const [locLoading, setLocLoading] = useState(false)
  const [sort, setSort] = useState<'default' | 'nearest' | 'popular'>('default')
  const [selected, setSelected] = useState<any>(null)
  const [search, setSearch] = useState('')
  const [detail, setDetail] = useState<any>(null)
  const [memo, setMemo] = useState('')
  const [savedMemo, setSavedMemo] = useState('')
  const [memoSaving, setMemoSaving] = useState(false)
  const [hasCard, setHasCard] = useState(false)
  const [cardCount, setCardCount] = useState(0)
  const [cardSet, setCardSet] = useState<Set<string>>(new Set())
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [stockLatest, setStockLatest] = useState<{ level: string; reported_at: string } | null>(null)
  const [myStock, setMyStock] = useState<string | null>(null)
  const [stockReporting, setStockReporting] = useState(false)
  const [visitCounts, setVisitCounts] = useState<Record<string, number>>({})

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('sentos').select('*').order('name')
      setSentos(data ?? [])
      setLoading(false)
    }
    load()
    const saved = localStorage.getItem('checked_sentos')
    if (saved) setChecked(new Set(JSON.parse(saved)))
    const savedFav = localStorage.getItem('favorite_sentos')
    if (savedFav) setFavorites(new Set(JSON.parse(savedFav)))
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

  useEffect(() => {
    async function loadVisitCounts() {
      const { data } = await supabase.from('visit_logs').select('sento_id')
      const counts: Record<string, number> = {}
      for (const row of data ?? []) {
        counts[row.sento_id] = (counts[row.sento_id] ?? 0) + 1
      }
      setVisitCounts(counts)
    }
    loadVisitCounts()
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

  function toggleFavorite(id: string) {
    setFavorites(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      localStorage.setItem('favorite_sentos', JSON.stringify([...next]))
      return next
    })
  }

  function toggleCheck(id: string) {
    const userKey = getUserKey()
    setChecked(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
        supabase.from('visit_logs').delete().eq('sento_id', id).eq('user_key', userKey).then()
        setVisitCounts(c => { const n = { ...c }; if (n[id] > 1) n[id]--; else delete n[id]; return n })
      } else {
        next.add(id)
        supabase.from('visit_logs').upsert({ sento_id: id, user_key: userKey, visited_at: new Date().toISOString() }, { onConflict: 'sento_id,user_key' }).then()
        setVisitCounts(c => ({ ...c, [id]: (c[id] ?? 0) + 1 }))
      }
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

  function formatRelativeTime(isoStr: string): string {
    const diff = Date.now() - new Date(isoStr).getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    if (hours < 1) return 'たった今'
    if (hours < 24) return `${hours}時間前`
    const days = Math.floor(hours / 24)
    return `${days}日前`
  }

  async function openDetail(s: any) {
    window.history.pushState({ detail: s.id }, '')
    setDetail(s)
    setMemo('')
    setSavedMemo('')
    setHasCard(cardSet.has(s.id))
    setStockLatest(null)
    setMyStock(null)
    const userKey = getUserKey()
    const [memoRes, stockLatestRes, myStockRes] = await Promise.all([
      supabase.from('memos').select('body').eq('sento_id', s.id).eq('user_key', userKey).maybeSingle(),
      supabase.from('card_stock_reports').select('stock_level, reported_at').eq('sento_id', s.id).order('reported_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('card_stock_reports').select('stock_level').eq('sento_id', s.id).eq('user_key', userKey).maybeSingle(),
    ])
    if (memoRes.data) { setMemo(memoRes.data.body); setSavedMemo(memoRes.data.body) }
    if (stockLatestRes.data) setStockLatest({ level: stockLatestRes.data.stock_level, reported_at: stockLatestRes.data.reported_at })
    if (myStockRes.data) setMyStock(myStockRes.data.stock_level)
  }

  async function reportStock(level: string) {
    if (!detail || stockReporting) return
    setStockReporting(true)
    const userKey = getUserKey()
    const now = new Date().toISOString()
    await supabase.from('card_stock_reports').upsert(
      { sento_id: detail.id, user_key: userKey, stock_level: level, reported_at: now },
      { onConflict: 'sento_id,user_key' }
    )
    setMyStock(level)
    setStockLatest({ level, reported_at: now })
    setStockReporting(false)
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
      filter === 'no_card' ? checked.has(s.id) && !cardSet.has(s.id) :
      filter === 'favorite' ? favorites.has(s.id) : true
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
    if (sort === 'popular') return (visitCounts[b.id] ?? 0) - (visitCounts[a.id] ?? 0)
    return 0
  })

  const recommended = sentos.filter(s => !checked.has(s.id)).sort(() => Math.random() - 0.5).slice(0, 6)
  const mapSentos = useMemo(() => {
  return sentos.filter(s => s.lat && s.lng);
}, [sentos]);
  const images = detail?.images ? (() => { try { return JSON.parse(detail.images) } catch { return [] } })() : []
  const pct = sentos.length ? Math.round((checked.size / sentos.length) * 100) : 0
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=M+PLUS+Rounded+1c:wght@400;500;700&family=Raleway:wght@700;800&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; background: #EDF6FB; font-family: 'M PLUS Rounded 1c', sans-serif; }
        .app { min-height: 100vh; background: #EDF6FB; }

        /* ヘッダー */
        .header { background: #ffffff; padding: 16px 20px 14px; position: sticky; top: 0; z-index: 10; border-bottom: 1.5px solid #C8E8F5; box-shadow: 0 2px 10px rgba(74,168,212,0.08); }
        .header-top { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 12px; }
        .app-title { font-size: 17px; color: #2A90BF; font-weight: 800; letter-spacing: 0.05em; white-space: nowrap; font-family: 'Raleway', sans-serif; }
        .app-subtitle { font-size: 11px; color: #7BBCD8; margin-top: 2px; }
        .view-toggle { display: flex; background: #E0F3FB; border-radius: 10px; overflow: hidden; gap: 2px; padding: 3px; flex-shrink: 0; }
        .view-btn { padding: 5px 10px; font-size: 12px; border: none; cursor: pointer; font-family: 'M PLUS Rounded 1c', sans-serif; font-weight: 500; transition: all 0.2s; color: #7BBCD8; background: transparent; border-radius: 8px; white-space: nowrap; }
        .view-btn.active { background: #4AADCF; color: #ffffff; }
        .progress-track { height: 5px; background: #D8EEF8; border-radius: 3px; margin-bottom: 12px; overflow: hidden; }
        .progress-fill { height: 100%; background: linear-gradient(90deg, #4AADCF, #7DD6EE); border-radius: 3px; transition: width 0.5s ease; }
        .filter-row { display: flex; gap: 6px; margin-bottom: 8px; overflow-x: auto; -webkit-overflow-scrolling: touch; flex-wrap: nowrap; padding-bottom: 2px; }
        .filter-row::-webkit-scrollbar { display: none; }
        .filter-btn { padding: 5px 12px; border-radius: 20px; font-size: 11px; font-weight: 500; border: 1.5px solid #C8E8F5; cursor: pointer; font-family: 'M PLUS Rounded 1c', sans-serif; transition: all 0.2s; background: #ffffff; color: #7BBCD8; white-space: nowrap; flex-shrink: 0; }
        .filter-btn.active { background: #4AADCF; color: #ffffff; border-color: #4AADCF; }
        .search-box { width: 100%; background: #F0F9FD; border: 1.5px solid #C8E8F5; border-radius: 10px; padding: 9px 14px; font-size: 13px; color: #2A6080; font-family: 'M PLUS Rounded 1c', sans-serif; outline: none; }
        .search-box:focus { border-color: #4AADCF; }
        .search-box::placeholder { color: #A8D4E8; }

        /* セクション */
        .section-label { font-size: 11px; font-weight: 700; color: #7BBCD8; letter-spacing: 0.08em; padding: 18px 20px 10px; }

        /* おすすめカード */
        .rec-scroll { display: flex; gap: 12px; padding: 4px 16px 16px; overflow-x: auto; scroll-snap-type: x mandatory; -webkit-overflow-scrolling: touch; }
        .rec-scroll::-webkit-scrollbar { display: none; }
        .rec-card { flex-shrink: 0; width: 148px; border-radius: 16px; overflow: hidden; cursor: pointer; background: #ffffff; scroll-snap-align: start; box-shadow: 0 3px 12px rgba(74,168,212,0.15); border: 1px solid #D8EEF8; }
        .rec-card-img { width: 148px; height: 108px; object-fit: cover; display: block; }
        .rec-card-placeholder { width: 148px; height: 108px; background: linear-gradient(135deg, #C8E8F5, #A0D4EE); display: flex; align-items: center; justify-content: center; font-size: 36px; }
        .rec-card-body { padding: 8px 10px 10px; background: #ffffff; }
        .rec-card-name { font-size: 12px; font-weight: 700; color: #2A6080; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .rec-card-addr { font-size: 10px; color: #9ABFD4; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

        /* リスト */
        .list-wrap { padding: 0 14px 100px; display: flex; flex-direction: column; gap: 8px; }
        .sento-card { background: #ffffff; border-radius: 14px; padding: 13px 14px; display: flex; align-items: center; gap: 12px; border: 1px solid #D8EEF8; transition: all 0.2s; box-shadow: 0 1px 4px rgba(74,168,212,0.07); }
        .sento-card.visited { background: #F0FBFF; border-color: #8ED4EE; }
        .check-circle { width: 24px; height: 24px; border-radius: 50%; border: 2px solid #C8E8F5; display: flex; align-items: center; justify-content: center; flex-shrink: 0; cursor: pointer; transition: all 0.2s; background: white; }
        .check-circle.done { background: #4AADCF; border-color: #4AADCF; }
        .check-icon { color: white; font-size: 12px; font-weight: 700; }
        .card-body { flex: 1; min-width: 0; cursor: pointer; }
        .card-name { font-size: 14px; font-weight: 700; color: #1E4A60; margin-bottom: 2px; }
        .card-name.visited { color: #4AADCF; }
        .card-addr { font-size: 11px; color: #9ABFD4; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .card-hours { font-size: 11px; color: #B0D4E4; margin-top: 1px; }
        .visited-tag { font-size: 10px; background: #E0F6FF; color: #4AADCF; padding: 3px 8px; border-radius: 10px; flex-shrink: 0; font-weight: 700; }
        .dist-tag { font-size: 10px; background: #E8F0FF; color: #5585C0; padding: 3px 8px; border-radius: 10px; flex-shrink: 0; font-weight: 700; }
        .popular-tag { font-size: 10px; background: #FFF3E0; color: #E07A10; padding: 3px 8px; border-radius: 10px; flex-shrink: 0; font-weight: 700; }
        .fav-btn { background: none; border: none; font-size: 16px; cursor: pointer; color: #C8E0EA; padding: 0 2px; flex-shrink: 0; line-height: 1; }
        .fav-btn.on { color: #F5C842; }
        .fav-btn-lg { background: none; border: none; font-size: 24px; cursor: pointer; color: #C8E0EA; padding: 0; line-height: 1; flex-shrink: 0; }
        .fav-btn-lg.on { color: #F5C842; }
        .loading { text-align: center; padding: 60px 20px; color: #9ABFD4; font-size: 14px; }

        /* ポップアップ */
        .overlay { position: fixed; inset: 0; z-index: 50; display: flex; align-items: flex-end; justify-content: center; background: rgba(30,74,96,0.5); backdrop-filter: blur(6px); }
        .popup { background: #F2FAFD; width: 100%; max-width: 480px; border-radius: 24px 24px 0 0; overflow-y: auto; max-height: 88vh; }
        .popup-drag { width: 40px; height: 4px; background: #C8E8F5; border-radius: 2px; margin: 14px auto 0; }
        .popup-images { display: flex; overflow-x: auto; gap: 8px; padding: 12px 16px; scroll-snap-type: x mandatory; }
        .popup-images::-webkit-scrollbar { display: none; }
        .popup-img-wrap { flex-shrink: 0; width: 260px; height: 160px; border-radius: 14px; overflow: hidden; scroll-snap-align: start; background: #D8EEF8; display: flex; align-items: center; justify-content: center; }
        .popup-img-wrap img { width: 100%; height: 100%; object-fit: cover; }
        .popup-no-img { width: 100%; height: 120px; background: linear-gradient(135deg, #C8E8F5, #A0D4EE); display: flex; align-items: center; justify-content: center; font-size: 44px; margin-top: 12px; }
        .popup-body { padding: 0 20px 32px; }
        .popup-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 16px; }
        .popup-name { font-size: 20px; font-weight: 700; color: #1E4A60; line-height: 1.3; }
        .popup-addr { font-size: 12px; color: #9ABFD4; margin-top: 3px; }
        .checkin-btn { flex-shrink: 0; margin-left: 12px; padding: 8px 16px; border-radius: 20px; font-size: 13px; font-weight: 700; border: none; cursor: pointer; font-family: 'M PLUS Rounded 1c', sans-serif; transition: all 0.2s; }
        .checkin-btn.done { background: #4AADCF; color: white; }
        .checkin-btn.todo { background: #E0F6FF; color: #4AADCF; border: 1.5px solid #4AADCF; }
        .info-grid { background: white; border-radius: 14px; padding: 14px; margin-bottom: 16px; display: flex; flex-direction: column; gap: 8px; border: 1px solid #D8EEF8; }
        .info-row { display: flex; gap: 10px; font-size: 13px; }
        .info-label { color: #9ABFD4; width: 56px; flex-shrink: 0; }
        .info-val { color: #1E4A60; }
        .info-link { color: #4AADCF; text-decoration: none; }
        .desc-text { font-size: 13px; color: #5A90A8; line-height: 1.8; margin-bottom: 16px; }
        .section-title { font-size: 11px; font-weight: 700; color: #7BBCD8; letter-spacing: 0.06em; margin-bottom: 8px; }
        .memo-area { width: 100%; background: white; border: 1.5px solid #D8EEF8; border-radius: 12px; padding: 12px; font-size: 13px; color: #1E4A60; font-family: 'M PLUS Rounded 1c', sans-serif; resize: none; outline: none; line-height: 1.7; }
        .memo-area:focus { border-color: #4AADCF; }
        .save-btn { width: 100%; margin-top: 8px; padding: 11px; border-radius: 12px; font-size: 13px; font-weight: 700; border: none; cursor: pointer; font-family: 'M PLUS Rounded 1c', sans-serif; transition: all 0.2s; }
        .save-btn.active { background: #4AADCF; color: white; }
        .save-btn.saved { background: #EDF6FB; color: #9ABFD4; cursor: default; }
        .card-toggle-btn { width: 100%; padding: 13px; border-radius: 14px; font-size: 13px; font-weight: 700; cursor: pointer; font-family: 'M PLUS Rounded 1c', sans-serif; transition: all 0.2s; }
        .card-toggle-btn.has { background: #4AADCF; color: white; border: none; }
        .card-toggle-btn.none { background: white; color: #9ABFD4; border: 1.5px solid #D8EEF8; }
        .close-btn { width: 100%; margin-top: 10px; padding: 13px; border-radius: 14px; font-size: 13px; font-weight: 500; border: 1.5px solid #D8EEF8; cursor: pointer; font-family: 'M PLUS Rounded 1c', sans-serif; background: white; color: #9ABFD4; }

        /* 設備 */
        .fac-badges { display: flex; gap: 4px; margin-top: 4px; flex-wrap: wrap; }
        .fac-badge { font-size: 14px; }
        .fac-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
        .fac-toggle { display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 10px 6px; border-radius: 12px; border: 1.5px solid #D8EEF8; cursor: pointer; font-family: 'M PLUS Rounded 1c', sans-serif; background: white; transition: all 0.2s; }
        .fac-toggle.yes { background: #E0F6FF; border-color: #4AADCF; }
        .fac-toggle.no  { background: #F5F9FC; border-color: #D8EEF8; opacity: 0.55; }
        .fac-toggle.unknown { background: white; border-color: #D8EEF8; }
        .fac-toggle-icon { font-size: 20px; }
        .fac-toggle-label { font-size: 10px; color: #7BBCD8; font-weight: 500; }
        .fac-toggle-state { font-size: 11px; font-weight: 700; color: #4AADCF; }
        .fac-toggle.no .fac-toggle-state { color: #B0D4E4; }
        .fac-toggle.unknown .fac-toggle-state { color: #C8E0EA; }

        /* エリア */
        .area-card { background: white; border-radius: 14px; padding: 14px 16px; cursor: pointer; border: 1px solid #D8EEF8; transition: all 0.2s; box-shadow: 0 1px 4px rgba(74,168,212,0.07); }
        .area-card:active { transform: scale(0.98); }
        .area-name { font-size: 15px; font-weight: 700; color: #1E4A60; }
        .area-count { font-size: 12px; color: #9ABFD4; }
        .area-track { height: 6px; background: #D8EEF8; border-radius: 3px; overflow: hidden; }
        .area-fill { height: 100%; background: linear-gradient(90deg, #4AADCF, #7DD6EE); border-radius: 3px; transition: width 0.5s ease; }
        .area-pct { font-size: 11px; color: #9ABFD4; }
        .area-link { font-size: 11px; color: #4AADCF; }
      `}</style>

      <div className="app">
        <div className="header">
          <div className="header-top">
            <div>
              <div className="app-title">♨ YuMeguru Tokyo</div>
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
                {(['all', 'unchecked', 'checked', 'favorite', 'no_card'] as const).map(f => (
                  <button key={f} className={`filter-btn ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
                    {f === 'all' ? 'すべて' : f === 'unchecked' ? '未訪問' : f === 'checked' ? '訪問済み' : f === 'favorite' ? '★ お気に入り' : '🎴未取得'}
                  </button>
                ))}
                <button className={`filter-btn ${sort === 'nearest' ? 'active' : ''}`} onClick={toggleNearest} disabled={locLoading}>
                  {locLoading ? '取得中...' : '📍 近い順'}
                </button>
                <button className={`filter-btn ${sort === 'popular' ? 'active' : ''}`} onClick={() => setSort(s => s === 'popular' ? 'default' : 'popular')}>
                  🔥 人気順
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
                {selected && (() => {
                  const imgs = (() => { try { return JSON.parse(selected.images) } catch { return [] } })()
                  const thumb = imgs[0] ?? null
                  return (
                    <InfoWindow
                      position={{ lat: selected.lat, lng: selected.lng }}
                      onCloseClick={() => setSelected(null)}
                      style={{ padding: 0 }}
                    >
                      <div style={{ width: 200, overflow: 'hidden', borderRadius: 4, fontFamily: 'sans-serif' }}>
                        {thumb
                          ? <img src={thumb} alt={selected.name} style={{ width: '100%', height: 100, objectFit: 'cover', display: 'block' }} onError={e => (e.currentTarget.style.display = 'none')} />
                          : <div style={{ width: '100%', height: 72, background: '#1A1A2E', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, color: '#C5A55A' }}>♨</div>
                        }
                        <div style={{ padding: '8px 10px 10px' }}>
                          <div style={{ fontWeight: 700, fontSize: 13, color: '#1A1A2E', marginBottom: 2 }}>{selected.name}</div>
                          <div style={{ fontSize: 11, color: '#888', marginBottom: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selected.address}</div>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={() => { toggleCheck(selected.id); setSelected(null) }} style={{ flex: 1, fontSize: 11, padding: '5px 0', borderRadius: 20, border: 'none', background: checked.has(selected.id) ? '#eee' : '#2D9E6A', color: checked.has(selected.id) ? '#888' : 'white', cursor: 'pointer', fontWeight: 700 }}>
                              {checked.has(selected.id) ? '✓ 済み' : '行った！'}
                            </button>
                            <button onClick={() => { openDetail(selected); setSelected(null) }} style={{ flex: 1, fontSize: 11, padding: '5px 0', borderRadius: 20, border: 'none', background: '#1A1A2E', color: '#C5A55A', cursor: 'pointer', fontWeight: 700 }}>
                              詳細 →
                            </button>
                          </div>
                        </div>
                      </div>
                    </InfoWindow>
                  )
                })()}
              </Map>
            </div>
          </APIProvider>
        )}
        {view === 'list' && (
          <>
            {recommended.length > 0 && (
              <>
                <div className="section-label">今日のおすすめ</div>
                <div className="rec-scroll">
                  {recommended.map(s => {
                    const imgs = (() => { try { return JSON.parse(s.images) } catch { return [] } })()
                    const thumb = imgs[0] ?? null
                    return (
                      <div key={s.id} className="rec-card" onClick={() => openDetail(s)}>
                        {thumb
                          ? <img className="rec-card-img" src={thumb} alt={s.name} onError={e => { e.currentTarget.style.display = 'none'; (e.currentTarget.nextSibling as HTMLElement).style.display = 'flex' }} />
                          : null
                        }
                        <div className="rec-card-placeholder" style={{ display: thumb ? 'none' : 'flex' }}>♨</div>
                        <div className="rec-card-body">
                          <div className="rec-card-name">{s.name}</div>
                          <div className="rec-card-addr">{s.address}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="section-label">銭湯リスト</div>
              </>
            )}
            {loading ? (
              <div className="loading">読み込み中...</div>
            ) : (

              <div className="list-wrap" style={{ paddingBottom: 120 }}>
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
                    {(visitCounts[s.id] ?? 0) >= 3 && <span className="popular-tag">🔥 {visitCounts[s.id]}</span>}
                    {checked.has(s.id) && <span className="visited-tag">訪問済み</span>}
                    <button className={`fav-btn ${favorites.has(s.id) ? 'on' : ''}`} onClick={e => { e.stopPropagation(); toggleFavorite(s.id) }}>★</button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ textAlign: 'center', padding: '16px 0 8px' }}>
              <a href="/privacy" style={{ fontSize: 11, color: '#B0AEA8', textDecoration: 'none' }}>プライバシーポリシー</a>
            </div>
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
                  {(visitCounts[detail.id] ?? 0) > 0 && (
                    <div style={{ fontSize: 11, color: '#7BBCD8', marginTop: 3 }}>🔥 {visitCounts[detail.id]}人が訪問済み</div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button className={`fav-btn-lg ${favorites.has(detail.id) ? 'on' : ''}`} onClick={() => toggleFavorite(detail.id)}>
                    {favorites.has(detail.id) ? '★' : '☆'}
                  </button>
                  <button className={`checkin-btn ${checked.has(detail.id) ? 'done' : 'todo'}`} onClick={() => toggleCheck(detail.id)}>
                    {checked.has(detail.id) ? '✓ 訪問済み' : '行った！'}
                  </button>
                </div>
              </div>
              <div className="info-grid">
                {detail.open_hours && <div className="info-row"><span className="info-label">営業時間</span><span className="info-val">{detail.open_hours}</span></div>}
                {detail.closed_days && <div className="info-row"><span className="info-label">定休日</span><span className="info-val">{detail.closed_days}</span></div>}
                {detail.phone && <div className="info-row"><span className="info-label">電話</span><a className="info-link" href={`tel:${detail.phone}`}>{detail.phone}</a></div>}
                {detail.price_adult && <div className="info-row"><span className="info-label">料金</span><span className="info-val">大人 ¥{detail.price_adult}</span></div>}
                {detail.website && <div className="info-row"><span className="info-label">公式HP</span><a className="info-link" href={detail.website} target="_blank" rel="noreferrer">リンク →</a></div>}
              </div>
              <div style={{ fontSize: 10, color: '#B0D4E4', marginBottom: 16, textAlign: 'right' }}>
                情報提供：<a href="https://www.1010.or.jp/" target="_blank" rel="noreferrer" style={{ color: '#7BBCD8', textDecoration: 'none' }}>東京銭湯（1010.or.jp）</a>
              </div>
              {detail.description && (() => {
                const cleaned = detail.description
                  .replace(/[^。\n]*こちら[^。\n]*[。]?/g, '')
                  .replace(/https?:\/\/\S+/g, '')
                  .replace(/\s{2,}/g, ' ')
                  .trim()
                return cleaned ? <div className="desc-text">{cleaned}</div> : null
              })()}
              <div style={{ marginBottom: 16 }}>
                <div className="section-title">🏨 設備情報</div>
                <div className="fac-grid">
                  {FACILITIES.map(f => {
                    const val = detail[f.key] as boolean | null | undefined
                    return (
                      <div key={f.key}
                        className={`fac-toggle ${val === true ? 'yes' : val === false ? 'no' : 'unknown'}`}
                        style={{ cursor: 'default' }}>
                        <span className="fac-toggle-icon">{f.icon}</span>
                        <span className="fac-toggle-label">{f.label}</span>
                        <span className="fac-toggle-state">{val === true ? 'あり' : val === false ? 'なし' : '?'}</span>
                      </div>
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
                <div className="section-title">📦 カード在庫情報</div>
                {stockLatest && (
                  <div style={{ marginBottom: 8, fontSize: 12, color: '#9ABFD4', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>最新報告：</span>
                    <span style={{ color: STOCK_LEVELS.find(l => l.key === stockLatest.level)?.color, fontWeight: 700 }}>
                      {STOCK_LEVELS.find(l => l.key === stockLatest.level)?.label}
                    </span>
                    <span style={{ color: '#B0D4E4' }}>{formatRelativeTime(stockLatest.reported_at)}</span>
                  </div>
                )}
                {!stockLatest && (
                  <div style={{ marginBottom: 8, fontSize: 12, color: '#B0D4E4' }}>まだ報告がありません</div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                  {STOCK_LEVELS.map(lvl => (
                    <button
                      key={lvl.key}
                      onClick={() => reportStock(lvl.key)}
                      disabled={stockReporting}
                      style={{
                        padding: '10px 4px',
                        borderRadius: 12,
                        border: `1.5px solid ${myStock === lvl.key ? lvl.color : '#D8EEF8'}`,
                        background: myStock === lvl.key ? lvl.bg : 'white',
                        color: myStock === lvl.key ? lvl.color : '#9ABFD4',
                        fontWeight: myStock === lvl.key ? 700 : 500,
                        fontSize: 12,
                        cursor: stockReporting ? 'default' : 'pointer',
                        fontFamily: "'M PLUS Rounded 1c', sans-serif",
                        transition: 'all 0.2s',
                      }}
                    >
                      {lvl.label}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: 10, color: '#B0D4E4', marginTop: 6, textAlign: 'center' }}>
                  タップして在庫状況をみんなで共有
                </div>
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