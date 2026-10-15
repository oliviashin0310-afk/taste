export type Restaurant = {
  id: number; name: string; category: string; categoryLabel: string; neighborhood: string;
  address: string; description: string; color: string; emoji: string; distance: number;
  latitude?: number; longitude?: number; source?: "sample" | "public";
  sourceId?: string; sourceName?: string; updatedAt?: string; distanceMeters?: number;
};

// UI-only coordinates for map and proximity previews. Replace with official venue coordinates later.
export function getSampleCoordinates(id: number) {
  const index = id - 1;
  return {
    lat: 37.562 + ((index % 5) - 2) * 0.0018 + Math.floor(index / 5) * 0.0002,
    lng: 126.923 + (Math.floor(index / 5) - 1.5) * 0.0022 + ((index % 5) - 2) * 0.00015,
  };
}

export const categories = ["전체", "한식", "일식", "중식", "양식", "카페", "분식"];

export const restaurants: Restaurant[] = [
  { id: 1, name: "소담한 밥상", category: "한식", categoryLabel: "백반 · 가정식", neighborhood: "연남동", address: "서울 마포구 연남동", description: "매일 다른 반찬으로 차리는 따뜻한 한 끼", color: "#dce8d7", emoji: "🍚", distance: 0.2 },
  { id: 2, name: "모모스시", category: "일식", categoryLabel: "초밥 · 일식", neighborhood: "연남동", address: "서울 마포구 연남동", description: "작은 공간에서 즐기는 정갈한 초밥", color: "#f0dfd2", emoji: "🍣", distance: 0.4 },
  { id: 3, name: "마실 국수집", category: "한식", categoryLabel: "국수 · 면요리", neighborhood: "동교동", address: "서울 마포구 동교동", description: "멸치 육수로 담백하게 끓인 잔치국수", color: "#e7e2cd", emoji: "🍜", distance: 0.5 },
  { id: 4, name: "오후의 식탁", category: "양식", categoryLabel: "브런치 · 양식", neighborhood: "연남동", address: "서울 마포구 연남동", description: "계절 재료로 천천히 준비하는 브런치", color: "#e6d9d1", emoji: "🥗", distance: 0.6 },
  { id: 5, name: "골목 떡볶이", category: "분식", categoryLabel: "떡볶이 · 분식", neighborhood: "연남동", address: "서울 마포구 연남동", description: "달콤 매콤한 소스와 쫄깃한 떡", color: "#efd9c7", emoji: "🍢", distance: 0.7 },
  { id: 6, name: "느린 오후 커피", category: "카페", categoryLabel: "커피 · 디저트", neighborhood: "연남동", address: "서울 마포구 연남동", description: "잠시 쉬어가기 좋은 동네 커피집", color: "#ddd2c9", emoji: "☕", distance: 0.8 },
  { id: 7, name: "산들바람 칼국수", category: "한식", categoryLabel: "칼국수 · 한식", neighborhood: "성산동", address: "서울 마포구 성산동", description: "손으로 밀어 쫄깃한 면을 담은 칼국수", color: "#d9e5dd", emoji: "🥣", distance: 1.0 },
  { id: 8, name: "홍콩반점 옆 작은집", category: "중식", categoryLabel: "중식 · 만두", neighborhood: "동교동", address: "서울 마포구 동교동", description: "바삭한 군만두와 볶음밥을 만나는 곳", color: "#e9d7c7", emoji: "🥟", distance: 1.1 },
  { id: 9, name: "포레스트 파스타", category: "양식", categoryLabel: "파스타 · 양식", neighborhood: "연남동", address: "서울 마포구 연남동", description: "허브 향을 살린 편안한 파스타", color: "#d7e2d1", emoji: "🍝", distance: 1.2 },
  { id: 10, name: "유자나무", category: "일식", categoryLabel: "덮밥 · 일식", neighborhood: "성산동", address: "서울 마포구 성산동", description: "산뜻한 유자 소스를 곁들인 덮밥", color: "#e7e1c7", emoji: "🍱", distance: 1.3 },
  { id: 11, name: "빵굽는 작은집", category: "카페", categoryLabel: "베이커리 · 카페", neighborhood: "연남동", address: "서울 마포구 연남동", description: "아침마다 구워내는 담백한 빵", color: "#ead9c7", emoji: "🥐", distance: 1.5 },
  { id: 12, name: "시장 골목 순대국", category: "한식", categoryLabel: "국밥 · 한식", neighborhood: "성산동", address: "서울 마포구 성산동", description: "든든하게 속을 채우는 따끈한 국밥", color: "#dfd8cf", emoji: "🍲", distance: 1.7 },
  { id: 13, name: "라임키친", category: "양식", categoryLabel: "샐러드 · 양식", neighborhood: "동교동", address: "서울 마포구 동교동", description: "채소와 곡물을 넉넉히 담은 한 그릇", color: "#dce8d5", emoji: "🥑", distance: 1.8 },
  { id: 14, name: "진한육수 라멘", category: "일식", categoryLabel: "라멘 · 일식", neighborhood: "연남동", address: "서울 마포구 연남동", description: "오래 끓인 육수에 면을 말아내는 라멘집", color: "#e6d4c7", emoji: "🍜", distance: 2.0 },
  { id: 15, name: "동네김밥 연구소", category: "분식", categoryLabel: "김밥 · 분식", neighborhood: "성산동", address: "서울 마포구 성산동", description: "재료를 아낌없이 넣어 말아낸 김밥", color: "#e5e5cc", emoji: "🍙", distance: 2.2 },
  { id: 16, name: "매일두부", category: "한식", categoryLabel: "두부요리 · 한식", neighborhood: "성산동", address: "서울 마포구 성산동", description: "고소한 두부를 중심으로 차리는 식사", color: "#e8e5d5", emoji: "🧈", distance: 2.4 },
  { id: 17, name: "차오차오 키친", category: "중식", categoryLabel: "중식 · 볶음요리", neighborhood: "동교동", address: "서울 마포구 동교동", description: "센 불에 볶아 향을 살린 한 접시", color: "#ebd7c8", emoji: "🥢", distance: 2.6 },
  { id: 18, name: "달빛 디저트", category: "카페", categoryLabel: "디저트 · 카페", neighborhood: "연남동", address: "서울 마포구 연남동", description: "차와 함께 천천히 즐기는 작은 디저트", color: "#e7d9df", emoji: "🍰", distance: 2.8 },
  { id: 19, name: "들기름 막국수집", category: "한식", categoryLabel: "막국수 · 한식", neighborhood: "성산동", address: "서울 마포구 성산동", description: "고소한 들기름 향이 은은한 막국수", color: "#e0e2cf", emoji: "🥢", distance: 3.0 },
  { id: 20, name: "오늘의 카레", category: "일식", categoryLabel: "카레 · 일식", neighborhood: "동교동", address: "서울 마포구 동교동", description: "매일 조금씩 달라지는 집밥 카레", color: "#eadfc8", emoji: "🍛", distance: 3.0 },
];
