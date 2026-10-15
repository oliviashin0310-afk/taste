# 동네식탁

마포구의 음식점 정보를 찾는 모바일 우선 웹 서비스입니다. 기본 화면은 선택한 동네의 실제 공공데이터를 Supabase에서 읽고, 수집 버튼으로 공공데이터 20건을 저장·갱신할 수 있습니다. 버튼으로 샘플 20곳도 확인할 수 있습니다. 평점·리뷰·사진·영업시간은 생성하거나 노출하지 않습니다.

## 요구사항과 화면

- 이름 검색, 업종 필터, 상세 보기, 목록/지도 전환
- 마포구 연남동·성산동·동교동 지역 선택과 현재 위치 기준 500m/1km/3km 탐색
- Kakao 지도 실제 업소 마커와 선택한 음식점 요약, 샘플 모드에서는 임의 좌표 마커
- 위치 권한 거부·시간 초과·미지원 시 지역 직접 선택
- 현재 위치는 브라우저 메모리에서만 사용하고 DB에 저장하지 않음
- 공공데이터포털 상가정보 API를 서버에서 호출하고, 응답 원본 ID·출처·이름·주소·업종·좌표를 Supabase에 저장·갱신
- 음식점 목록과 상세 화면은 서버 API가 Supabase에서 읽은 데이터로 구성
- 좌표가 없는 업소도 목록에 남기며 지도 마커와 주변 거리 계산에서는 제외

## 폴더 구조

```text
app/
  api/restaurants/route.ts        # Supabase 목록 조회
  api/restaurants/nearby/route.ts # PostGIS 주변 검색
  api/restaurants/sync/route.ts   # 서버 전용 수집 및 upsert
  components/KakaoMap.tsx         # Kakao SDK, 마커와 지도 이동
  data/restaurants.ts             # 샘플 20곳과 데이터 타입
  page.tsx                        # 검색·필터·목록·상세 화면
lib/data/public-restaurants.ts    # 공식 API 응답 매핑
lib/supabase/server.ts            # 서버 전용 service-role 클라이언트
lib/supabase/restaurants.ts       # 서버 측 DB 읽기와 upsert
supabase/migrations/              # 테이블, RLS, PostGIS 공간 검색
supabase/verify/                  # 좌표 순서와 반경 단위 확인 SQL
.env.example                     # 환경변수 이름만 포함
```

## 실행 및 환경변수

프로젝트 루트의 `.env.local`에 값을 넣고 개발 서버를 실행합니다. 실제 값이 들어 있는 `.env.local`은 `.gitignore`의 `.env*` 규칙으로 Git에서 제외됩니다. `.env.example`에는 이름만 기록합니다.

```dotenv
NEXT_PUBLIC_KAKAO_MAP_KEY=카카오_JavaScript_키
SUPABASE_URL=https://프로젝트ID.supabase.co
SUPABASE_SECRET_KEY=Supabase_secret_key
DATA_PORTAL_SERVICE_KEY=공공데이터포털_일반_인증키
```

Kakao Developers 앱 설정의 플랫폼 → Web → JavaScript SDK 도메인에 `http://localhost:3000`을 등록하세요. `http://127.0.0.1:3000`으로 접속할 때도 그 주소를 추가해야 합니다. 실제 운영 도메인도 배포 전에 등록합니다. 지도 설정은 [Kakao 지도 웹 API 가이드](https://apis.map.kakao.com/web/guide/)를 따릅니다.

`SUPABASE_SECRET_KEY`와 `DATA_PORTAL_SERVICE_KEY`는 서버 전용 비밀 값입니다. 변수명 앞에 `NEXT_PUBLIC_`을 붙이지 말고, 브라우저 코드에 전달하거나 Git에 올리지 마세요. Supabase 대시보드의 Project Settings → API Keys에서 새 secret key(`sb_secret_…`)를 확인해 로컬 `.env.local`에 직접 넣습니다. 구형 JWT service-role 키도 `SUPABASE_SERVICE_ROLE_KEY` 변수로 호환됩니다. Kakao JavaScript 키는 브라우저에서 지도 SDK가 사용하므로 공개 키로 관리합니다.

공공데이터 조회에 사용하는 공식 서비스와 작업은 다음과 같습니다.

- [소상공인시장진흥공단 상가(상권)정보 API](https://www.data.go.kr/data/15012005/openapi.do): `storeListInDong`, 행정동별 음식 업종 `I2` 조회. 성산동은 성산1동·성산2동 응답을 합칩니다.
- 선택한 동네의 상가정보 응답에서 첫 20개 업소를 표시합니다. 선택한 동네가 성산동이면 성산1동과 성산2동 응답을 합친 뒤 20건으로 제한합니다.

좌표는 상가정보 API가 반환한 위도·경도만 사용합니다. 값이 없거나 숫자로 변환할 수 없는 경우 목록에는 업소를 남기고 지도 마커와 내 주변 거리 계산에서 제외합니다. 공개 데이터의 업소 정보는 제공기관의 최신화 시점과 정확도에 따라 달라질 수 있습니다.

## Supabase 테이블 설정

Supabase 대시보드의 **Database → Extensions**에서 PostGIS를 `extensions` 스키마에 활성화한 뒤, SQL Editor에서 `supabase/migrations/20261015000000_restaurants.sql`, `20261016000000_restaurants_server_sync.sql`, `20261017000000_postgis_nearby_search.sql` 순서로 실행합니다. 두 번째 파일은 기존 Stage 2 테이블에도 원본 ID와 복합 유니크 키를 추가하고 기존 행을 유지합니다. RLS를 켜고 `anon`/`authenticated` 접근을 거부하며 서버의 secret key 역할만 읽기·추가·갱신할 수 있습니다.

화면은 `/api/restaurants`를 통해 Supabase 목록을 읽습니다. **공공데이터 수집 및 DB 갱신** 버튼은 서버의 `/api/restaurants/sync`가 공공 API를 호출해 `source + source_id` 기준으로 upsert한 뒤 DB 결과를 반환합니다. 같은 업소를 다시 수집하면 중복 행을 만들지 않고 이름·주소·업종·좌표·갱신일을 업데이트합니다. 현재 사용 중인 공공 API 응답에는 영업상태 필드를 사용하지 않으므로 상태를 임의로 저장하지 않습니다.

위치 허용 후 공공데이터 모드의 주변 검색은 현재 위도·경도를 POST 본문으로 서버에 전달해 `search_nearby_restaurants` DB 함수에서 실행합니다. `ST_MakePoint`는 X=경도, Y=위도 순서로 만들고, `geography` 타입의 `ST_DWithin` 반경 값과 `ST_Distance` 결과 단위는 미터입니다. DB의 공간 GiST 인덱스를 사용하며 이름 검색, 업종 필터와 최대 100건 제한을 DB에 함께 적용합니다. 현재 위치를 DB에 저장하지 않습니다. 좌표 순서와 각 반경의 안/밖 검증 SQL은 `supabase/verify/postgis_distance_checks.sql`입니다.

## 개발 서버와 확인 방법

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000`을 엽니다. 환경변수를 바꾼 뒤에는 개발 서버를 재시작하세요.

- 검색에 `소담한 밥상`을 입력하면 샘플 1곳이 남고, `공공데이터 음식점 보기`에서도 업체명 검색이 됩니다.
- 업종 칩을 선택해 결과를 좁힌 뒤 이름 검색과 함께 사용합니다.
- `목록`/`지도` 전환, 음식점 선택, 지도 마커 선택을 확인합니다.
- 샘플 모드에서는 모든 목록과 마커가 샘플임을 표시하고, 상세에 평점·리뷰·영업시간을 표시하지 않습니다.
- 환경변수와 SQL을 설정한 뒤 첫 화면에서 Supabase 저장 목록을 불러옵니다. 최초 데이터 수집 또는 갱신은 `공공데이터 수집 및 DB 갱신` 버튼을 누릅니다. 성공 상태가 표시되면 새로고침해 저장된 실제 음식점 목록이 그대로 표시되는지 확인합니다. 이름 검색과 업종 필터도 함께 확인합니다.
- Kakao 지도는 키를 비우거나 개발 주소 등록을 제거해 실패 안내를 확인할 수 있습니다.
- 위치 허용은 `내 주변 찾기`를 누르고 브라우저 권한 창에서 허용합니다. 지도에 현재 위치 마커가 나오고 목록이 거리순으로 정렬되는지 확인합니다.
- 거부는 주소창의 사이트 정보 → 위치 권한을 차단으로 지정한 뒤 새로고침하고 `내 주변 찾기`를 눌러 확인합니다. 위치 안내와 `지역 선택` 버튼이 나타납니다.
- 시간 초과 안내는 기기 위치 서비스를 끄거나 브라우저의 위치 응답이 지연되는 환경에서 확인합니다. 위치 미지원은 `navigator.geolocation`을 제공하지 않는 브라우저에서 확인합니다. 현재 위치 좌표는 서버나 DB로 보내지 않습니다.

## 데이터 안전

브라우저 현재 위치는 서버 요청이나 Supabase로 전송하지 않습니다. 브라우저가 위치를 Kakao 지도에 표시할 때 지도 제공자가 지도 타일을 전달하는 과정에서 현재 지도 범위를 받습니다. 실제 음식점 데이터가 선택되면 직선거리는 실제 좌표로 계산합니다.
