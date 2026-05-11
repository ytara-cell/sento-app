import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function fetchSentos() {
  const { data, error } = await supabase
    .from('sentos')
    .select('*')
  if (error) throw error
  return data ?? []
}