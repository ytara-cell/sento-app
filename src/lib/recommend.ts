import { Sento, UserProfile } from '@/types'

// ユーザーの好みと銭湯の特徴を比較してスコアを計算
export function calcScore(
  sento:   Sento,
  profile: UserProfile,
): number {
  const pref = profile.preferred_features
  const f    = sento.features
  let score  = 0

  // 好みの特徴マッチ
  if (f.sauna        && (pref['sauna'] ?? 0) >= 1)        score += 30
  if (f.yakuyu       && (pref['yakuyu'] ?? 0) >= 1)       score += 20
  if (f.fujisan_wall && (pref['fujisan_wall'] ?? 0) >= 1) score += 15
  if (f.mizuburo     && (pref['mizuburo'] ?? 0) >= 1)     score += 15

  // Google評価ボーナス
  if (sento.google_rating) {
    score += Math.round((sento.google_rating / 5) * 20)
  }

  return Math.min(score, 100)
}

// 未訪問銭湯をスコア順に並べて返す
export function recommendSentos(
  allSentos:  Sento[],
  profile:    UserProfile,
  visitedIds: Set<string>,
  topN:       number = 10
) {
  return allSentos
    .filter(s => !visitedIds.has(s.id))
    .map(s => ({
      ...s,
      score: calcScore(s, profile),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)
}