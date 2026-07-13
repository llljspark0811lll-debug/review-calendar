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
      gangnam/ reviewnote/ site-connections/ automation-jobs/   # 빈 디렉터리(사용 안 함, 정리 대상)
  lib/
    auth.ts            # 세션/비밀번호 해시
    db.ts              # DB 연결, 스키마 부트스트랩, 전체 쿼리
    holidays.ts         # 공휴일 API 동기화
    parsers/            # 도메인 → 파서 라우팅 (index.ts, types.ts, gangnam.ts, review-note.ts, dailyview.ts)
    gangnam/parser.ts    # 강남맛집 실제 파싱 로직
    review-note/parser.ts # 리뷰노트 실제 파싱 로직 (현재 사이트 정책상 상시 실패)
    dailyview/parser.ts   # 데일리뷰 실제 파싱 로직
  types/
    campaign.ts, holiday.ts
```

주의: `src/app/api/{gangnam,reviewnote,site-connections,automation-jobs}`는 현재 빈 디렉터리다. 과거 구조의 잔재로 보이며, 사용자 확인 없이 임의로 지우지 않는다.

### 인증 (`src/lib/auth.ts`)

- 아이디+비밀번호 로그인, 비밀번호는 서버 해시 저장.
- 세션은 HttpOnly 쿠키 + `user_sessions` 테이블 조합.
- 회원가입 시 이메일 인증번호(Resend 발송, `send-email-code`)를 확인해야 하며, 이메일은 로그인 식별자가 아니다.
- 모든 체험단/공휴일 API는 로그인 세션이 있어야 접근 가능.

### 체험단 파서 구조 (`src/lib/parsers/`)

- **2026-07-13 붙여넣기 기반으로 개편.** 등록 흐름은 더 이상 "링크만 넣기"가 아니라 "선정된 체험단 페이지를 통째로 붙여넣기"가 기본이다. `index.ts`가 `parseCampaignContent(raw, userId)`를 공통 진입점으로 노출하며, 붙여넣은 내용이 순수 URL 문자열(줄바꿈 없는 `http(s)://...`)이면 기존 `parseCampaignLink` 경로(서버 `fetch`)로, 그 외(페이지 전체 복사본)면 내용 안의 도메인/브랜드 문자열로 사이트를 판별해 각 파서의 `parseContent(html)`를 직접 호출한다.
- `CampaignParser` 인터페이스는 `canHandle`/`parse`(URL 기반 fetch) 외에 `parseContent`(순수 HTML 문자열 파싱, 네트워크 없음)를 필수로 구현한다. 세 어댑터(`lib/parsers/{gangnam,dailyview,review-note}.ts`) 모두 두 경로를 지원한다.
- 각 사이트의 실제 파싱 로직(`lib/{gangnam,dailyview,review-note}/parser.ts`)은 `parseXxxCampaignHtml(html, href)` 순수 함수로 분리돼 있고, fetch 기반 함수(`parseXxxCampaign(id, href)`)는 이 순수 함수를 감싸는 얇은 래퍼다. 새 사이트를 추가하려면: (1) `lib/<site>/parser.ts`에 `parseXxxCampaignHtml` 구현 (2) 필요하면 fetch 래퍼도 추가 (3) `lib/parsers/<site>.ts` 어댑터에 `canHandle`/`parse`/`parseContent` 연결 (4) `lib/parsers/index.ts`의 `parserMatchers`와 `contentSiteSignatures`에 등록.
- 지원 도메인/브랜드: `reviewnote.co.kr`/리뷰노트, `강남맛집.net`(퓨니코드 `xn--939au0g4vj8sq.net`), `dailyview.kr`/데일리뷰.
- **리뷰노트는 링크 fetch로는 여전히 불가능하다.** `GET /api/campaign`이 401을 반환하고, `review_information.php` 같은 개인 페이지는 비로그인 시 `alert('로그인하셔야 이용가능합니다')` + 로그인 리다이렉트만 내려온다(본문 자체가 없음, 2026-07-13 재확인). 대신 사용자가 로그인한 브라우저에서 페이지를 통째로 복사해 붙여넣는 `parseReviewNoteCampaignHtml`로 지원한다. 이 함수는 (1) HTML을 줄 단위 텍스트로 변환해 "제공서비스/물품"/"방문 주소"/"방문 및 예약 안내" 라벨 다음 값을 추출하고 (2) 캘린더는 FullCalendar의 `data-date="YYYY-MM-DD"` 속성과 `fc-event-start`/`fc-event-end` 클래스를 이용해 "체험&리뷰"(체험 기간), "마감"(리뷰 마감일) 이벤트의 정확한 날짜 범위를 계산한다 — 실제 캠페인 2건의 개발자도구 마크업으로 검증 완료. 업체 연락처는 페이지에 있어도 자동 추출하지 않고 항상 수동 입력을 유지한다(AGENTS.md 원칙).
- 강남맛집 파서(`lib/gangnam/parser.ts`)는 과거 `rejectUnauthorized:false` + 하드코딩 fallback IP로 우회하던 커스텀 http/https 클라이언트였으나, 실제로는 표준 `fetch()`로 인증서 검증을 켠 채 정상 접속됨을 확인하고 2026-07-11에 표준 `fetch()` 기반으로 교체함(MITM 위험 제거). 모집인원(`capacity`) 파싱도 `신청<em id="ask_count">` 정규식이 실제 마크업 `신청자 <em id="ask_count">`와 어긋나 항상 실패하던 것을 수정함 — 실제 캠페인 6건 재현 테스트로 확인.
- 데일리뷰(`lib/dailyview/parser.ts`)는 2026-07-13에 신규 추가한 자동 파서다. 캠페인 상세 페이지가 서버에서 완전히 렌더링돼 있어(`<div class="itname">` 제목, `<div class="it_cp_reward_cut">` 제공내역, `신청 N / 모집 N` 모집인원, `리뷰 등록기간 MM.DD(요일)~MM.DD(요일)` 기간) 강남맛집과 동일한 정규식 스크래핑 방식으로 구현. 실제 캠페인 6건(수원·평택·부산 3곳·서울) 재현 테스트로 검증 완료. 다만 데일리뷰도 선정 후 개인 페이지(`review_information.php?rv_id=`)는 리뷰노트와 동일하게 로그인 벽이 있어, 그 경우엔 붙여넣기 경로로만 등록 가능하다. 업체 주소는 페이지에 텍스트로 없고 카카오맵 좌표(`lat`/`lng`)만 있어 리버스 지오코딩 없이는 못 채우므로 강남맛집과 동일하게 "주소 확인 필요" 기본값 사용.

### 데이터 모델 (`src/types/campaign.ts`, `db.ts`)

- `Campaign.status`: `unscheduled → scheduled → completed → review_submitted` (취소 시 바로 이전 단계로만 되돌아감, 역방향 스킵 없음).
- 주요 필드: `detailUrl`, `experienceStartDate/EndDate`, `reviewDeadline`, `selectedDate`, `companyName/Phone`, `contactLocked`.
- 캠페인은 `userId` 기준으로 격리 저장됨(사용자 간 데이터 분리).
- 공휴일은 한국천문연구원 API를 동기화해 DB에 캐시하고(`holidays.ts`), 실패해도 체험단 기능에는 영향 없음.

### 알려진 기술 부채 / 개선 여지

- `src/app/page.tsx`가 약 2,700줄짜리 단일 컴포넌트다. 캘린더 렌더링, 탭별 리스트, 등록 폼, 팝업, 인증 폼이 전부 한 파일에 있어 변경 시 영향 범위 파악이 어렵고 diff가 커지기 쉽다. 기능별 컴포넌트 분리(캘린더, 탭, 모달, 인증)를 고려할 만하다.
- 테스트 코드가 없다(unit/e2e 전무). `scripts/` 디렉터리도 비어 있다.
- 지원 파서가 2개 사이트(리뷰노트, 강남맛집)뿐이라 체험단 사이트가 늘어날수록 `src/app/api/parse-link` 흐름과 파서 등록 절차가 반복 작업이 된다.
- `src/app/api/{gangnam,reviewnote,site-connections,automation-jobs}` 빈 디렉터리는 정리 필요(단, 임의 삭제 금지 — 사용자 확인 후).
- 마이그레이션이 코드 내 지연 실행 방식이라, 스키마 변경 이력을 별도로 추적하기 어렵다(버전 관리된 마이그레이션 파일 없음).

## 문서 관리

- 기능/UX 동작 기준은 `AGENTS.md`가 유일한 소스다. 이 파일(`CLAUDE.md`)은 `@AGENTS.md`로 그 내용을 그대로 불러오고, 위 분석 섹션만 추가로 관리한다.
- 코드 구조가 바뀌면(파일 분리, 파서 추가, 디렉터리 정리 등) 위 분석 섹션을 함께 갱신한다.
