# 회원 및 커뮤니티 기능 설정

## 1. 환경변수

프로젝트 루트의 `.env.local`에 아래 브라우저용 값이 있어야 합니다. 이미 설정된 Supabase URL과 publishable key를 그대로 사용하고, secret/service-role 키를 `NEXT_PUBLIC_` 변수로 넣지 마세요.

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

배포할 때 `NEXT_PUBLIC_SITE_URL`은 실제 서비스 도메인으로 바꾸고, Supabase Dashboard → Authentication → URL Configuration의 Site URL 및 Redirect URLs에도 같은 주소를 등록하세요. 로컬은 `http://localhost:3000/**`를 Redirect URL에 추가합니다.

## 2. 데이터베이스 설정

Supabase Dashboard → SQL Editor에서 `supabase/migrations/20261018000000_community_features.sql` 전체를 실행합니다. 회원 프로필, 즐겨찾기, 리뷰, 신고 테이블과 RLS 정책, 리뷰 사진 Storage 버킷이 생성됩니다.

## 3. 이메일 가입

Supabase Dashboard → Authentication → Providers에서 Email 로그인을 켭니다. 가입 확인 메일을 사용한다면 SMTP와 이메일 템플릿을 설정하고, 테스트 시 가입한 주소의 확인 메일 링크를 열어야 로그인할 수 있습니다.

## 4. 관리자 지정

먼저 일반 가입과 이메일 확인을 마친 다음 SQL Editor에서 관리자 계정을 지정합니다. 이메일은 실제 관리자 계정 주소로 바꿉니다.

```sql
update public.profiles
set role = 'admin'
where id = (
  select id from auth.users where email = 'admin@example.com'
);
```

관리자는 `/admin/community`에서 리뷰 공개/비공개 처리와 신고 확인을 할 수 있습니다. 새로 지정한 관리자 계정은 로그아웃 후 다시 로그인해야 역할이 갱신됩니다.

## 사용자 기능

- 로그인한 회원은 음식점 상세에서 즐겨찾기를 저장하고 계정 메뉴에서 목록을 관리합니다.
- 공공데이터로 불러온 음식점에만 리뷰, 사진, 신고 입력이 열립니다. 샘플 음식점은 실제 정보처럼 오해되지 않도록 리뷰를 받지 않습니다.
- 리뷰는 별점 없이 글과 사진만 받으며, 등록 직후에는 작성자와 관리자에게만 보입니다. 관리자가 승인한 리뷰만 공개됩니다.
- 리뷰 사진은 JPG/PNG/WebP, 파일당 5MB 이하, 리뷰당 최대 3장입니다.
- 사용자 현재 위치는 즐겨찾기, 리뷰, 신고 데이터에 저장하지 않습니다.
