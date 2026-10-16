# 동네식탁 Capacitor 앱

웹은 기존 Next.js 사이트로 유지하고, 앱 화면은 이 폴더의 React 앱으로 실행합니다. 앱과 웹은 동일한 HTTPS 음식점 API와 Supabase 프로젝트를 사용합니다.

## 앱 환경 설정

1. 이 폴더에서 `.env.example`을 복사해 `.env.local` 파일을 만듭니다.
2. 아래 공개 클라이언트 값만 채웁니다.
   - `VITE_API_BASE_URL`: 배포된 웹 API 주소(예: `https://taste-ruddy.vercel.app`)
   - `VITE_SUPABASE_URL`: Supabase 프로젝트 URL
   - `VITE_SUPABASE_PUBLISHABLE_KEY`: Supabase 공개 publishable/anon 키
   - `VITE_KAKAO_MAP_KEY`: 카카오 JavaScript 앱 키
3. Supabase 대시보드의 Authentication URL 설정에서 허용 리디렉션 주소에 `taste://auth/callback`을 추가합니다.
4. 카카오 개발자 콘솔에 웹 도메인과 앱의 WebView 출처를 등록합니다. 지도 타일과 SDK는 네트워크 연결이 필요합니다.

**앱 번들에는 공개 클라이언트 설정만 들어갑니다.** Supabase service role/secret 키와 공공데이터 인증키를 `.env.local`에 넣지 마세요. 서버 전용 키는 기존 Next.js 서버 환경에만 둡니다.

주변 검색 요청은 현재 위치와 500m/1km/3km 반경으로 서버에 전달하고 최대 100곳을 요청합니다. 실제 결과 수는 Supabase에 저장된 음식점 데이터 범위와 수량에 따라 달라집니다.

## Android 실행 (Windows/macOS/Linux)

1. Android Studio를 설치하고 Android SDK를 설정합니다. Android Studio에서 기기 에뮬레이터를 만들거나 USB 디버깅을 켠 휴대폰을 연결합니다.
2. 저장소의 `mobile` 폴더에서:

```sh
npm install
npm run build
npx cap sync android
npx cap open android
```

3. Android Studio에서 기기를 고르고 **Run ▶**을 누릅니다. 연결된 기기에 바로 실행하려면 `npx cap run android`를 사용할 수 있습니다.

개발 중 웹 코드를 수정하면 `npm run build`와 `npx cap sync android`를 다시 실행한 뒤 앱을 실행합니다.

## iOS 실행 (macOS 필요)

iOS 앱 컴파일과 시뮬레이터/기기 실행에는 Mac과 Xcode가 필요합니다. Windows에서는 iOS 프로젝트 파일을 생성하거나 Xcode로 빌드할 수 없습니다.

Mac에서 저장소를 열고 `mobile` 폴더에서:

```sh
npm install
npm run build
npx cap sync ios
npx cap open ios
```

Xcode에서 시뮬레이터 또는 팀 서명이 설정된 iPhone을 고르고 **Run ▶**을 누릅니다. App Store 제출 전에는 Apple Developer 서명과 앱 식별자 설정이 필요합니다.

## 로컬 API 테스트

웹 API가 개발 PC에서 실행 중일 때 Android 에뮬레이터의 API 주소는 보통 `http://10.0.2.2:3000`입니다. 실제 휴대폰에서 로컬 API를 시험할 때는 PC와 같은 Wi-Fi와 개발용 HTTPS 터널 설정이 필요합니다. 가장 간단한 방법은 배포된 HTTPS API 주소를 사용하는 것입니다. 웹 API의 CORS 변경도 실제 서버에 배포되어 있어야 앱에서 호출됩니다.

