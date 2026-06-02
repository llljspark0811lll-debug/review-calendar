const weekDays = ["일", "월", "화", "수", "목", "금", "토"];

const monthlyBadges = [
  "오늘 등록 링크 3개",
  "이번 주 마감 2개",
  "픽 대기 체험단 4개",
];

const tabs = ["이번 달", "날짜 미정", "마감 임박", "즐겨찾기"];

const campaigns = [
  {
    id: 1,
    title: "멜티베리 카페",
    site: "리뷰노트",
    reward: "2인 디저트 세트",
    status: "픽 완료",
    period: "6월 4일 - 6월 10일",
    deadline: "6월 12일",
    picked: "6월 6일 18:30",
    accent: "from-[#ff7eb6] via-[#ffb5d6] to-[#ffe3ef]",
    sticker: "리본 픽",
  },
  {
    id: 2,
    title: "키라키라 스킨랩",
    site: "데일리뷰",
    reward: "89,000원 스킨케어 박스",
    status: "마감 임박",
    period: "6월 8일 - 6월 14일",
    deadline: "6월 16일",
    picked: "6월 9일 15:00",
    accent: "from-[#ffbf83] via-[#ffe0af] to-[#fff4d9]",
    sticker: "리뷰 급해요",
  },
  {
    id: 3,
    title: "문바니 호텔",
    site: "포포몬",
    reward: "1박 숙박권",
    status: "날짜 미정",
    period: "6월 15일 - 6월 21일",
    deadline: "6월 24일",
    picked: "아직 미정",
    accent: "from-[#c9a4ff] via-[#e1c6ff] to-[#f7e8ff]",
    sticker: "골라주세요",
  },
];

const quickNotes = [
  {
    label: "오늘 메모",
    title: "강남 카페 주차 가능 여부 꼭 물어보기",
    meta: "저장됨",
    tone: "pink",
  },
  {
    label: "전화 체크",
    title: "점심 피크 끝난 뒤 2시에 업체 연락하기",
    meta: "오후 2:00",
    tone: "yellow",
  },
  {
    label: "리뷰 마감",
    title: "솜사탕스시 리뷰 업로드 D-1",
    meta: "D-1",
    tone: "lavender",
  },
];

const detailCards = [
  { label: "제공 내역", value: "디저트 플래터 + 시그니처 소다 2잔" },
  { label: "가능 인원", value: "2인" },
  { label: "체험 기간", value: "2026-06-04 ~ 2026-06-10" },
  { label: "리뷰 마감일", value: "2026-06-12" },
  { label: "전화번호", value: "010-4312-7788" },
  { label: "픽한 일정", value: "2026-06-06 18:30" },
];

const calendarCells = [
  { day: 26, muted: true },
  { day: 27, muted: true },
  { day: 28, muted: true },
  { day: 29, muted: true },
  { day: 30, muted: true },
  { day: 31, muted: true },
  { day: 1, label: "신규 등록", type: "soft", deco: "✿" },
  { day: 2, label: "링크 2건", type: "soft", deco: "♡" },
  { day: 3, label: "업체 연락", type: "warn", deco: "☎" },
  { day: 4, label: "체험 시작", type: "primary", deco: "★" },
  { day: 5, label: "후보 2개", type: "soft", deco: "✦" },
  { day: 6, label: "방문 확정", sub: "18:30", type: "selected", deco: "🎀" },
  { day: 7, label: "숙박 후보", type: "lavender", deco: "☁" },
  { day: 8, label: "스킨랩 체험", type: "primary", deco: "✿" },
  { day: 9, label: "방문 확정", sub: "15:00", type: "selected", deco: "🎀" },
  { day: 10, label: "사진 촬영", type: "soft", deco: "📷" },
  { day: 11, label: "리뷰 초안", type: "warn", deco: "✎" },
  { day: 12, label: "리뷰 마감", type: "danger", deco: "!" },
  { day: 13, label: "일정 선택 가능", type: "soft", deco: "♡" },
  { day: 14, label: "숙박 준비", type: "lavender", deco: "☾" },
  { day: 15, label: "체험 가능", type: "primary", deco: "★" },
  { day: 16, label: "마감일", type: "danger", deco: "!" },
  { day: 17, label: "카페 후보", type: "soft", deco: "✿" },
  { day: 18, label: "뷰티 일정", type: "soft", deco: "♡" },
  { day: 19, label: "업체 연락", type: "warn", deco: "☎" },
  { day: 20, label: "여유 일정", type: "plain", deco: "☁" },
  { day: 21, label: "마지막 방문일", type: "primary", deco: "★" },
  { day: 22, label: "리뷰 작성", type: "warn", deco: "✎" },
  { day: 23, label: "제공 내역 확인", type: "soft", deco: "♡" },
  { day: 24, label: "숙박 리뷰 마감", type: "danger", deco: "!" },
  { day: 25, label: "일정 선택 가능", type: "soft", deco: "✿" },
  { day: 26, label: "새 링크 등록?", type: "lavender", deco: "☾" },
  { day: 27, label: "브런치 체험", type: "soft", deco: "♡" },
  { day: 28, label: "비어 있음", type: "plain", deco: "·" },
  { day: 29, label: "비어 있음", type: "plain", deco: "·" },
  { day: 30, label: "비어 있음", type: "plain", deco: "·" },
  { day: 1, muted: true },
  { day: 2, muted: true },
  { day: 3, muted: true },
  { day: 4, muted: true },
  { day: 5, muted: true },
];

const cellStyles: Record<string, string> = {
  plain: "bg-white/80 border-white/70 text-[#a66384]",
  soft: "bg-[#fff2f8] border-[#ffd2e6] text-[#a04676]",
  primary: "bg-[#ffc9e1] border-[#ff9fc6] text-[#7c2752]",
  selected:
    "bg-[linear-gradient(180deg,#ff88bb_0%,#ff9bc7_100%)] border-[#ff5ea3] text-white shadow-[0_20px_32px_rgba(255,104,174,0.34)]",
  warn: "bg-[#fff0c9] border-[#ffd07a] text-[#8a5b19]",
  danger: "bg-[#ffd5dd] border-[#ff95a7] text-[#8b314a]",
  lavender: "bg-[#f1e7ff] border-[#d4b5ff] text-[#7741a4]",
};

function Badge({
  children,
  tone = "pink",
}: {
  children: React.ReactNode;
  tone?: "pink" | "yellow" | "lavender" | "mint";
}) {
  const toneClass =
    tone === "yellow"
      ? "bg-[#fff0bf] text-[#8b5e1c]"
      : tone === "lavender"
        ? "bg-[#ece0ff] text-[#7646a6]"
        : tone === "mint"
          ? "bg-[#ddfff4] text-[#26766a]"
          : "bg-[#ffdced] text-[#ac4679]";

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-bold tracking-[0.08em] shadow-[0_8px_18px_rgba(255,202,225,0.38)] ${toneClass}`}
    >
      {children}
    </span>
  );
}

function SectionTitle({
  eyebrow,
  title,
  action,
}: {
  eyebrow: string;
  title: string;
  action?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="font-display text-xs tracking-[0.18em] text-[#de6aa2]">
          {eyebrow}
        </p>
        <h2 className="mt-2 text-2xl font-black text-[#8f315f]">{title}</h2>
      </div>
      {action ? (
        <button className="rounded-full bg-white px-4 py-2 text-sm font-bold text-[#c6538c] shadow-[0_10px_22px_rgba(255,190,219,0.4)] transition-transform hover:-translate-y-0.5">
          {action}
        </button>
      ) : null}
    </div>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[linear-gradient(180deg,#ffeaf5_0%,#ffdceb_35%,#ffeaf7_100%)] text-[#7f355b]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(255,255,255,0.8)_0,rgba(255,255,255,0)_16%),radial-gradient(circle_at_82%_10%,rgba(255,246,190,0.65)_0,rgba(255,246,190,0)_12%),radial-gradient(circle_at_80%_70%,rgba(229,214,255,0.75)_0,rgba(229,214,255,0)_16%),linear-gradient(135deg,rgba(255,255,255,0.14)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.14)_50%,rgba(255,255,255,0.14)_75%,transparent_75%,transparent)] bg-[length:auto,auto,auto,28px_28px] opacity-80" />
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-8 px-4 py-5 sm:px-6 lg:px-8">
        <header className="relative overflow-hidden rounded-[42px] border-2 border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.72),rgba(255,245,251,0.92))] p-6 shadow-[0_30px_80px_rgba(233,116,171,0.2)] backdrop-blur-xl sm:p-8">
          <div className="absolute right-6 top-5 rounded-full bg-[#ffe37f] px-4 py-2 text-xs font-black text-[#9c6b1d] shadow-[0_10px_24px_rgba(255,227,127,0.4)]">
            NEW
          </div>
          <div className="absolute -left-6 top-12 rotate-[-10deg] rounded-[22px] bg-[#ffd4ea] px-5 py-2 text-sm font-black text-[#b6477f] shadow-[0_18px_30px_rgba(255,174,212,0.42)]">
            sticker diary
          </div>
          <div className="absolute bottom-5 right-10 text-5xl">🎀</div>
          <div className="absolute right-32 top-20 text-4xl">⭐</div>
          <div className="absolute left-1/2 top-4 h-6 w-28 -translate-x-1/2 rounded-full bg-[#ffe6f2]/90 shadow-[0_6px_14px_rgba(255,194,221,0.4)]" />

          <div className="relative flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-5 flex flex-wrap gap-3">
                <Badge>다꾸 모드</Badge>
                <Badge tone="yellow">{monthlyBadges[0]}</Badge>
                <Badge tone="lavender">{monthlyBadges[1]}</Badge>
                <Badge tone="mint">{monthlyBadges[2]}</Badge>
              </div>

              <div className="rounded-[34px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,240,247,0.95),rgba(255,248,252,0.82))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                <p className="font-display text-sm tracking-[0.18em] text-[#d7649f]">
                  체험단 일정 다이어리
                </p>
                <h1 className="mt-3 font-display text-4xl leading-tight text-[#8f315f] sm:text-5xl lg:text-6xl">
                  리뷰캘린더
                </h1>
                <p className="mt-3 text-xl font-black text-[#e36aa6] sm:text-2xl">
                  선정된 체험단을 스티커 다이어리처럼 한눈에 관리해요
                </p>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-[#8d5b75] sm:text-base">
                  링크 등록, 일정 픽, 리뷰 마감 관리까지 한 화면에서 끝.
                  귀엽지만 실전에서는 엄청 편한 나만의 체험단 커맨드 센터예요.
                </p>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                {tabs.map((tab, index) => (
                  <button
                    key={tab}
                    className={`rounded-full px-5 py-3 text-sm font-bold shadow-[0_12px_22px_rgba(255,193,219,0.38)] transition-transform hover:-translate-y-0.5 ${
                      index === 0
                        ? "bg-[#ff8cbc] text-white"
                        : "bg-white text-[#c45991]"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid min-w-[320px] gap-4 rounded-[32px] bg-[linear-gradient(180deg,rgba(255,241,248,0.98),rgba(255,230,242,0.88))] p-4 shadow-[0_24px_36px_rgba(255,181,213,0.3)] sm:grid-cols-2 lg:w-[390px]">
              <button className="relative overflow-hidden rounded-[28px] bg-[linear-gradient(180deg,#ff7bb8_0%,#ff94c4_100%)] px-5 py-5 text-left text-white shadow-[0_18px_30px_rgba(255,123,184,0.38)] transition-transform hover:-translate-y-1">
                <span className="absolute right-4 top-3 text-3xl">✚</span>
                <span className="block text-sm font-bold tracking-[0.14em]">
                  메인 액션
                </span>
                <span className="mt-3 block font-display text-2xl">
                  링크 등록
                </span>
                <span className="mt-2 block text-xs text-white/85">
                  선정된 체험단 링크를 바로 추가
                </span>
              </button>

              <button className="relative overflow-hidden rounded-[28px] border border-white/80 bg-white/92 px-5 py-5 text-left text-[#c4518a] shadow-[0_18px_30px_rgba(255,191,220,0.26)] transition-transform hover:-translate-y-1">
                <span className="absolute right-4 top-3 text-3xl">♡</span>
                <span className="block text-sm font-bold tracking-[0.14em]">
                  빠른 이동
                </span>
                <span className="mt-3 block font-display text-2xl">
                  사이트 계정
                </span>
                <span className="mt-2 block text-xs text-[#c97aa4]">
                  로그인 연동 상태 확인
                </span>
              </button>
            </div>
          </div>
        </header>

        <section className="grid gap-8 xl:grid-cols-[1.18fr_0.82fr]">
          <div className="grid gap-8">
            <article className="relative overflow-hidden rounded-[42px] border-2 border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.72),rgba(255,244,250,0.94))] p-5 shadow-[0_30px_70px_rgba(233,116,171,0.18)] sm:p-6">
              <div className="absolute left-8 top-0 h-7 w-24 -translate-y-1/2 rounded-full bg-[#ffe59e] shadow-[0_10px_16px_rgba(255,229,158,0.5)]" />
              <div className="absolute right-10 top-6 rotate-6 rounded-[18px] bg-[#ffe0f0] px-4 py-2 text-xs font-black text-[#c45289] shadow-[0_10px_20px_rgba(255,192,221,0.35)]">
                6월 스프레드
              </div>

              <SectionTitle
                eyebrow="마스킹테이프 캘린더"
                title="2026년 6월"
                action="월간 보기"
              />

              <div className="mt-6 grid grid-cols-7 gap-2 text-center text-xs font-black tracking-[0.18em] text-[#cb6c9f] sm:gap-3 sm:text-sm">
                {weekDays.map((day) => (
                  <div
                    key={day}
                    className="rounded-full border border-white/70 bg-[#ffe8f3] py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]"
                  >
                    {day}
                  </div>
                ))}
              </div>

              <div className="mt-4 grid grid-cols-7 gap-2 sm:gap-3">
                {calendarCells.map((cell, index) => {
                  const tone = cell.muted
                    ? "bg-white/50 border-white/40 text-[#d9aec6]"
                    : cellStyles[cell.type ?? "plain"];

                  return (
                    <button
                      key={`${cell.day}-${index}`}
                      className={`relative min-h-28 rounded-[28px] border p-3 text-left shadow-[0_14px_26px_rgba(255,197,223,0.22)] transition-all hover:-translate-y-1 hover:rotate-[-1deg] hover:shadow-[0_20px_34px_rgba(255,145,197,0.28)] sm:min-h-32 ${tone}`}
                    >
                      {!cell.muted && (
                        <span className="absolute right-3 top-2 text-sm opacity-80">
                          {cell.deco}
                        </span>
                      )}
                      <span className="text-lg font-black sm:text-xl">
                        {cell.day}
                      </span>
                      {cell.label ? (
                        <>
                          <p className="mt-5 text-xs font-bold leading-5 sm:text-sm">
                            {cell.label}
                          </p>
                          {cell.sub ? (
                            <p className="mt-1 text-[11px] font-black opacity-80">
                              {cell.sub}
                            </p>
                          ) : null}
                        </>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </article>

            <article className="relative overflow-hidden rounded-[42px] border-2 border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.72),rgba(255,244,250,0.94))] p-5 shadow-[0_30px_70px_rgba(233,116,171,0.18)] sm:p-6">
              <div className="absolute left-12 top-5 rotate-[-5deg] rounded-[18px] bg-[#f2e4ff] px-4 py-2 text-xs font-black text-[#7c49ae] shadow-[0_10px_20px_rgba(216,190,255,0.4)]">
                selected list
              </div>
              <SectionTitle
                eyebrow="스티커 카드 목록"
                title="선정된 체험단"
                action="필터"
              />

              <div className="mt-6 grid gap-4">
                {campaigns.map((campaign) => (
                  <button
                    key={campaign.id}
                    className={`rounded-[34px] bg-gradient-to-r ${campaign.accent} p-[1px] text-left shadow-[0_22px_34px_rgba(255,173,211,0.28)] transition-transform hover:-translate-y-1`}
                  >
                    <div className="relative overflow-hidden rounded-[33px] bg-white/92 p-5">
                      <div className="absolute right-4 top-4 rotate-6 rounded-full bg-[#fff1f8] px-3 py-1 text-xs font-black text-[#cc558f] shadow-[0_8px_18px_rgba(255,204,229,0.35)]">
                        {campaign.sticker}
                      </div>
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="pr-16">
                          <div className="flex flex-wrap gap-2">
                            <Badge>{campaign.site}</Badge>
                            <Badge tone="yellow">{campaign.status}</Badge>
                          </div>
                          <h3 className="mt-3 text-2xl font-black text-[#8d315f]">
                            {campaign.title}
                          </h3>
                          <p className="mt-2 text-sm text-[#92617c]">
                            제공 내역: {campaign.reward}
                          </p>
                        </div>
                        <div className="grid gap-3 text-sm text-[#8d5672] sm:grid-cols-3 lg:min-w-[430px]">
                          <InfoMini label="체험 기간" value={campaign.period} />
                          <InfoMini label="리뷰 마감" value={campaign.deadline} />
                          <InfoMini label="픽한 날짜" value={campaign.picked} />
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </article>
          </div>

          <aside className="grid gap-8">
            <article className="relative overflow-hidden rounded-[42px] border-2 border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.76),rgba(255,244,250,0.94))] p-5 shadow-[0_30px_70px_rgba(233,116,171,0.18)] sm:p-6">
              <div className="absolute right-10 top-4 rotate-[8deg] rounded-[18px] bg-[#fff0bc] px-4 py-2 text-xs font-black text-[#9a6819] shadow-[0_10px_18px_rgba(255,236,167,0.45)]">
                check memo
              </div>
              <SectionTitle
                eyebrow="메모 스티커 보드"
                title="오늘의 체크 포인트"
                action="메모 추가"
              />
              <div className="mt-6 grid gap-4">
                {quickNotes.map((note) => (
                  <div
                    key={note.title}
                    className={`rotate-[-1deg] rounded-[28px] p-[1px] ${
                      note.tone === "yellow"
                        ? "bg-[linear-gradient(135deg,#ffd87d,#fff0c9)]"
                        : note.tone === "lavender"
                          ? "bg-[linear-gradient(135deg,#cfb3ff,#f1e7ff)]"
                          : "bg-[linear-gradient(135deg,#ff9fcb,#ffe2f0)]"
                    } shadow-[0_18px_28px_rgba(255,193,219,0.25)]`}
                  >
                    <div className="rounded-[27px] bg-white/88 px-4 py-4">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-display text-lg text-[#d2518f]">
                          {note.label}
                        </span>
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#c25b8f] shadow-[0_6px_14px_rgba(255,204,227,0.32)]">
                          {note.meta}
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-[#8b5974]">
                        {note.title}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <article className="relative overflow-hidden rounded-[42px] border-2 border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.76),rgba(255,244,250,0.94))] p-5 shadow-[0_30px_70px_rgba(233,116,171,0.18)] sm:p-6">
              <div className="absolute left-10 top-4 rotate-[-8deg] rounded-[18px] bg-[#ffd6ec] px-4 py-2 text-xs font-black text-[#c24a85] shadow-[0_10px_18px_rgba(255,194,221,0.45)]">
                detail memo
              </div>
              <SectionTitle
                eyebrow="선택된 체험단"
                title="상세 정보"
                action="수정"
              />

              <div className="mt-6 rounded-[34px] bg-[linear-gradient(180deg,rgba(255,242,248,0.95),rgba(255,232,243,0.88))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                <div className="flex flex-wrap gap-2">
                  <Badge>리뷰노트</Badge>
                  <Badge tone="lavender">연락처 확인 가능</Badge>
                </div>
                <h3 className="mt-3 text-3xl font-black text-[#8f315f]">
                  멜티베리 카페
                </h3>
                <p className="mt-2 text-sm leading-6 text-[#8a5d75]">
                  체험 전에 꼭 보는 핵심 정보만 따로 모아둔 메모 카드예요.
                  주소, 전화번호, 마감일, 픽한 시간까지 빠르게 확인할 수 있어요.
                </p>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {detailCards.map((item) => (
                    <div
                      key={item.label}
                      className="rounded-[24px] border border-white/70 bg-white/85 px-4 py-3 shadow-[0_10px_18px_rgba(255,207,229,0.18)]"
                    >
                      <p className="text-xs font-black tracking-[0.12em] text-[#d85f98]">
                        {item.label}
                      </p>
                      <p className="mt-2 text-sm font-bold text-[#7b4b66]">
                        {item.value}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-3 rounded-[24px] border border-white/70 bg-white/85 px-4 py-3 shadow-[0_10px_18px_rgba(255,207,229,0.18)]">
                  <p className="text-xs font-black tracking-[0.12em] text-[#d85f98]">
                    주소
                  </p>
                  <p className="mt-2 text-sm font-bold text-[#7b4b66]">
                    서울 강남구 강남대로 인근
                  </p>
                </div>
              </div>
            </article>

            <article className="relative overflow-hidden rounded-[42px] border-2 border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.76),rgba(255,244,250,0.94))] p-5 shadow-[0_30px_70px_rgba(233,116,171,0.18)] sm:p-6">
              <SectionTitle eyebrow="하트 통계" title="진행 상태" />
              <div className="mt-6 grid gap-4 sm:grid-cols-3 xl:grid-cols-1">
                <StatCard
                  title="날짜 미정"
                  value="04"
                  bg="bg-[#ffddec]"
                  text="text-[#8b2f58]"
                />
                <StatCard
                  title="마감 임박"
                  value="02"
                  bg="bg-[#fff1c4]"
                  text="text-[#8f5c14]"
                />
                <StatCard
                  title="연동된 사이트"
                  value="03"
                  bg="bg-[#eee1ff]"
                  text="text-[#7044a0]"
                />
              </div>
            </article>
          </aside>
        </section>
      </div>
    </main>
  );
}

function InfoMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] bg-[#fff5fb] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
      <p className="text-xs font-black tracking-[0.12em] text-[#d45d96]">
        {label}
      </p>
      <p className="mt-2 text-sm font-bold text-[#87526f]">{value}</p>
    </div>
  );
}

function StatCard({
  title,
  value,
  bg,
  text,
}: {
  title: string;
  value: string;
  bg: string;
  text: string;
}) {
  const wrapperClass =
    "rounded-[28px] px-4 py-4 shadow-[0_14px_24px_rgba(255,196,223,0.22)] " +
    bg;
  const textClass = "text-xs font-black tracking-[0.12em] " + text;
  const valueClass = "mt-2 font-display text-4xl " + text;

  return (
    <div className={wrapperClass}>
      <p className={textClass}>{title}</p>
      <p className={valueClass}>{value}</p>
    </div>
  );
}
