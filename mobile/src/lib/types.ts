export type Restaurant = {
  id: number
  name: string
  category: string
  categoryLabel: string
  neighborhood: string
  address: string
  description: string
  color: string
  emoji: string
  distance: number
  latitude?: number
  longitude?: number
  source?: 'sample' | 'public'
  sourceId?: string
  sourceName?: string
  updatedAt?: string
  distanceMeters?: number
}

export type Favorite = {
  id: string
  restaurant_key: string
  restaurant_name: string
  restaurant_address: string
  created_at: string
}

export const categories = [
  '전체', '카페/디저트', '중식', '한식', '패스트푸드',
  '일식', '야식', '분식', '양식', '아시안',
] as const

export const neighborhoods = ['연남동', '성산동', '동교동'] as const

export function restaurantKey(item: Restaurant) {
  return item.source === 'public' && item.sourceId
    ? 'public:' + item.sourceId
    : 'sample:' + item.id
}

export function matchesCategory(item: Restaurant, selected: string) {
  if (selected === '전체') return true
  const patterns: Record<string, RegExp> = {
    '카페/디저트': /카페|커피|디저트|베이커리|빵|도넛/i,
    '중식': /중식|중국/i,
    '한식': /한식|백반|한정식|국밥|족발|보쌈/i,
    '패스트푸드': /패스트\s*푸드|햄버거|피자/i,
    '일식': /일식|일본|초밥|스시|라멘|우동|돈까스|덮밥/i,
    '야식': /야식/i,
    '분식': /분식|떡볶이|튀김|김밥|순대|어묵|꼬치/i,
    '양식': /양식|이탈리안|파스타|스테이크|브런치|프렌치/i,
    '아시안': /아시안|태국|베트남|인도|카레|커리|쌀국수|팟타이|동남아/i,
  }
  return (patterns[selected] || /$a/).test(item.category + ' ' + item.categoryLabel)
}
