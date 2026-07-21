@AGENTS.md

## 코드베이스 분석 (기술 관점)

이 섹션은 `AGENTS.md`(기능/UX 기준 문서)를 보완하는 기술적 코드베이스 스냅샷이다. 동작 기준이 궁금하면 `AGENTS.md`를, 코드가 어떻게 짜여 있는지 궁금하면 이 섹션을 본다. 코드가 변경되면 이 섹션도 함께 갱신한다.

### 실행

```bash
npm run dev    # http://localhost:3005
npm run build
npm run start
npm run lint
```

### 아키텍처 개요

- Next.js App Router 단일 앱. 프론트엔드와 API 라우트가 같은 프로젝트(`src/app`)에 있다.
- 화면은 사실상 `src/app/page.tsx` 한 파일(약 2,700줄)에 몰려 있는 클라이언트 컴포넌트다. 캘린더, 4개 탭(캘린더/선정체험단/체험완료/리뷰완료), 등록/일정 팝업, 로그인/회원가입 폼이 모두 이 파일 안에서 관리된다. 별도 `components/` 디렉터리는 없다.
- 상태 관리는 별도 라이브러리 없이 React state(`useState`/`useEffect`)로 처리하고, 서버와는 `fetch`로 직접 통신한다. 전역 상태 라이브러리, 클라이언트 캐싱 레이어(React Query 등)는 없다.
- DB 접근은 `src/lib/db.ts` 한 파일에 집중되어 있고, `postgres` 패키지로 원시 SQL을 실행한다. ORM은 쓰지 않는다.
- 스키마 마이그레이션은 별도 마이그레이션 도구 없이 `db.ts` 내부에서 앱 부팅 시 `CREATE TABLE IF NOT EXISTS` / `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` 형태로 지연 적용된다(`__reviewCalendarSchemaReady` 전역 캐시로 프로세스당 1회만 실행).
- DB는 Supabase Postgres(서울 리전)를 쓴다. **`DATABASE_URL`은 반드시 Connection Pooler 주소(`aws-*.pooler.supabase.com:6543`)를 써야 한다** — Direct connection 호스트(`db.*.supabase.co`)는 IPv6 전용 A/AAAA 레코드만 갖고 있어, 개발 환경 네트워크에 따라 `ENOTFOUND`로 아예 연결이 안 될 수 있다(2026-07-14 Neon→Supabase 이전 중 확인). Neon을 쓰던 시절엔 무료 티어 auto-suspend로 인한 콜드 스타트(최초 쿼리 800ms+)가 체감 로딩 지연의 원인이었는데, Supabase 무료 티어는 상시 기동(1주일 미사용 시에만 프로젝트 전체 일시정지)이라 이 문제가 사실상 사라졌다.

### 디렉터리 구조

```
src/
  app/
    page.tsx          # 전체 UI (캘린더, 탭, 팝업, 인증 폼)
    layout.tsx
    globals.css
    api/
      auth/            # register, login, logout, me, check-username, send-email-code
      bootstrap/       # 초기 데이터 일괄 조회
      campaigns/       # 체험단 CRUD, [id]/schedule, [id]/status
      holidays/        # 공휴일 조회
      parse-link/      # 붙여넣은 내용(링크 또는 페이지 전체) → 체험단 미리보기 파싱
  lib/
    auth.ts            # 세션/비밀번호 해시
    db.ts              # DB 연결, 스키마 부트스트랩, 전체 쿼리
    holidays.ts         # 공휴일 API 동기화
    parsers/            # 도메인 → 파서 라우팅 (index.ts, types.ts, gangnam.ts, review-note.ts, dailyview.ts, chvu.ts)
    gangnam/parser.ts    # 강남맛집 실제 파싱 로직
    review-note/parser.ts # 리뷰노트 실제 파싱 로직 (붙여넣기 경로로 정상 동작)
    dailyview/parser.ts   # 데일리뷰 실제 파싱 로직
    chvu/parser.ts         # 체험뷰 실제 파싱 로직 (붙여넣기 경로로 정상 동작)
  types/
    campaign.ts, holiday.ts
```

`src/app/api/{gangnam,reviewnote,site-connections,automation-jobs}`, `scripts/` 등 과거 구조의 빈 디렉터리와 `db.ts`의 미사용 함수(`closeDb`, `findUserById`, `insertHolidayOverride`)는 2026-07-14에 정리 완료했다.

### 인증 (`src/lib/auth.ts`)

- 아이디+비밀번호 로그인, 비밀번호는 서버 해시 저장.
- 세션은 HttpOnly 쿠키 + `user_sessions` 테이블 조합.
- 회원가입 시 이메일 인증번호(Resend 발송, `send-email-code`)를 확인해야 하며, 이메일은 로그인 식별자가 아니다.
- 모든 체험단/공휴일 API는 로그인 세션이 있어야 접근 가능.

### 체험단 파서 구조 (`src/lib/parsers/`)

- **2026-07-13 붙여넣기 기반으로 개편.** 등록 흐름은 더 이상 "링크만 넣기"가 아니라 "선정된 체험단 페이지를 통째로 붙여넣기"가 기본이다. `index.ts`가 `parseCampaignContent(raw, userId)`를 공통 진입점으로 노출하며, 붙여넣은 내용이 순수 URL 문자열(줄바꿈 없는 `http(s)://...`)이면 기존 `parseCampaignLink` 경로(서버 `fetch`)로, 그 외(페이지 전체 복사본)면 내용 안의 도메인/브랜드 문자열로 사이트를 판별해 각 파서의 `parseContent(html)`를 직접 호출한다.
- `CampaignParser` 인터페이스는 `canHandle`/`parse`(URL 기반 fetch) 외에 `parseContent`(순수 HTML 문자열 파싱, 네트워크 없음)를 필수로 구현한다. 네 어댑터(`lib/parsers/{gangnam,dailyview,review-note,chvu}.ts`) 모두 두 경로를 지원한다(다만 `parse`가 실제로 성공하는지는 사이트마다 다르다 — 아래 리뷰노트/체험뷰 항목 참고).
- 각 사이트의 실제 파싱 로직(`lib/{gangnam,dailyview,review-note,chvu}/parser.ts`)은 `parseXxxCampaignHtml(html, href)` 순수 함수로 분리돼 있고, fetch 기반 함수(`parseXxxCampaign(id, href)`)는 이 순수 함수를 감싸는 얇은 래퍼다. 새 사이트를 추가하려면: (1) `lib/<site>/parser.ts`에 `parseXxxCampaignHtml` 구현 (2) 필요하면 fetch 래퍼도 추가 (3) `lib/parsers/<site>.ts` 어댑터에 `canHandle`/`parse`/`parseContent` 연결 (4) `lib/parsers/index.ts`의 `parserMatchers`와 `contentSiteSignatures`에 등록.
- 지원 도메인/브랜드: `reviewnote.co.kr`/리뷰노트, `강남맛집.net`(퓨니코드 `xn--939au0g4vj8sq.net`), `dailyview.kr`/데일리뷰, `chvu.co.kr`/체험뷰.
- **리뷰노트는 링크 fetch로는 여전히 불가능하다.** `GET /api/campaign`이 401을 반환하고, `review_information.php` 같은 개인 페이지는 비로그인 시 `alert('로그인하셔야 이용가능합니다')` + 로그인 리다이렉트만 내려온다(본문 자체가 없음). 대신 사용자가 로그인한 브라우저에서 페이지를 통째로 복사해 붙여넣는 `parseReviewNoteCampaignHtml`로 지원한다. 이 함수는 (1) HTML을 줄 단위 텍스트로 변환해 "제공서비스/물품"/"방문 주소" 라벨 다음 값을 추출하고 (2) "방문 및 예약 안내"+"키워드 정보"+"체험단 미션" 세 섹션을 정리해 상세 내용(`memo`)으로 합치며(연락처/전화번호/복사 버튼 텍스트는 필터링, 키워드는 `|`로 구분) (3) 캘린더는 FullCalendar(v6, `fc-daygrid-event-harness`) 구조를 분석해 "체험&리뷰"(체험 기간), "마감"(리뷰 마감일) 이벤트의 날짜 범위를 계산한다 — 여러 날에 걸친 이벤트는 시작 주(週)의 셀에만 렌더링되고 나머지 폭은 CSS `right` 픽셀 오프셋으로만 표현되므로, 같은 이벤트의 주 전체를 가로지르는 조각으로 컬럼 너비를 역산한 뒤 종료 조각의 폭을 일수로 환산한다. 실제 캠페인 마크업으로 검증 완료. 업체 연락처는 페이지에 있어도 자동 추출하지 않고 항상 수동 입력을 유지한다(AGENTS.md 원칙).
- 강남맛집 파서(`lib/gangnam/parser.ts`)는 표준 `fetch()` 기반이며, 공개 상세 페이지(`<dt>/<dd>` 목록)와 로그인 후 "선정된 캠페인" 개인 페이지(`가이드라인`/`키워드`/`지역` 등 다른 라벨 구성) 둘 다 지원한다. 개인 페이지에서는 "가이드라인" + "키워드"(연락처/전화번호/복사 버튼 제외, `|` 구분)를 상세 내용(`memo`)으로 합친다("리뷰 시 주의사항"은 모든 캠페인에 공통으로 붙는 상투적 문구라 제외). 주소는 "지역" dt/dd 값에서 지역명+지번만 추출.
- 데일리뷰(`lib/dailyview/parser.ts`)는 공개 상세 페이지(`review_campaign.php`, `<div class="itname">` 등 카드형 마크업)와 로그인 후 개인 페이지(`review_information.php?rv_id=`, "업체명/제공내역/주소/체험 및 리뷰기간/방문 및 예약안내" 라벨-값 텍스트) 둘 다 지원한다. `parseDailyviewCampaignHtml`이 마크업에 `<div class="itname">`가 있는지로 두 경로를 자동 분기한다. 개인 페이지는 기간이 이미 `YYYY-MM-DD ~ YYYY-MM-DD` 형식이라 연도 추정이 필요 없다.
- **체험뷰는 로그인 없이 상세 페이지가 열리지만 링크 fetch로는 지원 불가능하다(2026-07-21 확인).** Next.js `nextExport`(정적 내보내기) 앱이라 서버가 받는 HTML에 캠페인 데이터가 전혀 없고(빈 `#__next` 셸), 실제 내용은 브라우저에서 API를 호출해 채워 넣는다 — 로그인 문제가 아니라 렌더링 방식 문제라는 점에서 리뷰노트와 원인은 다르지만 결과(붙여넣기 전용)는 같다. `parseChvuCampaignHtml`은 리뷰노트와 같은 "HTML → 줄 단위 텍스트 → 라벨 다음 값 수집" 방식을 쓰되, 라벨이 반응형 숨김용 빈 `<div>`에 의해 두 줄로 쪼개지는 경우(`가이드라인/` + `요청사항`)가 있어 라벨을 "연속된 줄의 시퀀스"로 다룬다. "방문 및 예약안내" 영역에 네이버 지도 위젯이 통째로 끼어 있는데 중첩 div가 너무 깊어 태그 균형을 맞춰 제거하기 어려우므로, 지도 바로 다음에 항상 주소 `<div class="...Address...">`가 이어지는 구조를 이용해 지도 시작부터 주소 시작 직전까지를 통째로 잘라낸다. 툴팁 설명·복사 버튼 문구는 모든 캠페인에 공통으로 붙는 UI 텍스트라 노이즈 패턴으로 필터링한다. 페이지에 명시적 "체험 가능 기간"이 없고 모집시작일/모집마감일(지원 기간)·리뷰마감일만 있어서, 리뷰노트 fetch 경로가 캘린더 정보 없을 때 쓰는 것과 동일한 규칙(모집마감일 다음날 ~ 리뷰마감일)으로 `experienceStartDate/EndDate`를 계산한다.
- **브라우저 Ctrl+C로 복사한 HTML은 모든 태그에 `style="..."` 등 속성이 주입된다.** 네 파서 모두 이 때문에 속성 없는 태그만 매칭하는 정규식(`<p class="tit">`, `<br>` 등)이 실패하는 버그를 겪었다 — 새 사이트를 추가하거나 파서를 고칠 때는 태그 매칭 정규식에 항상 `[^>]*`로 속성을 허용해야 한다.

### 데이터 모델 (`src/types/campaign.ts`, `db.ts`)

- `Campaign.status`: `unscheduled → scheduled → completed → review_submitted` (취소 시 바로 이전 단계로만 되돌아감, 역방향 스킵 없음).
- 주요 필드: `detailUrl`, `experienceStartDate/EndDate`, `reviewDeadline`, `selectedDate`, `companyName/Phone`, `contactLocked`.
- 캠페인은 `userId` 기준으로 격리 저장됨(사용자 간 데이터 분리).
- 공휴일은 한국천문연구원 API를 동기화해 DB에 캐시하고(`holidays.ts`), 실패해도 체험단 기능에는 영향 없음.

### 알려진 기술 부채 / 개선 여지

- `src/app/page.tsx`가 약 2,700줄짜리 단일 컴포넌트다. 캘린더 렌더링, 탭별 리스트, 등록 폼, 팝업, 인증 폼이 전부 한 파일에 있어 변경 시 영향 범위 파악이 어렵고 diff가 커지기 쉽다. 기능별 컴포넌트 분리(캘린더, 탭, 모달, 인증)를 고려할 만하다.
- 테스트 코드가 없다(unit/e2e 전무).
- 지원 파서가 3개 사이트(리뷰노트, 강남맛집, 데일리뷰)뿐이라 체험단 사이트가 늘어날수록 `src/app/api/parse-link` 흐름과 파서 등록 절차가 반복 작업이 된다.
- 마이그레이션이 코드 내 지연 실행 방식이라, 스키마 변경 이력을 별도로 추적하기 어렵다(버전 관리된 마이그레이션 파일 없음).

## 문서 관리

- 기능/UX 동작 기준은 `AGENTS.md`가 유일한 소스다. 이 파일(`CLAUDE.md`)은 `@AGENTS.md`로 그 내용을 그대로 불러오고, 위 분석 섹션만 추가로 관리한다.
- 코드 구조가 바뀌면(파일 분리, 파서 추가, 디렉터리 정리 등) 위 분석 섹션을 함께 갱신한다.
