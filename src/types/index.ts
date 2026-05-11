export interface SentoFeatures {
  sauna:        boolean
  mizuburo:     boolean
  gaiki_yoku:   boolean
  fujisan_wall: boolean
  yakuyu:       boolean
  cashless:     boolean
  towel_rental: boolean
  tattoo_ok:    boolean
  parking:      boolean
  sauna_temp?:    number | null
  mizuburo_temp?: number | null
  vibe_tags: string[]
}

export interface Sento {
  id:              string
  name:            string
  address:         string
  lat:             number | null
  lng:             number | null
  phone:           string | null
  price_adult:     number
  open_hours:      string | null
  closed_days:     string | null
  features:        SentoFeatures
  google_place_id: string | null
  google_rating:   number | null
  data_confidence: number
}

export interface Checkin {
  id:         string
  user_id:    string
  sento_id:   string
  visited_at: string
  note:       string | null
  rating:     number | null
}

export interface UserProfile {
  user_id:            string
  display_name:       string | null
  preferred_features: Record<string, number>
  visited_wards:      string[]
  total_checkins:     number
  badges:             string[]
}