import type { Restaurant } from "../../app/data/restaurants";

type SmallBusinessItem = {
  bizesId?: string;
  bizesNm?: string;
  indsMclsNm?: string;
  indsSclsNm?: string;
  ldongNm?: string;
  adongNm?: string;
  rdnmAdr?: string;
  lnoAdr?: string;
  lon?: string | number;
  lat?: string | number;
};

type SmallBusinessResponse = {
  header?: { resultCode?: string; resultMsg?: string };
  body?: { totalCount?: string | number; items?: SmallBusinessItem[] };
};

const neighborhoodAdminCodes: Record<string, string[]> = {
  "연남동": ["11440710"],
  "성산동": ["11440720", "11440730"],
  "동교동": ["11440660"],
};
const palette = ["#dce8d7", "#f0dfd2", "#e7e2cd", "#e6d9d1", "#efd9c7", "#ddd2c9"];

function asItems(value: SmallBusinessItem[] | undefined) {
  if (!value) return [] as SmallBusinessItem[];
  return Array.isArray(value) ? value : [];
}

async function requestJson<T>(url: URL, source: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { cache: "no-store", headers: { Accept: "application/json" } });
  } catch {
    throw new Error(`${source}에 연결하지 못했습니다. 서버의 외부 네트워크 연결을 확인해 주세요.`);
  }
  if (!response.ok) throw new Error(`공공데이터 API가 HTTP ${response.status} 응답을 반환했습니다.`);
  return response.json() as Promise<T>;
}

export async function fetchPublicRestaurantData(neighborhood: string) {
  const serviceKey = process.env.DATA_PORTAL_SERVICE_KEY;
  if (!serviceKey) throw new Error("DATA_PORTAL_SERVICE_KEY가 .env.local에 설정되지 않았습니다.");
  const administrativeCodes = neighborhoodAdminCodes[neighborhood];
  if (!administrativeCodes) throw new Error("지원하지 않는 지역입니다.");

  const smallBusinessRequests = administrativeCodes.map(code => {
    const url = new URL("https://apis.data.go.kr/B553077/api/open/sdsc2/storeListInDong");
    for (const [name, value] of Object.entries({
      ServiceKey: serviceKey,
      pageNo: "1",
      numOfRows: "20",
      divId: "adongCd",
      key: code,
      indsLclsCd: "I2",
      type: "json",
    })) url.searchParams.set(name, value);
    return requestJson<SmallBusinessResponse>(url, "상가정보 API");
  });

  const smallBusinesses = await Promise.all(smallBusinessRequests);

  for (const smallBusiness of smallBusinesses) {
    if (smallBusiness.header?.resultCode !== "00") {
      throw new Error(`상가정보 API 오류: ${smallBusiness.header?.resultMsg ?? "응답 코드를 확인할 수 없습니다."}`);
    }
  }
  const businesses = smallBusinesses.flatMap(smallBusiness => asItems(smallBusiness.body?.items))
    .slice(0, 20)
    .map((item, index): Restaurant | null => {
      if (!item.bizesId || !item.bizesNm) return null;
      const latitudeValue = item.lat == null ? "" : String(item.lat).trim();
      const longitudeValue = item.lon == null ? "" : String(item.lon).trim();
      const latitude = latitudeValue ? Number(latitudeValue) : Number.NaN;
      const longitude = longitudeValue ? Number(longitudeValue) : Number.NaN;
      const category = item.indsMclsNm || item.indsSclsNm || "음식점";
      return {
        id: index + 1,
        name: item.bizesNm,
        category,
        categoryLabel: item.indsSclsNm || category,
        neighborhood: item.ldongNm || item.adongNm || "마포구",
        address: item.rdnmAdr ?? item.lnoAdr ?? "",
        description: "",
        color: palette[index % palette.length],
        emoji: "🍽️",
        distance: 0,
        source: "public",
        sourceId: item.bizesId,
        sourceName: "소상공인시장진흥공단 상가(상권)정보 API",
        ...(Number.isFinite(latitude) && Number.isFinite(longitude)
          ? { latitude, longitude }
          : {}),
      };
    })
    .filter((item): item is Restaurant => item !== null);

  return { businesses };
}
