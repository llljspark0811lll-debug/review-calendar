"use client";

import {
  type ClipboardEvent,
  type FormEvent,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import type { Campaign, CampaignStatus } from "@/types/campaign";
import type { Holiday } from "@/types/holiday";

const weekDays = ["일", "월", "화", "수", "목", "금", "토"];
const dashboardTabs = [
  { id: "calendar", label: "캘린더" },
  { id: "selected", label: "선정체험단" },
  { id: "completed", label: "체험완료" },
  { id: "review", label: "리뷰완료" },
] as const;

type DashboardTabId = (typeof dashboardTabs)[number]["id"];
type AppUser = {
  id: string;
  username: string;
  email: string;
  name: string;
  createdAt: string;
};
type AuthMode = "login" | "register";
type ParsedCampaignPreview = Omit<Campaign, "id" | "companyPhone" | "contactLocked">;

type CheckpointTone = "pink" | "yellow" | "lavender";

type CheckpointCardData = {
  id: "today-visit" | "deadline-soon" | "pending-complete";
  label: string;
  countLabel: string;
  summary: string;
  tone: CheckpointTone;
  campaigns: Campaign[];
};

type CalendarTone =
  | "plain"
  | "soft"
  | "primary"
  | "selected"
  | "warn"
  | "danger"
  | "lavender";

type CalendarCell = {
  key: string;
  day: number;
  dateIso?: string;
  muted?: boolean;
  holidayName?: string;
  isAlternativeHoliday?: boolean;
  label?: string;
  entries?: string[];
  secondaryLabel?: string;
  secondaryEntries?: string[];
  tertiaryLabel?: string;
  tertiaryEntries?: string[];
  deco?: string;
  type?: CalendarTone;
};

const cellStyles: Record<CalendarTone, string> = {
  plain: "bg-white/80 border-white/70 text-[#a66384]",
  soft: "bg-[#fff2f8] border-[#ffd2e6] text-[#a04676]",
  primary: "bg-[#ffc9e1] border-[#ff9fc6] text-[#7c2752]",
  selected:
    "bg-[linear-gradient(180deg,#ff88bb_0%,#ff9bc7_100%)] border-[#ff5ea3] text-white shadow-[0_20px_32px_rgba(255,104,174,0.34)]",
  warn: "bg-[#fff0c9] border-[#ffd07a] text-[#8a5b19]",
  danger: "bg-[#ffd5dd] border-[#ff95a7] text-[#8b314a]",
  lavender: "bg-[#f1e7ff] border-[#d4b5ff] text-[#7741a4]",
};

function formatMonthDay(dateString: string) {
  const date = new Date(dateString);
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

async function readApiJson<T>(
  response: Response,
  fallbackMessage: string,
): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    try {
      return (await response.json()) as T;
    } catch {
      return { message: fallbackMessage } as T;
    }
  }

  return { message: fallbackMessage } as T;
}

function formatDateTime(dateString: string | null) {
  if (!dateString) {
    return "아직 미정";
  }

  const date = new Date(dateString);
  const hour = `${date.getHours()}`.padStart(2, "0");
  const minute = `${date.getMinutes()}`.padStart(2, "0");
  return `${date.getMonth() + 1}월 ${date.getDate()}일 ${hour}:${minute}`;
}

function formatIsoDate(year: number, month: number, day: number) {
  return `${year}-${`${month}`.padStart(2, "0")}-${`${day}`.padStart(2, "0")}`;
}

function formatShortDate(iso: string) {
  const [, month, day] = iso.split("-");

  if (!month || !day) {
    return iso;
  }

  return `${Number(month)}.${Number(day)}`;
}

function getMonthRange(year: number, month: number) {
  return {
    startDate: formatIsoDate(year, month, 1),
    endDate: formatIsoDate(year, month, new Date(year, month, 0).getDate()),
  };
}

function formatConfirmedSchedule(dateString: string | null, holidayMap: Map<string, Holiday>) {
  if (!dateString) {
    return "아직 미정";
  }

  const formatted = formatDateTime(dateString);
  const holiday = holidayMap.get(dateString.slice(0, 10));

  return holiday ? `${formatted} (${holiday.name})` : formatted;
}

function statusLabel(status: CampaignStatus) {
  switch (status) {
    case "scheduled":
      return "확정 완료";
    case "completed":
      return "체험 완료";
    case "review_submitted":
      return "리뷰 완료";
    default:
      return "날짜 미정";
  }
}

function createCalendarCells(
  campaigns: Campaign[],
  holidays: Holiday[],
  year: number,
  month: number,
): CalendarCell[] {
  const cells: CalendarCell[] = [];
  const holidayMap = new Map(holidays.map((holiday) => [holiday.date, holiday]));
  const firstDayOfMonth = new Date(year, month - 1, 1);
  const firstWeekDay = firstDayOfMonth.getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const previousMonthLastDate = new Date(year, month - 1, 0).getDate();

  for (let i = 0; i < firstWeekDay; i += 1) {
    const prevDay = previousMonthLastDate - firstWeekDay + i + 1;
    cells.push({ key: `prev-${year}-${month}-${prevDay}`, day: prevDay, muted: true });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const iso = formatIsoDate(year, month, day);
    const holiday = holidayMap.get(iso);
    const activeCampaigns = campaigns.filter(
      (campaign) =>
        campaign.status === "unscheduled" &&
        campaign.experienceStartDate <= iso &&
        campaign.experienceEndDate >= iso,
    );
    const deadlineCampaigns = campaigns.filter(
      (campaign) =>
        (campaign.status === "unscheduled" || campaign.status === "scheduled") &&
        campaign.reviewDeadline === iso,
    );
    const pickedCampaigns = campaigns.filter(
      (campaign) =>
        campaign.status === "scheduled" &&
        campaign.selectedDate?.slice(0, 10) === iso,
    );

    const activeEntries = activeCampaigns.map((campaign) => campaign.title);
    const deadlineEntries = deadlineCampaigns.map((campaign) => campaign.title);
    const pickedEntries = pickedCampaigns.map(
      (campaign) =>
        `방문 · ${campaign.title} ${formatDateTime(campaign.selectedDate).split(" ").at(-1) ?? ""}`.trim(),
    );

    const sections = [
      activeCampaigns.length
        ? {
            label: `체험 ${activeCampaigns.length}건`,
            entries: activeEntries,
          }
        : null,
      deadlineCampaigns.length
        ? {
            label: `마감 ${deadlineCampaigns.length}건`,
            entries: deadlineEntries,
          }
        : null,
      pickedCampaigns.length
        ? {
            label: `방문 확정 ${pickedCampaigns.length}건`,
            entries: pickedEntries,
          }
        : null,
    ].filter((section): section is { label: string; entries: string[] } =>
      Boolean(section),
    );

    if (sections.length) {
      const type: CalendarTone = pickedCampaigns.length
        ? "selected"
        : deadlineCampaigns.length
          ? "danger"
          : activeCampaigns.length > 1
            ? "lavender"
            : "soft";

      cells.push({
        key: iso,
        dateIso: iso,
        day,
        holidayName: holiday?.name,
        isAlternativeHoliday: holiday?.isAlternative,
        label: sections[0].label,
        entries: sections[0].entries,
        secondaryLabel: sections[1]?.label,
        secondaryEntries: sections[1]?.entries,
        tertiaryLabel: sections[2]?.label,
        tertiaryEntries: sections[2]?.entries,
        type,
        deco: pickedCampaigns.length ? "🎀" : deadlineCampaigns.length ? "!" : "♡",
      });
      continue;
    }

    cells.push({
      key: iso,
      dateIso: iso,
      day,
      holidayName: holiday?.name,
      isAlternativeHoliday: holiday?.isAlternative,
      label: "비어 있음",
      type: "plain",
      deco: "·",
    });
  }

  let nextDay = 1;
  while (cells.length % 7 !== 0) {
    cells.push({
      key: `next-${year}-${month}-${nextDay}`,
      day: nextDay,
      muted: true,
    });
    nextDay += 1;
  }

  return cells;
}

function buildCheckpointSummary(campaigns: Campaign[], fallback: string) {
  if (!campaigns.length) {
    return fallback;
  }

  if (campaigns.length === 1) {
    return campaigns[0].title;
  }

  return `${campaigns[0].title} 외 ${campaigns.length - 1}건`;
}

export default function Home() {
  const today = new Date();
  const currentYear = today.getFullYear();
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authUsername, setAuthUsername] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authPasswordConfirm, setAuthPasswordConfirm] = useState("");
  const [authEmailCode, setAuthEmailCode] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [usernameCheckMessage, setUsernameCheckMessage] = useState("");
  const [emailCodeMessage, setEmailCodeMessage] = useState("");
  const [isAuthPending, setIsAuthPending] = useState(false);
  const [isUsernameCheckPending, setIsUsernameCheckPending] = useState(false);
  const [isEmailCodePending, setIsEmailCodePending] = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [activeDashboardTab, setActiveDashboardTab] =
    useState<DashboardTabId>("calendar");
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1);
  const [selectedCampaignPage, setSelectedCampaignPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [campaignToDelete, setCampaignToDelete] = useState<Campaign | null>(null);
  const [activeCheckpointId, setActiveCheckpointId] =
    useState<CheckpointCardData["id"] | null>(null);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [activeDateCell, setActiveDateCell] = useState<CalendarCell | null>(null);
  const [pasteContent, setPasteContent] = useState("");
  const [companyPhoneValue, setCompanyPhoneValue] = useState("");
  const [registerErrorMessage, setRegisterErrorMessage] = useState("");
  const [parsePreview, setParsePreview] = useState<ParsedCampaignPreview | null>(null);
  const [isParsingPreview, setIsParsingPreview] = useState(false);
  const [scheduleMessage, setScheduleMessage] = useState("");
  const [scheduleErrorMessage, setScheduleErrorMessage] = useState("");
  const [isBootstrapLoading, setIsBootstrapLoading] = useState(true);
  const [holidaySyncEnabled, setHolidaySyncEnabled] = useState(false);
  const [isSchedulePending, setIsSchedulePending] = useState(false);
  const [isDeletePending, setIsDeletePending] = useState(false);
  const [isPending, startTransition] = useTransition();

  const todayIso = formatIsoDate(
    today.getFullYear(),
    today.getMonth() + 1,
    today.getDate(),
  );
  const visibleMonthRange = useMemo(
    () => getMonthRange(selectedYear, selectedMonth),
    [selectedMonth, selectedYear],
  );
  const calendarCells = useMemo(
    () => createCalendarCells(campaigns, holidays, selectedYear, selectedMonth),
    [campaigns, holidays, selectedMonth, selectedYear],
  );
  const selectedCampaigns = useMemo(
    () =>
      campaigns.filter(
        (campaign) =>
          campaign.status === "unscheduled" || campaign.status === "scheduled",
      ),
    [campaigns],
  );
  const selectedCampaignPageCount = Math.max(
    1,
    Math.ceil(selectedCampaigns.length / 3),
  );
  const currentSelectedCampaignPage = Math.min(
    selectedCampaignPage,
    selectedCampaignPageCount,
  );
  const pagedSelectedCampaigns = useMemo(() => {
    const startIndex = (currentSelectedCampaignPage - 1) * 3;
    return selectedCampaigns.slice(startIndex, startIndex + 3);
  }, [currentSelectedCampaignPage, selectedCampaigns]);
  const completedCampaigns = useMemo(
    () => campaigns.filter((campaign) => campaign.status === "completed"),
    [campaigns],
  );
  const reviewedCampaigns = useMemo(
    () => campaigns.filter((campaign) => campaign.status === "review_submitted"),
    [campaigns],
  );
  const checkpointCards: CheckpointCardData[] = (() => {
    const todayVisitCampaigns = campaigns.filter(
      (campaign) =>
        campaign.status === "scheduled" &&
        campaign.selectedDate?.slice(0, 10) === todayIso,
    );

    const deadlineSoonCampaigns = campaigns
      .filter((campaign) => {
        if (campaign.status === "review_submitted") {
          return false;
        }

        const diff =
          new Date(campaign.reviewDeadline).getTime() - new Date(todayIso).getTime();
        const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
        return days >= 0 && days <= 3;
      })
      .sort((left, right) => left.reviewDeadline.localeCompare(right.reviewDeadline));

    const pendingCompleteCampaigns = campaigns
      .filter(
        (campaign) =>
          campaign.status === "scheduled" &&
          Boolean(campaign.selectedDate) &&
          campaign.selectedDate!.slice(0, 10) < todayIso,
      )
      .sort((left, right) =>
        (left.selectedDate ?? "").localeCompare(right.selectedDate ?? ""),
      );

    return [
      {
        id: "today-visit",
        label: "오늘 방문 일정",
        countLabel: `${todayVisitCampaigns.length}건`,
        summary: buildCheckpointSummary(
          todayVisitCampaigns,
          "오늘 방문 일정이 없어요",
        ),
        tone: "pink",
        campaigns: todayVisitCampaigns,
      },
      {
        id: "deadline-soon",
        label: "마감 임박",
        countLabel: `${deadlineSoonCampaigns.length}건`,
        summary: buildCheckpointSummary(
          deadlineSoonCampaigns,
          "임박한 리뷰 마감이 없어요",
        ),
        tone: "yellow",
        campaigns: deadlineSoonCampaigns,
      },
      {
        id: "pending-complete",
        label: "체험완료 미처리",
        countLabel: `${pendingCompleteCampaigns.length}건`,
        summary: buildCheckpointSummary(
          pendingCompleteCampaigns,
          "체험완료 처리 대기가 없어요",
        ),
        tone: "lavender",
        campaigns: pendingCompleteCampaigns,
      },
    ];
  })();
  const activeCheckpoint =
    checkpointCards.find((card) => card.id === activeCheckpointId) ?? null;
  const selectedCampaignForSelectedTab =
    pagedSelectedCampaigns.find((campaign) => campaign.id === selectedId) ??
    pagedSelectedCampaigns[0] ??
    null;
  const holidayMap = useMemo(
    () => new Map(holidays.map((holiday) => [holiday.date, holiday])),
    [holidays],
  );
  const yearOptions = (() => {
    const years = new Set<number>([
      currentYear - 2,
      currentYear - 1,
      currentYear,
      currentYear + 1,
      currentYear + 2,
    ]);

    for (const campaign of campaigns) {
      years.add(Number.parseInt(campaign.experienceStartDate.slice(0, 4), 10));
      years.add(Number.parseInt(campaign.experienceEndDate.slice(0, 4), 10));
      years.add(Number.parseInt(campaign.reviewDeadline.slice(0, 4), 10));
    }

    return Array.from(years).sort((left, right) => left - right);
  })();
  async function refreshBootstrap() {
    const response = await fetch("/api/bootstrap");
    const result = await readApiJson<{
      campaigns?: Campaign[];
      holidays?: Holiday[];
      holidaySyncEnabled?: boolean;
      message?: string;
    }>(response, "데이터를 다시 불러오지 못했어요.");

    if (!response.ok) {
      throw new Error(result.message ?? "데이터를 다시 불러오지 못했어요.");
    }

    const nextCampaigns = result.campaigns ?? [];

    setCampaigns(nextCampaigns);
    setHolidays(result.holidays ?? []);
    setHolidaySyncEnabled(Boolean(result.holidaySyncEnabled));

    return nextCampaigns;
  }

  useEffect(() => {
    let cancelled = false;

    fetch("/api/auth/me")
      .then(async (response) => {
        const result = await readApiJson<{ user?: AppUser | null }>(
          response,
          "로그인 상태를 확인하지 못했어요.",
        );

        if (cancelled) {
          return;
        }

        setCurrentUser(response.ok ? (result.user ?? null) : null);
      })
      .catch(() => {
        if (!cancelled) {
          setCurrentUser(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsAuthLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    let cancelled = false;

    fetch("/api/bootstrap")
      .then(async (response) => {
        const result = await readApiJson<{
          campaigns?: Campaign[];
          holidays?: Holiday[];
          holidaySyncEnabled?: boolean;
        }>(response, "데이터를 불러오지 못했어요.");

        if (!response.ok || cancelled) {
          return;
        }

        const nextCampaigns = result.campaigns ?? [];

        setCampaigns(nextCampaigns);
        setHolidays(result.holidays ?? []);
        setHolidaySyncEnabled(Boolean(result.holidaySyncEnabled));
        setSelectedId(nextCampaigns[0]?.id ?? null);
      })
      .finally(() => {
        if (!cancelled) {
          setIsBootstrapLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    let cancelled = false;

    fetch(
      `/api/holidays?startDate=${visibleMonthRange.startDate.slice(0, 4)}-01-01&endDate=${visibleMonthRange.startDate.slice(0, 4)}-12-31`,
    )
      .then(async (response) => {
        const result = await readApiJson<{
          holidays?: Holiday[];
          holidaySyncEnabled?: boolean;
        }>(response, "공휴일 정보를 불러오지 못했어요.");

        if (cancelled || !response.ok) {
          return;
        }

        setHolidays(result.holidays ?? []);
        setHolidaySyncEnabled(Boolean(result.holidaySyncEnabled));
      })
      .catch(() => {
        if (!cancelled) {
          setHolidays([]);
          setHolidaySyncEnabled(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [currentUser, visibleMonthRange.startDate]);

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthMessage("");
    setIsAuthPending(true);

    try {
      const response = await fetch(
        authMode === "login" ? "/api/auth/login" : "/api/auth/register",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            username: authUsername,
            email: authEmail,
            password: authPassword,
            passwordConfirm: authPasswordConfirm,
            emailCode: authEmailCode,
          }),
        },
      );
      const result = await readApiJson<{
        user?: AppUser;
        message?: string;
      }>(response, "로그인 처리 중 문제가 생겼어요.");

      if (!response.ok || !result.user) {
        throw new Error(result.message ?? "로그인 처리 중 문제가 생겼어요.");
      }

      setIsBootstrapLoading(true);
      setCurrentUser(result.user);
      setAuthUsername("");
      setAuthEmail("");
      setAuthPassword("");
      setAuthPasswordConfirm("");
      setAuthEmailCode("");
      setAuthMessage("");
      setUsernameCheckMessage("");
      setEmailCodeMessage("");
    } catch (error) {
      setAuthMessage(
        error instanceof Error
          ? error.message
          : "로그인 처리 중 문제가 생겼어요.",
      );
    } finally {
      setIsAuthPending(false);
    }
  }

  async function handleCheckUsername() {
    setUsernameCheckMessage("");
    setIsUsernameCheckPending(true);

    try {
      const response = await fetch(
        `/api/auth/check-username?username=${encodeURIComponent(authUsername)}`,
      );
      const result = await readApiJson<{
        available?: boolean;
        message?: string;
      }>(response, "아이디 확인 중 문제가 생겼어요.");

      if (!response.ok) {
        throw new Error(result.message ?? "아이디 확인 중 문제가 생겼어요.");
      }

      setUsernameCheckMessage(
        result.available
          ? "사용할 수 있는 아이디예요."
          : "이미 사용 중인 아이디예요.",
      );
    } catch (error) {
      setUsernameCheckMessage(
        error instanceof Error
          ? error.message
          : "아이디 확인 중 문제가 생겼어요.",
      );
    } finally {
      setIsUsernameCheckPending(false);
    }
  }

  async function handleSendEmailCode() {
    setEmailCodeMessage("");
    setIsEmailCodePending(true);

    try {
      const response = await fetch("/api/auth/send-email-code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: authEmail }),
      });
      const result = await readApiJson<{
        message?: string;
        devCode?: string;
      }>(response, "인증번호 발송 중 문제가 생겼어요.");

      if (!response.ok) {
        throw new Error(result.message ?? "인증번호 발송 중 문제가 생겼어요.");
      }

      setEmailCodeMessage(
        result.devCode
          ? `${result.message} 인증번호: ${result.devCode}`
          : (result.message ?? "인증번호를 이메일로 보냈어요."),
      );
    } catch (error) {
      setEmailCodeMessage(
        error instanceof Error
          ? error.message
          : "인증번호 발송 중 문제가 생겼어요.",
      );
    } finally {
      setIsEmailCodePending(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setCurrentUser(null);
    setCampaigns([]);
    setHolidays([]);
    setSelectedId(null);
  }

  function openRegisterModal() {
    setPasteContent("");
    setCompanyPhoneValue("");
    setRegisterErrorMessage("");
    setParsePreview(null);
    setIsParsingPreview(false);
    setIsRegisterModalOpen(true);
  }

  function closeRegisterModal() {
    setPasteContent("");
    setCompanyPhoneValue("");
    setRegisterErrorMessage("");
    setParsePreview(null);
    setIsParsingPreview(false);
    setIsRegisterModalOpen(false);
  }

  async function requestParsePreview(content: string) {
    setRegisterErrorMessage("");
    setParsePreview(null);
    setIsParsingPreview(true);

    try {
      const response = await fetch("/api/parse-link", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content }),
      });

      const result = await readApiJson<ParsedCampaignPreview & { message?: string }>(
        response,
        "체험단 정보를 확인하지 못했어요.",
      );

      if (!response.ok) {
        throw new Error(result.message ?? "체험단 정보를 확인하지 못했어요.");
      }

      setParsePreview(result);
    } catch (error) {
      setRegisterErrorMessage(
        error instanceof Error ? error.message : "체험단 정보를 확인하지 못했어요.",
      );
    } finally {
      setIsParsingPreview(false);
    }
  }

  function handlePasteCapture(event: ClipboardEvent<HTMLDivElement>) {
    event.preventDefault();
    const captured =
      event.clipboardData.getData("text/html") || event.clipboardData.getData("text/plain");

    if (!captured.trim()) {
      return;
    }

    setPasteContent(captured);
    void requestParsePreview(captured);
  }

  function handleRegisterLink() {
    setRegisterErrorMessage("");

    if (!parsePreview) {
      setRegisterErrorMessage("체험단 페이지 내용을 먼저 붙여넣어 주세요.");
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch("/api/campaigns", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            preview: parsePreview,
            companyPhone: companyPhoneValue.trim(),
          }),
        });

        const result = await readApiJson<{
          campaign?: Campaign;
          message?: string;
        }>(response, "체험단을 등록하지 못했어요.");

        if (!response.ok || !result.campaign) {
          throw new Error(result.message ?? "체험단을 등록하지 못했어요.");
        }

        const nextCampaigns = await refreshBootstrap();
        const nextCampaign =
          nextCampaigns.find((campaign) => campaign.id === result.campaign?.id) ??
          nextCampaigns[0];

        setSelectedId(nextCampaign?.id ?? null);
        closeRegisterModal();
      } catch (error) {
        setRegisterErrorMessage(
          error instanceof Error ? error.message : "체험단 등록 중 문제가 생겼어요.",
        );
      }
    });
  }

  function handleCalendarDatePick(cell: CalendarCell) {
    setScheduleErrorMessage("");
    setScheduleMessage("");

    if (!cell.dateIso || cell.muted) {
      return;
    }

    setActiveDateCell(cell);
  }

  function moveVisibleMonth(offset: number) {
    const nextDate = new Date(selectedYear, selectedMonth - 1 + offset, 1);
    setActiveDateCell(null);
    setSelectedYear(nextDate.getFullYear());
    setSelectedMonth(nextDate.getMonth() + 1);
  }

  function handleYearChange(nextYear: number) {
    setActiveDateCell(null);
    setSelectedYear(nextYear);
  }

  function handleMonthChange(nextMonth: number) {
    setActiveDateCell(null);
    setSelectedMonth(nextMonth);
  }

  function handleSelectedCampaignPageChange(nextPage: number) {
    const boundedPage = Math.max(1, Math.min(selectedCampaignPageCount, nextPage));
    const nextPageCampaigns = selectedCampaigns.slice(
      (boundedPage - 1) * 3,
      (boundedPage - 1) * 3 + 3,
    );

    setSelectedCampaignPage(boundedPage);
    setSelectedId(nextPageCampaigns[0]?.id ?? null);
  }

  function handleRequestDeleteCampaign(campaign: Campaign) {
    setCampaignToDelete(campaign);
  }

  function handleConfirmDeleteCampaign() {
    if (!campaignToDelete) {
      return;
    }

    setIsDeletePending(true);
    setScheduleErrorMessage("");
    setScheduleMessage("");

    void (async () => {
      try {
        const response = await fetch(`/api/campaigns/${campaignToDelete.id}`, {
          method: "DELETE",
        });
        const result = await readApiJson<{ message?: string }>(
          response,
          "체험단 삭제 중 문제가 생겼어요.",
        );

        if (!response.ok) {
          throw new Error(result.message ?? "체험단 삭제 중 문제가 생겼어요.");
        }

        setCampaigns((current) =>
          current.filter((campaign) => campaign.id !== campaignToDelete.id),
        );
        setCampaignToDelete(null);
        setScheduleMessage(`${campaignToDelete.title} 체험단을 삭제했어요.`);
      } catch (error) {
        setScheduleErrorMessage(
          error instanceof Error ? error.message : "체험단 삭제 중 문제가 생겼어요.",
        );
      } finally {
        setIsDeletePending(false);
      }
    })();
  }

  function handleConfirmCampaignForDate(campaign: Campaign, dateIso: string) {
    setScheduleErrorMessage("");
    setScheduleMessage("");

    if (
      dateIso < campaign.experienceStartDate ||
      dateIso > campaign.experienceEndDate
    ) {
      setScheduleErrorMessage(
        `${campaign.title}의 체험 가능 기간 안에서 날짜를 선택해 주세요.`,
      );
      return;
    }

    const pickedDateIso = dateIso;
    const selectedDate = `${pickedDateIso}T12:00:00`;
    setIsSchedulePending(true);

    void (async () => {
      try {
        const response = await fetch(`/api/campaigns/${campaign.id}/schedule`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ selectedDate }),
        });
        const result = await readApiJson<{ message?: string }>(
          response,
          "일정 확정 중 문제가 생겼어요.",
        );

        if (!response.ok) {
          throw new Error(result.message ?? "일정 확정 중 문제가 생겼어요.");
        }

        setCampaigns((current) =>
          current.map((item) =>
            item.id === campaign.id
              ? {
                  ...item,
                  selectedDate,
                  status: "scheduled",
                }
              : item,
          ),
        );
        setScheduleMessage(
          `${campaign.title} 일정을 ${formatMonthDay(pickedDateIso)}로 확정했어요.`,
        );
        setSelectedId(campaign.id);
        setActiveDateCell(null);
      } catch (error) {
        setScheduleErrorMessage(
          error instanceof Error ? error.message : "일정 확정 중 문제가 생겼어요.",
        );
      } finally {
        setIsSchedulePending(false);
      }
    })();
  }

  function handleCancelCampaignForDate(campaign: Campaign) {
    setScheduleErrorMessage("");
    setScheduleMessage("");
    setIsSchedulePending(true);

    void (async () => {
      try {
        const response = await fetch(`/api/campaigns/${campaign.id}/schedule`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ selectedDate: null }),
        });
        const result = await readApiJson<{ message?: string }>(
          response,
          "확정 취소 중 문제가 생겼어요.",
        );

        if (!response.ok) {
          throw new Error(result.message ?? "확정 취소 중 문제가 생겼어요.");
        }

        setCampaigns((current) =>
          current.map((item) =>
            item.id === campaign.id
              ? {
                  ...item,
                  selectedDate: null,
                  status: "unscheduled",
                }
              : item,
          ),
        );
        setSelectedId(campaign.id);
        setScheduleMessage(`${campaign.title}의 일정 확정을 취소했어요.`);
      } catch (error) {
        setScheduleErrorMessage(
          error instanceof Error ? error.message : "확정 취소 중 문제가 생겼어요.",
        );
      } finally {
        setIsSchedulePending(false);
      }
    })();
  }

  function handleMarkCampaignCompleted(campaign: Campaign) {
    setScheduleErrorMessage("");
    setScheduleMessage("");
    setIsSchedulePending(true);

    void (async () => {
      try {
        const response = await fetch(`/api/campaigns/${campaign.id}/status`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status: "completed" }),
        });
        const result = await readApiJson<{ message?: string }>(
          response,
          "체험 완료 처리 중 문제가 생겼어요.",
        );

        if (!response.ok) {
          throw new Error(result.message ?? "체험 완료 처리 중 문제가 생겼어요.");
        }

        setCampaigns((current) =>
          current.map((item) =>
            item.id === campaign.id
              ? {
                  ...item,
                  status: "completed",
                }
              : item,
          ),
        );
        setSelectedId(campaign.id);
        setScheduleMessage(`${campaign.title}을(를) 체험완료로 이동했어요.`);
      } catch (error) {
        setScheduleErrorMessage(
          error instanceof Error ? error.message : "체험 완료 처리 중 문제가 생겼어요.",
        );
      } finally {
        setIsSchedulePending(false);
      }
    })();
  }

  function handleMarkCampaignReviewed(campaign: Campaign) {
    void (async () => {
      try {
        const response = await fetch(`/api/campaigns/${campaign.id}/status`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status: "review_submitted" }),
        });
        const result = await readApiJson<{ message?: string }>(
          response,
          "리뷰 완료 처리 중 문제가 생겼어요.",
        );

        if (!response.ok) {
          throw new Error(result.message ?? "리뷰 완료 처리 중 문제가 생겼어요.");
        }

        setCampaigns((current) =>
          current.map((item) =>
            item.id === campaign.id
              ? {
                  ...item,
                  status: "review_submitted",
                }
              : item,
          ),
        );
        setSelectedId(campaign.id);
      } catch {
        // 완료 탭에서는 조용히 유지하고, 추후 필요하면 전용 안내를 붙인다.
      }
    })();
  }

  function handleCancelCampaignCompleted(campaign: Campaign) {
    void (async () => {
      try {
        const response = await fetch(`/api/campaigns/${campaign.id}/status`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status: "scheduled" }),
        });
        const result = await readApiJson<{ message?: string }>(
          response,
          "체험 완료 취소 중 문제가 생겼어요.",
        );

        if (!response.ok) {
          throw new Error(result.message ?? "체험 완료 취소 중 문제가 생겼어요.");
        }

        setCampaigns((current) =>
          current.map((item) =>
            item.id === campaign.id
              ? {
                  ...item,
                  status: "scheduled",
                }
              : item,
          ),
        );
        setSelectedId(campaign.id);
      } catch {
        // 탭 목록에서는 조용히 유지하고, 필요 시 추후 전용 안내를 붙인다.
      }
    })();
  }

  function handleCancelCampaignReviewed(campaign: Campaign) {
    void (async () => {
      try {
        const response = await fetch(`/api/campaigns/${campaign.id}/status`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status: "completed" }),
        });
        const result = await readApiJson<{ message?: string }>(
          response,
          "리뷰 완료 취소 중 문제가 생겼어요.",
        );

        if (!response.ok) {
          throw new Error(result.message ?? "리뷰 완료 취소 중 문제가 생겼어요.");
        }

        setCampaigns((current) =>
          current.map((item) =>
            item.id === campaign.id
              ? {
                  ...item,
                  status: "completed",
                }
              : item,
          ),
        );
        setSelectedId(campaign.id);
      } catch {
        // 탭 목록에서는 조용히 유지하고, 필요 시 추후 전용 안내를 붙인다.
      }
    })();
  }

  if (isAuthLoading) {
    return <AuthLoadingScreen />;
  }

  if (!currentUser) {
    return (
      <AuthScreen
        mode={authMode}
        username={authUsername}
        email={authEmail}
        password={authPassword}
        passwordConfirm={authPasswordConfirm}
        emailCode={authEmailCode}
        message={authMessage}
        usernameCheckMessage={usernameCheckMessage}
        emailCodeMessage={emailCodeMessage}
        isPending={isAuthPending}
        isUsernameCheckPending={isUsernameCheckPending}
        isEmailCodePending={isEmailCodePending}
        onModeChange={(mode) => {
          setAuthMode(mode);
          setAuthMessage("");
          setUsernameCheckMessage("");
          setEmailCodeMessage("");
        }}
        onUsernameChange={setAuthUsername}
        onEmailChange={setAuthEmail}
        onPasswordChange={setAuthPassword}
        onPasswordConfirmChange={setAuthPasswordConfirm}
        onEmailCodeChange={setAuthEmailCode}
        onCheckUsername={handleCheckUsername}
        onSendEmailCode={handleSendEmailCode}
        onSubmit={handleAuthSubmit}
      />
    );
  }

  return (
    <main className="review-calendar-app min-h-screen overflow-hidden bg-[linear-gradient(180deg,#ffeaf5_0%,#ffdceb_35%,#ffeaf7_100%)] text-[#7f355b]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(255,255,255,0.8)_0,rgba(255,255,255,0)_16%),radial-gradient(circle_at_82%_10%,rgba(255,246,190,0.65)_0,rgba(255,246,190,0)_12%),radial-gradient(circle_at_80%_70%,rgba(229,214,255,0.75)_0,rgba(229,214,255,0)_16%),linear-gradient(135deg,rgba(255,255,255,0.14)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.14)_50%,rgba(255,255,255,0.14)_75%,transparent_75%,transparent)] bg-[length:auto,auto,auto,28px_28px] opacity-80" />
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-8 px-4 py-5 sm:px-6 lg:px-8">
        <header className="relative overflow-hidden rounded-[42px] border-2 border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.72),rgba(255,245,251,0.92))] p-4 shadow-[0_30px_80px_rgba(233,116,171,0.2)] backdrop-blur-xl sm:p-6">
          <div className="absolute inset-x-6 top-4 h-5 rounded-full bg-[linear-gradient(90deg,rgba(255,255,255,0.72),rgba(255,232,242,0.92),rgba(255,255,255,0.72))] shadow-[0_8px_18px_rgba(255,195,220,0.35)]" />
          <div className="absolute -right-8 top-16 h-40 w-40 rounded-full bg-[radial-gradient(circle,rgba(255,214,233,0.6)_0%,rgba(255,214,233,0)_70%)]" />
          <div className="absolute bottom-10 left-[42%] h-44 w-44 rounded-full bg-[radial-gradient(circle,rgba(255,247,196,0.34)_0%,rgba(255,247,196,0)_72%)]" />

          <div className="relative rounded-[38px] border border-white/75 bg-[linear-gradient(180deg,rgba(255,245,250,0.98),rgba(255,238,247,0.88))] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] sm:p-8">
            <div>
              <div className="grid gap-5 xl:grid-cols-[minmax(0,760px)_minmax(280px,1fr)] xl:items-start">
                <div className="grid gap-4">
                  <button
                    onClick={openRegisterModal}
                    className="relative min-h-[190px] overflow-hidden rounded-[34px] bg-[linear-gradient(180deg,#ef8bc0_0%,#df7db1_100%)] px-7 py-8 text-left text-white shadow-[0_24px_42px_rgba(239,139,192,0.34)] transition-transform hover:-translate-y-1"
                  >
                    <div className="absolute -right-5 -top-5 h-24 w-24 rounded-full bg-white/12" />
                    <div className="relative z-10 flex items-start justify-between gap-5">
                      <div className="min-w-0">
                        <span className="block font-display text-[38px] leading-none">
                          체험단 등록
                        </span>
                        <span className="mt-5 block max-w-[220px] text-base leading-7 text-white/92">
                          선정된 체험단 링크를 등록하고 일정을 바로 불러오세요
                        </span>
                      </div>
                      <span className="inline-flex h-16 w-16 shrink-0 items-center justify-center rounded-[22px] bg-white/18">
                        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-9 w-9" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
                        </svg>
                      </span>
                    </div>
                  </button>

                </div>

                <div className="flex min-h-[190px] items-start xl:justify-end">
                  <div className="flex flex-col items-start gap-4 xl:items-end">
                    <h1 className="font-display text-5xl leading-none text-[#8f315f] sm:text-6xl lg:text-[88px] xl:pt-3">
                      리뷰캘린더
                    </h1>
                    <div className="flex max-w-full flex-wrap items-center gap-2 rounded-full bg-white/80 px-3 py-2 shadow-[0_12px_24px_rgba(255,190,219,0.28)]">
                      <span className="max-w-[220px] truncate px-2 text-sm font-black text-[#9a4878]">
                        {currentUser.username}
                      </span>
                      <button
                        onClick={handleLogout}
                        className="inline-flex min-w-[78px] items-center justify-center whitespace-nowrap rounded-full bg-[#fff0f7] px-3 py-2 text-xs font-black text-[#c45991]"
                      >
                        로그아웃
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <p className="mt-6 text-2xl font-black leading-snug text-[#e36aa6] sm:text-3xl">
                선정된 체험단 링크를 등록하면 일정과 마감일을 한 번에 관리할 수 있어요
              </p>
            </div>
          </div>

          <div className="relative mt-5 flex flex-wrap gap-3 px-2">
            {dashboardTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveDashboardTab(tab.id)}
                className={`min-w-[136px] whitespace-nowrap rounded-full px-6 py-3 text-sm font-bold shadow-[0_12px_22px_rgba(255,193,219,0.38)] transition-transform hover:-translate-y-0.5 ${
                  activeDashboardTab === tab.id
                    ? "bg-[#ff8cbc] text-white"
                    : "bg-white text-[#c45991]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </header>
        {activeDashboardTab === "calendar" ? (
          <section className="grid gap-8">
            <article className="relative overflow-hidden rounded-[42px] border-2 border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.76),rgba(255,244,250,0.94))] p-5 shadow-[0_30px_70px_rgba(233,116,171,0.18)] sm:p-6">
              <SectionTitle title="오늘의 체크 포인트" />
              <div className="mt-6 grid gap-4 lg:grid-cols-3">
                {checkpointCards.map((card) => (
                  <CheckpointCard
                    key={card.id}
                    {...card}
                    onClick={() => setActiveCheckpointId(card.id)}
                  />
                ))}
              </div>
            </article>

            <article className="relative overflow-hidden rounded-[42px] border-2 border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.72),rgba(255,244,250,0.94))] p-5 shadow-[0_30px_70px_rgba(233,116,171,0.18)] sm:p-6">
              <div className="absolute left-8 top-0 h-7 w-24 -translate-y-1/2 rounded-full bg-[#ffe59e] shadow-[0_10px_16px_rgba(255,229,158,0.5)]" />

              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <SectionTitle
                  eyebrow="월간 일정"
                  title={`${selectedYear}년 ${selectedMonth}월`}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => moveVisibleMonth(-1)}
                    className="inline-flex min-w-[72px] items-center justify-center whitespace-nowrap rounded-full bg-white px-4 py-2 text-sm font-bold text-[#c45991] shadow-[0_10px_18px_rgba(255,190,219,0.25)]"
                    aria-label="이전 달"
                  >
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 20 20"
                      className="h-4 w-4"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M12.5 4.5L7 10l5.5 5.5"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                  <select
                    value={selectedYear}
                    onChange={(event) => handleYearChange(Number(event.target.value))}
                    className="rounded-full border border-white/80 bg-white px-4 py-2 text-sm font-bold text-[#8f315f] shadow-[0_10px_18px_rgba(255,190,219,0.2)] outline-none"
                  >
                    {yearOptions.map((year) => (
                      <option key={year} value={year}>
                        {year}년
                      </option>
                    ))}
                  </select>
                  <select
                    value={selectedMonth}
                    onChange={(event) => handleMonthChange(Number(event.target.value))}
                    className="rounded-full border border-white/80 bg-white px-4 py-2 text-sm font-bold text-[#8f315f] shadow-[0_10px_18px_rgba(255,190,219,0.2)] outline-none"
                  >
                    {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
                      <option key={month} value={month}>
                        {month}월
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => moveVisibleMonth(1)}
                    className="inline-flex min-w-[72px] items-center justify-center whitespace-nowrap rounded-full bg-white px-4 py-2 text-sm font-bold text-[#c45991] shadow-[0_10px_18px_rgba(255,190,219,0.25)]"
                    aria-label="다음 달"
                  >
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 20 20"
                      className="h-4 w-4"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M7.5 4.5L13 10l-5.5 5.5"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="mt-4 rounded-[22px] bg-[#fff1f8] px-4 py-3 text-sm leading-6 text-[#9b6280]">
                날짜를 누르면 해당 날짜에 체험 가능한 체험단 목록이 뜨고, 그 안에서
                바로 체험 일정을 확정할 수 있어요.
              </div>
              {scheduleMessage ? (
                <p className="mt-3 rounded-[18px] bg-[#ddfff4] px-4 py-3 text-sm font-bold text-[#26766a]">
                  {scheduleMessage}
                </p>
              ) : null}
              {scheduleErrorMessage ? (
                <p className="mt-3 rounded-[18px] bg-[#ffd9e1] px-4 py-3 text-sm font-bold text-[#983751]">
                  {scheduleErrorMessage}
                </p>
              ) : null}
              {!holidaySyncEnabled ? (
                <p className="mt-3 rounded-[18px] bg-[#fff6da] px-4 py-3 text-sm font-bold text-[#9b6a1f]">
                  공휴일 자동 표시를 켜려면 `DATA_GO_KR_SERVICE_KEY` 환경변수를 설정해 주세요.
                </p>
              ) : null}

              <div className="mt-6 grid grid-cols-7 gap-2 text-center text-xs font-black tracking-[0.18em] text-[#cb6c9f] sm:gap-3 sm:text-sm">
                {weekDays.map((day, index) => (
                  <div
                    key={day}
                    className={`rounded-full border border-white/70 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] ${
                      index === 0
                        ? "bg-[#ffe4ec] text-[#dd4a6f]"
                        : index === 6
                          ? "bg-[#e8f1ff] text-[#4b74d9]"
                          : "bg-[#ffe8f3] text-[#cb6c9f]"
                    }`}
                  >
                    {day}
                  </div>
                ))}
              </div>

              <div className="mt-4 grid grid-cols-7 gap-2 sm:gap-3">
                {calendarCells.map((cell, index) => {
                  const dayOfWeek = index % 7;
                  const dayNumberTone = cell.muted
                    ? "text-[#d9aec6]"
                    : cell.holidayName
                      ? "text-[#d94f73]"
                      : dayOfWeek === 0
                      ? "text-[#d94f73]"
                      : dayOfWeek === 6
                        ? "text-[#4f74d9]"
                        : "text-current";
                  const tone = cell.muted
                    ? "bg-white/50 border-white/40 text-[#d9aec6]"
                    : `${cellStyles[cell.type ?? "plain"]} ${
                        cell.holidayName
                          ? "ring-1 ring-inset ring-[#ffb3c8]"
                          : ""
                      }`;

                  return (
                    <button
                      key={cell.key}
                      onClick={() => handleCalendarDatePick(cell)}
                      disabled={cell.muted || isSchedulePending}
                      className={`relative min-h-28 rounded-[28px] border p-3 text-left shadow-[0_14px_26px_rgba(255,197,223,0.22)] transition-all hover:-translate-y-1 hover:rotate-[-1deg] hover:shadow-[0_20px_34px_rgba(255,145,197,0.28)] sm:min-h-32 ${tone}`}
                    >
                      {!cell.muted && (
                        <span className="absolute right-3 top-2 text-sm opacity-80">
                          {cell.deco}
                        </span>
                      )}
                      <span className={`text-lg font-black sm:text-xl ${dayNumberTone}`}>
                        {cell.day}
                      </span>
                      {cell.holidayName ? (
                        <div className="mt-2">
                          <span
                            className={`inline-flex max-w-full items-center rounded-full px-2.5 py-1 text-[10px] font-black leading-none shadow-[0_6px_10px_rgba(255,205,227,0.22)] ${
                              cell.isAlternativeHoliday
                                ? "bg-[#ffe7ee] text-[#cc4f73]"
                                : "bg-[#ffe0ea] text-[#d94f73]"
                            }`}
                          >
                            <span className="truncate">{cell.holidayName}</span>
                          </span>
                        </div>
                      ) : null}
                      {cell.label ? (
                        <>
                          <p
                            className={`text-xs font-bold leading-5 sm:text-sm ${
                              cell.holidayName ? "mt-3" : "mt-5"
                            }`}
                          >
                            {cell.label}
                          </p>
                          {cell.entries?.length ? (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {cell.entries.slice(0, 3).map((entry, entryIndex) => (
                                <span
                                  key={`${cell.key}-${entryIndex}-${entry}`}
                                  className="inline-flex max-w-full items-center rounded-full border border-white/70 bg-white/70 px-2 py-1 text-[10px] font-black leading-none opacity-90 shadow-[0_6px_10px_rgba(255,205,227,0.22)] backdrop-blur-sm"
                                >
                                  <span className="truncate">{entry}</span>
                                </span>
                              ))}
                              {cell.entries.length > 3 ? (
                                <span className="inline-flex items-center rounded-full border border-dashed border-white/80 bg-white/55 px-2 py-1 text-[10px] font-black leading-none opacity-80">
                                  +{cell.entries.length - 3}
                                </span>
                              ) : null}
                            </div>
                          ) : null}
                          {cell.secondaryLabel ? (
                            <div className="mt-3">
                              <p className="text-[11px] font-black opacity-80">
                                {cell.secondaryLabel}
                              </p>
                              {cell.secondaryEntries?.length ? (
                                <div className="mt-1.5 flex flex-wrap gap-1.5">
                                  {cell.secondaryEntries
                                    .slice(0, 2)
                                    .map((entry, entryIndex) => (
                                    <span
                                      key={`${cell.key}-secondary-${entryIndex}-${entry}`}
                                      className="inline-flex max-w-full items-center rounded-full border border-[#ffc2cf] bg-[#fff2f5] px-2 py-1 text-[10px] font-black leading-none text-[#a84763] shadow-[0_6px_10px_rgba(255,205,227,0.18)]"
                                    >
                                      <span className="truncate">{entry}</span>
                                    </span>
                                  ))}
                                  {cell.secondaryEntries.length > 2 ? (
                                    <span className="inline-flex items-center rounded-full border border-dashed border-[#ffc2cf] bg-[#fff7f9] px-2 py-1 text-[10px] font-black leading-none text-[#b5627b] opacity-90">
                                      +{cell.secondaryEntries.length - 2}
                                    </span>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                          {cell.tertiaryLabel ? (
                            <div className="mt-3">
                              <p className="text-[11px] font-black opacity-80">
                                {cell.tertiaryLabel}
                              </p>
                              {cell.tertiaryEntries?.length ? (
                                <div className="mt-1.5 flex flex-wrap gap-1.5">
                                  {cell.tertiaryEntries
                                    .slice(0, 2)
                                    .map((entry, entryIndex) => (
                                    <span
                                      key={`${cell.key}-tertiary-${entryIndex}-${entry}`}
                                      className="inline-flex max-w-full items-center rounded-full border border-[#ffbfd8] bg-[#fff4fa] px-2 py-1 text-[10px] font-black leading-none text-[#a54777] shadow-[0_6px_10px_rgba(255,205,227,0.18)]"
                                    >
                                      <span className="truncate">{entry}</span>
                                    </span>
                                  ))}
                                  {cell.tertiaryEntries.length > 2 ? (
                                    <span className="inline-flex items-center rounded-full border border-dashed border-[#ffbfd8] bg-[#fff8fc] px-2 py-1 text-[10px] font-black leading-none text-[#b56288] opacity-90">
                                      +{cell.tertiaryEntries.length - 2}
                                    </span>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                        </>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </article>

            <article className="relative overflow-hidden rounded-[42px] border-2 border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.76),rgba(255,244,250,0.94))] p-5 shadow-[0_30px_70px_rgba(233,116,171,0.18)] sm:p-6">
              <SectionTitle title="진행 상태" />
              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                <StatCard
                  title="날짜 미정"
                  value={`${campaigns.filter((item) => item.status === "unscheduled").length}`.padStart(2, "0")}
                  bg="bg-[#ffddec]"
                  text="text-[#8b2f58]"
                />
                <StatCard
                  title="마감 임박"
                  value={`${campaigns.filter((item) => {
                    const diff =
                      new Date(item.reviewDeadline).getTime() -
                      today.getTime();
                    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
                    return days >= 0 && days <= 7;
                  }).length}`.padStart(2, "0")}
                  bg="bg-[#fff1c4]"
                  text="text-[#8f5c14]"
                />
                <StatCard
                  title="등록 체험단"
                  value={`${campaigns.length}`.padStart(2, "0")}
                  bg="bg-[#eee1ff]"
                  text="text-[#7044a0]"
                />
              </div>
            </article>
          </section>
        ) : null}

        {activeDashboardTab === "selected" ? (
          <section className="grid gap-8 xl:grid-cols-[1.05fr_0.95fr]">
            <CampaignListSection
              eyebrow="등록된 일정"
              title="선정된 체험단"
              campaigns={pagedSelectedCampaigns}
              isLoading={isBootstrapLoading}
              emptyMessage="아직 등록된 선정 체험단이 없어요. 선정된 링크를 등록하면 이곳에 실제 체험단만 표시됩니다."
              onSelect={setSelectedId}
              layout="selected"
              page={currentSelectedCampaignPage}
              totalPages={selectedCampaignPageCount}
              onPageChange={handleSelectedCampaignPageChange}
              secondaryActionLabel="삭제하기"
              onSecondaryAction={handleRequestDeleteCampaign}
            />
            <CampaignDetailSection
              selectedCampaign={selectedCampaignForSelectedTab}
              holidayMap={holidayMap}
            />
          </section>
        ) : null}

        {activeDashboardTab === "completed" ? (
          <section className="grid gap-8">
            <CampaignListSection
              eyebrow="체험 진행 이력"
              title="체험완료"
              campaigns={completedCampaigns}
              isLoading={isBootstrapLoading}
              emptyMessage="아직 체험 완료 처리된 체험단이 없어요."
              onSelect={setSelectedId}
              actionLabel="리뷰완료"
              onAction={handleMarkCampaignReviewed}
              secondaryActionLabel="체험완료 취소"
              onSecondaryAction={handleCancelCampaignCompleted}
            />
          </section>
        ) : null}

        {activeDashboardTab === "review" ? (
          <section className="grid gap-8">
            <CampaignListSection
              eyebrow="리뷰 제출 이력"
              title="리뷰완료"
              campaigns={reviewedCampaigns}
              isLoading={isBootstrapLoading}
              emptyMessage="아직 리뷰 완료 처리된 체험단이 없어요."
              onSelect={setSelectedId}
              secondaryActionLabel="리뷰완료 취소"
              onSecondaryAction={handleCancelCampaignReviewed}
            />
          </section>
        ) : null}
      </div>

      {isRegisterModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#7d3159]/30 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-[36px] border-2 border-white/70 bg-[linear-gradient(180deg,rgba(255,247,251,0.98),rgba(255,236,245,0.95))] p-6 shadow-[0_30px_70px_rgba(210,89,151,0.26)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-display text-xs tracking-[0.18em] text-[#db6aa1]">
                  체험단 등록하기
                </p>
                <h2 className="mt-2 text-3xl font-black text-[#8f315f]">
                  선정된 체험단 페이지 붙여넣기
                </h2>
                <p className="mt-3 text-sm leading-6 text-[#8a5d75]">
                  선정된 체험단 페이지를 열고 전체 복사해서 붙여넣으면 체험단명,
                  체험 기간, 리뷰 마감일 같은 정보를 자동으로 채워줘요.
                </p>
              </div>
              <button
                onClick={closeRegisterModal}
                className="min-w-[88px] whitespace-nowrap rounded-full bg-white px-4 py-2 text-sm font-bold text-[#c6538c] shadow-[0_10px_22px_rgba(255,190,219,0.4)]"
              >
                닫기
              </button>
            </div>

            <div className="mt-6 rounded-[28px] border border-white/70 bg-white/85 p-5">
              <ol className="grid gap-1 text-xs font-bold text-[#b3688e]">
                <li>1. 선정된 체험단 페이지 열기</li>
                <li>2. 페이지 전체 선택 (Ctrl+A)</li>
                <li>3. 복사 (Ctrl+C)</li>
                <li>4. 아래에 붙여넣기 (Ctrl+V)</li>
              </ol>

              <div
                contentEditable
                suppressContentEditableWarning
                onPaste={handlePasteCapture}
                data-placeholder="여기를 클릭하고 Ctrl+V로 붙여넣어 주세요"
                className="empty:before:content-[attr(data-placeholder)] mt-4 min-h-[96px] w-full whitespace-pre-wrap rounded-[20px] border border-dashed border-[#ffb8d8] bg-[#fff8fc] px-4 py-4 text-sm text-[#7f355b] outline-none transition empty:before:text-[#c99bb4] focus:border-[#ff93c4] focus:ring-2 focus:ring-[#ffd3e6]"
              >
                {pasteContent ? "붙여넣음 ✓" : ""}
              </div>

              {isParsingPreview ? (
                <p className="mt-3 rounded-[18px] bg-[#fff1f8] px-4 py-3 text-sm font-bold text-[#b3688e]">
                  체험단 정보를 확인하고 있어요...
                </p>
              ) : null}

              {parsePreview ? (
                <div className="mt-3 rounded-[22px] border border-[#ffd3e6] bg-[#fff8fc] p-4">
                  <p className="inline-block rounded-full bg-[#ffe1ef] px-3 py-1 text-xs font-black text-[#b3346c]">
                    {parsePreview.site} 인식 완료 ✓
                  </p>
                  <p className="mt-2 text-base font-black text-[#7f355b]">
                    {parsePreview.title}
                  </p>
                  <p className="mt-1 text-sm text-[#8a5d75]">{parsePreview.reward}</p>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-[#8a5d75]">
                    <div className="rounded-[14px] bg-white/80 px-3 py-2">
                      <p className="font-bold text-[#b3688e]">체험 기간</p>
                      <p className="mt-1">
                        {formatShortDate(parsePreview.experienceStartDate)} ~{" "}
                        {formatShortDate(parsePreview.experienceEndDate)}
                      </p>
                    </div>
                    <div className="rounded-[14px] bg-white/80 px-3 py-2">
                      <p className="font-bold text-[#b3688e]">리뷰 마감</p>
                      <p className="mt-1">{formatShortDate(parsePreview.reviewDeadline)}</p>
                    </div>
                    <div className="rounded-[14px] bg-white/80 px-3 py-2">
                      <p className="font-bold text-[#b3688e]">방문 주소</p>
                      <p className="mt-1 truncate">{parsePreview.address}</p>
                    </div>
                  </div>
                </div>
              ) : null}

              <label className="mt-4 block text-sm font-black text-[#b94a81]">
                업체 연락처
              </label>
              <input
                value={companyPhoneValue}
                onChange={(event) => setCompanyPhoneValue(event.target.value)}
                placeholder="예) 010-1234-5678 또는 매장 예약번호"
                className="mt-3 w-full rounded-[20px] border border-[#ffd3e6] bg-[#fff8fc] px-4 py-4 text-sm text-[#7f355b] outline-none transition focus:border-[#ff93c4] focus:ring-2 focus:ring-[#ffd3e6]"
              />
              <div className="mt-3 rounded-[20px] bg-[#fff1f8] px-4 py-3 text-xs leading-6 text-[#9a6280]">
                업체 연락처는 체험단 사이트에서 확인한 예약번호를 직접 입력해 주세요.
                나머지 정보는 붙여넣은 페이지에서 자동으로 불러와요.
              </div>
              {registerErrorMessage ? (
                <p className="mt-3 rounded-[18px] bg-[#ffd9e1] px-4 py-3 text-sm font-bold text-[#983751]">
                  {registerErrorMessage}
                </p>
              ) : null}
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                onClick={closeRegisterModal}
                className="min-w-[96px] whitespace-nowrap rounded-full bg-white px-5 py-3 text-sm font-bold text-[#c55a90] shadow-[0_12px_22px_rgba(255,190,219,0.3)]"
              >
                취소
              </button>
              <button
                onClick={handleRegisterLink}
                disabled={isPending || !parsePreview || !companyPhoneValue.trim()}
                className="min-w-[160px] whitespace-nowrap rounded-full bg-[linear-gradient(180deg,#ff7db9_0%,#ff97c5_100%)] px-5 py-3 text-sm font-bold text-white shadow-[0_16px_28px_rgba(255,123,184,0.35)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending ? "등록 중..." : "등록하기"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {activeDateCell?.dateIso ? (
        <DatePickModal
          dateIso={activeDateCell.dateIso}
          holidayName={activeDateCell.holidayName}
          campaigns={campaigns.filter(
            (campaign) =>
              campaign.status === "unscheduled" &&
              campaign.experienceStartDate <= activeDateCell.dateIso! &&
              campaign.experienceEndDate >= activeDateCell.dateIso!,
          )}
          confirmedCampaigns={campaigns.filter(
            (campaign) => campaign.selectedDate?.slice(0, 10) === activeDateCell.dateIso,
          )}
          isPending={isSchedulePending}
          onClose={() => setActiveDateCell(null)}
          onConfirm={(campaign) =>
            handleConfirmCampaignForDate(campaign, activeDateCell.dateIso!)
          }
          onCancel={handleCancelCampaignForDate}
          onComplete={handleMarkCampaignCompleted}
        />
      ) : null}

      {activeCheckpoint ? (
        <CheckpointDetailModal
          checkpoint={activeCheckpoint}
          onClose={() => setActiveCheckpointId(null)}
        />
      ) : null}

      {campaignToDelete ? (
        <DeleteCampaignConfirmModal
          campaign={campaignToDelete}
          isPending={isDeletePending}
          onClose={() => {
            if (!isDeletePending) {
              setCampaignToDelete(null);
            }
          }}
          onConfirm={handleConfirmDeleteCampaign}
        />
      ) : null}

    </main>
  );
}

function AuthLoadingScreen() {
  return (
    <main className="review-calendar-app flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#ffeaf5_0%,#ffdceb_55%,#ffeaf7_100%)] px-4 text-[#7f355b]">
      <div className="rounded-[32px] border-2 border-white/70 bg-white/80 px-8 py-6 text-center shadow-[0_28px_60px_rgba(233,116,171,0.2)]">
        <p className="font-display text-3xl text-[#8f315f]">리뷰캘린더</p>
        <p className="mt-3 text-sm font-bold text-[#b45b88]">계정 상태를 확인하고 있어요.</p>
      </div>
    </main>
  );
}

function AuthScreen({
  mode,
  username,
  email,
  password,
  passwordConfirm,
  emailCode,
  message,
  usernameCheckMessage,
  emailCodeMessage,
  isPending,
  isUsernameCheckPending,
  isEmailCodePending,
  onModeChange,
  onUsernameChange,
  onEmailChange,
  onPasswordChange,
  onPasswordConfirmChange,
  onEmailCodeChange,
  onCheckUsername,
  onSendEmailCode,
  onSubmit,
}: {
  mode: AuthMode;
  username: string;
  email: string;
  password: string;
  passwordConfirm: string;
  emailCode: string;
  message: string;
  usernameCheckMessage: string;
  emailCodeMessage: string;
  isPending: boolean;
  isUsernameCheckPending: boolean;
  isEmailCodePending: boolean;
  onModeChange: (mode: AuthMode) => void;
  onUsernameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onPasswordConfirmChange: (value: string) => void;
  onEmailCodeChange: (value: string) => void;
  onCheckUsername: () => void;
  onSendEmailCode: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const isRegister = mode === "register";

  return (
    <main className="review-calendar-app min-h-screen overflow-hidden bg-[linear-gradient(180deg,#ffeaf5_0%,#ffdceb_45%,#ffeaf7_100%)] px-4 py-8 text-[#7f355b]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_18%,rgba(255,255,255,0.9)_0,rgba(255,255,255,0)_16%),radial-gradient(circle_at_80%_72%,rgba(229,214,255,0.65)_0,rgba(229,214,255,0)_16%)]" />
      <div className="relative mx-auto flex min-h-[calc(100vh-64px)] w-full max-w-5xl items-center justify-center">
        <section className="grid w-full overflow-hidden rounded-[40px] border-2 border-white/75 bg-white/78 shadow-[0_34px_90px_rgba(233,116,171,0.24)] backdrop-blur-xl lg:grid-cols-[0.95fr_1.05fr]">
          <div className="bg-[linear-gradient(180deg,#ef8bc0_0%,#df7db1_100%)] p-8 text-white sm:p-10">
            <p className="font-display text-5xl leading-none sm:text-6xl">
              리뷰캘린더
            </p>
            <p className="mt-6 whitespace-nowrap text-base font-bold leading-8 text-white/92">
              선정 체험단과 리뷰 마감일을 계정 안에서 편리하게 관리하세요.
            </p>
            <div className="mt-10 grid gap-3 text-sm font-black text-white/90">
              <div className="rounded-[24px] bg-white/14 px-4 py-3">캘린더 일정 관리</div>
              <div className="rounded-[24px] bg-white/14 px-4 py-3">선정 링크 자동 등록</div>
              <div className="rounded-[24px] bg-white/14 px-4 py-3">리뷰 마감 체크</div>
            </div>
          </div>

          <div className="p-6 sm:p-10">
            <div className="flex rounded-full bg-[#fff1f8] p-1">
              <button
                type="button"
                onClick={() => onModeChange("login")}
                className={`flex-1 whitespace-nowrap rounded-full px-4 py-3 text-sm font-black ${
                  !isRegister ? "bg-white text-[#c4518a] shadow-[0_10px_18px_rgba(255,190,219,0.3)]" : "text-[#a55b83]"
                }`}
              >
                로그인
              </button>
              <button
                type="button"
                onClick={() => onModeChange("register")}
                className={`flex-1 whitespace-nowrap rounded-full px-4 py-3 text-sm font-black ${
                  isRegister ? "bg-white text-[#c4518a] shadow-[0_10px_18px_rgba(255,190,219,0.3)]" : "text-[#a55b83]"
                }`}
              >
                회원가입
              </button>
            </div>

            <form onSubmit={onSubmit} className="mt-7 grid gap-4">
              <label className="grid gap-2 text-sm font-black text-[#9a4878]">
                아이디
                <div className="flex gap-2">
                  <input
                    value={username}
                    onChange={(event) => onUsernameChange(event.target.value)}
                    className="min-w-0 flex-1 rounded-[22px] border border-[#ffd1e6] bg-white px-4 py-3 text-[#7f355b] outline-none focus:border-[#ef8bc0]"
                    placeholder="review_lover"
                    autoComplete="username"
                  />
                  {isRegister ? (
                    <button
                      type="button"
                      onClick={onCheckUsername}
                      disabled={isUsernameCheckPending}
                      className="inline-flex min-w-[96px] items-center justify-center whitespace-nowrap rounded-full bg-[#fff0f7] px-4 py-2 text-xs font-black text-[#c45991] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isUsernameCheckPending ? "확인 중" : "중복 확인"}
                    </button>
                  ) : null}
                </div>
                {isRegister && usernameCheckMessage ? (
                  <span className="text-xs font-bold text-[#b45b88]">
                    {usernameCheckMessage}
                  </span>
                ) : null}
              </label>
              <label className="grid gap-2 text-sm font-black text-[#9a4878]">
                비밀번호
                <input
                  value={password}
                  onChange={(event) => onPasswordChange(event.target.value)}
                  className="rounded-[22px] border border-[#ffd1e6] bg-white px-4 py-3 text-[#7f355b] outline-none focus:border-[#ef8bc0]"
                  placeholder="8자 이상"
                  type="password"
                  autoComplete={isRegister ? "new-password" : "current-password"}
                />
              </label>
              {isRegister ? (
                <>
                  <label className="grid gap-2 text-sm font-black text-[#9a4878]">
                    비밀번호 확인
                    <input
                      value={passwordConfirm}
                      onChange={(event) => onPasswordConfirmChange(event.target.value)}
                      className="rounded-[22px] border border-[#ffd1e6] bg-white px-4 py-3 text-[#7f355b] outline-none focus:border-[#ef8bc0]"
                      placeholder="비밀번호 다시 입력"
                      type="password"
                      autoComplete="new-password"
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-black text-[#9a4878]">
                    이메일
                    <div className="flex gap-2">
                      <input
                        value={email}
                        onChange={(event) => onEmailChange(event.target.value)}
                        className="min-w-0 flex-1 rounded-[22px] border border-[#ffd1e6] bg-white px-4 py-3 text-[#7f355b] outline-none focus:border-[#ef8bc0]"
                        placeholder="you@example.com"
                        autoComplete="email"
                        inputMode="email"
                      />
                      <button
                        type="button"
                        onClick={onSendEmailCode}
                        disabled={isEmailCodePending}
                        className="inline-flex min-w-[104px] items-center justify-center whitespace-nowrap rounded-full bg-[#fff0f7] px-4 py-2 text-xs font-black text-[#c45991] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isEmailCodePending ? "발송 중" : "인증번호 발송"}
                      </button>
                    </div>
                    {emailCodeMessage ? (
                      <span className="text-xs font-bold text-[#b45b88]">
                        {emailCodeMessage}
                      </span>
                    ) : null}
                  </label>
                  <label className="grid gap-2 text-sm font-black text-[#9a4878]">
                    인증번호
                    <input
                      value={emailCode}
                      onChange={(event) => onEmailCodeChange(event.target.value)}
                      className="rounded-[22px] border border-[#ffd1e6] bg-white px-4 py-3 text-[#7f355b] outline-none focus:border-[#ef8bc0]"
                      placeholder="6자리 인증번호"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                    />
                  </label>
                </>
              ) : null}
              {message ? (
                <p className="rounded-[18px] bg-[#ffd9e1] px-4 py-3 text-sm font-bold text-[#983751]">
                  {message}
                </p>
              ) : null}
              <button
                type="submit"
                disabled={isPending}
                className="mt-2 inline-flex min-h-[48px] items-center justify-center whitespace-nowrap rounded-full bg-[linear-gradient(180deg,#ff7db9_0%,#ff97c5_100%)] px-5 py-3 text-sm font-black text-white shadow-[0_16px_28px_rgba(255,123,184,0.35)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending ? "처리 중..." : isRegister ? "계정 만들기" : "로그인"}
              </button>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}

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
  eyebrow?: string;
  title: string;
  action?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        {eyebrow ? (
          <p className="font-display text-xs tracking-[0.18em] text-[#de6aa2]">
            {eyebrow}
          </p>
        ) : null}
        <h2
          className={`text-2xl font-black text-[#8f315f] ${
            eyebrow ? "mt-2" : ""
          }`}
        >
          {title}
        </h2>
      </div>
      {action ? (
        <button className="rounded-full bg-white px-4 py-2 text-sm font-bold text-[#c6538c] shadow-[0_10px_22px_rgba(255,190,219,0.4)] transition-transform hover:-translate-y-0.5">
          {action}
        </button>
      ) : null}
    </div>
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

function DetailCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[24px] border border-white/70 bg-white/85 px-4 py-3 shadow-[0_10px_18px_rgba(255,207,229,0.18)]">
      <p className="text-xs font-black tracking-[0.12em] text-[#d85f98]">
        {label}
      </p>
      <p className="mt-2 text-sm font-bold text-[#7b4b66]">{value}</p>
    </div>
  );
}

function CheckpointCard({
  label,
  countLabel,
  summary,
  tone,
  onClick,
}: {
  label: string;
  countLabel: string;
  summary: string;
  tone: CheckpointTone;
  onClick: () => void;
}) {
  const bgClass =
    tone === "yellow"
      ? "bg-[linear-gradient(135deg,#ffd87d,#fff0c9)]"
      : tone === "lavender"
        ? "bg-[linear-gradient(135deg,#cfb3ff,#f1e7ff)]"
        : "bg-[linear-gradient(135deg,#ff9fcb,#ffe2f0)]";

  return (
    <button
      onClick={onClick}
      className={`rotate-[-1deg] rounded-[28px] p-[1px] text-left transition-transform hover:-translate-y-1 ${bgClass} shadow-[0_18px_28px_rgba(255,193,219,0.25)]`}
    >
      <div className="rounded-[27px] bg-white/88 px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <span className="font-display text-lg text-[#d2518f]">{label}</span>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#c25b8f] shadow-[0_6px_14px_rgba(255,204,227,0.32)]">
            {countLabel}
          </span>
        </div>
        <p className="mt-2 text-sm leading-6 text-[#8b5974]">{summary}</p>
      </div>
    </button>
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

function CampaignListSection({
  eyebrow,
  title,
  campaigns,
  isLoading,
  emptyMessage,
  onSelect,
  layout = "default",
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  page,
  totalPages,
  onPageChange,
}: {
  eyebrow: string;
  title: string;
  campaigns: Campaign[];
  isLoading: boolean;
  emptyMessage: string;
  onSelect: (id: string) => void;
  layout?: "default" | "selected";
  actionLabel?: string;
  onAction?: (campaign: Campaign) => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: (campaign: Campaign) => void;
  page?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
}) {
  return (
    <article className="relative overflow-hidden rounded-[42px] border-2 border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.72),rgba(255,244,250,0.94))] p-5 shadow-[0_30px_70px_rgba(233,116,171,0.18)] sm:p-6">
      <SectionTitle eyebrow={eyebrow} title={title} />

      <div className="mt-6 grid gap-4">
        {isLoading ? (
          <div className="rounded-[30px] border border-dashed border-[#f0bfd8] bg-white/70 px-5 py-8 text-center text-sm leading-7 text-[#9a6280]">
            체험단 목록을 불러오는 중이에요.
          </div>
        ) : campaigns.length ? (
          campaigns.map((campaign) => (
            <div
              key={campaign.id}
              onClick={() => onSelect(campaign.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect(campaign.id);
                }
              }}
              role="button"
              tabIndex={0}
              className={`rounded-[34px] bg-gradient-to-r ${campaign.accent} p-[1px] text-left shadow-[0_22px_34px_rgba(255,173,211,0.28)] transition-transform hover:-translate-y-1`}
            >
              <div className="relative overflow-hidden rounded-[33px] bg-white/92 p-5">
                <div className="absolute right-4 top-4 rotate-6 rounded-full bg-[#fff1f8] px-3 py-1 text-xs font-black text-[#cc558f] shadow-[0_8px_18px_rgba(255,204,229,0.35)]">
                  {campaign.sticker}
                </div>
                {layout === "selected" ? (
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <Badge>{campaign.site}</Badge>
                      <Badge tone="yellow">{statusLabel(campaign.status)}</Badge>
                    </div>
                    <h3 className="mt-3 text-2xl font-black text-[#8d315f]">
                      {campaign.title}
                    </h3>
                    <p className="mt-2 text-sm text-[#92617c]">
                      제공 내역: {campaign.reward}
                    </p>
                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                      <InfoMini
                        label="체험 기간"
                        value={`${formatMonthDay(
                          campaign.experienceStartDate,
                        )} - ${formatMonthDay(campaign.experienceEndDate)}`}
                      />
                      <InfoMini
                        label="리뷰 마감"
                        value={formatMonthDay(campaign.reviewDeadline)}
                      />
                      <InfoMini
                        label="확정 일정"
                        value={formatDateTime(campaign.selectedDate)}
                      />
                    </div>
                    {secondaryActionLabel && onSecondaryAction ? (
                      <div className="mt-4 flex justify-end">
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            onSecondaryAction(campaign);
                          }}
                          className="inline-flex min-w-[96px] shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-white px-4 py-2 text-[13px] font-bold leading-none text-[#c55a90] shadow-[0_10px_18px_rgba(255,190,219,0.25)]"
                        >
                          {secondaryActionLabel}
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div className="pr-16">
                      <div className="flex flex-wrap gap-2">
                        <Badge>{campaign.site}</Badge>
                        <Badge tone="yellow">{statusLabel(campaign.status)}</Badge>
                      </div>
                      <h3 className="mt-3 text-2xl font-black text-[#8d315f]">
                        {campaign.title}
                      </h3>
                      <p className="mt-2 text-sm text-[#92617c]">
                        제공 내역: {campaign.reward}
                      </p>
                    </div>
                    <div className="flex flex-col gap-3 xl:min-w-[360px]">
                      <div className="grid gap-3 text-sm text-[#8d5672] sm:grid-cols-3">
                        <InfoMini
                          label="체험 기간"
                          value={`${formatMonthDay(
                            campaign.experienceStartDate,
                          )} - ${formatMonthDay(campaign.experienceEndDate)}`}
                        />
                        <InfoMini
                          label="리뷰 마감"
                          value={formatMonthDay(campaign.reviewDeadline)}
                        />
                        <InfoMini
                          label="확정 일정"
                          value={formatDateTime(campaign.selectedDate)}
                        />
                      </div>
                      {actionLabel && onAction ? (
                        <div className="flex flex-wrap justify-end gap-2">
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              onAction(campaign);
                            }}
                            className="inline-flex min-w-[96px] shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-[linear-gradient(180deg,#ff7db9_0%,#ff97c5_100%)] px-4 py-2 text-[13px] font-bold leading-none text-white shadow-[0_16px_28px_rgba(255,123,184,0.35)]"
                          >
                            {actionLabel}
                          </button>
                          {secondaryActionLabel && onSecondaryAction ? (
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                onSecondaryAction(campaign);
                              }}
                              className="inline-flex min-w-[112px] shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-white px-4 py-2 text-[13px] font-bold leading-none text-[#c55a90] shadow-[0_10px_18px_rgba(255,190,219,0.25)]"
                            >
                              {secondaryActionLabel}
                            </button>
                          ) : null}
                        </div>
                      ) : secondaryActionLabel && onSecondaryAction ? (
                        <div className="flex flex-wrap justify-end gap-2">
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              onSecondaryAction(campaign);
                            }}
                            className="inline-flex min-w-[112px] shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-white px-4 py-2 text-[13px] font-bold leading-none text-[#c55a90] shadow-[0_10px_18px_rgba(255,190,219,0.25)]"
                          >
                            {secondaryActionLabel}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-[30px] border border-dashed border-[#f0bfd8] bg-white/70 px-5 py-8 text-center text-sm leading-7 text-[#9a6280]">
            {emptyMessage}
          </div>
        )}
      </div>
      {page && totalPages && totalPages > 1 && onPageChange ? (
        <div className="mt-5 flex items-center justify-center gap-3">
          <button
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page === 1}
            className="inline-flex min-w-[72px] items-center justify-center whitespace-nowrap rounded-full bg-white px-4 py-2 text-sm font-bold text-[#c45991] shadow-[0_10px_18px_rgba(255,190,219,0.25)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            이전
          </button>
          <span className="rounded-full bg-[#fff3f9] px-4 py-2 text-sm font-bold text-[#a84d7f]">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="inline-flex min-w-[72px] items-center justify-center whitespace-nowrap rounded-full bg-white px-4 py-2 text-sm font-bold text-[#c45991] shadow-[0_10px_18px_rgba(255,190,219,0.25)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            다음
          </button>
        </div>
      ) : null}
    </article>
  );
}

function CampaignDetailSection({
  selectedCampaign,
  holidayMap,
}: {
  selectedCampaign: Campaign | null;
  holidayMap: Map<string, Holiday>;
}) {
  return (
    <article className="relative overflow-hidden rounded-[42px] border-2 border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.76),rgba(255,244,250,0.94))] p-5 shadow-[0_30px_70px_rgba(233,116,171,0.18)] sm:p-6">
      <SectionTitle eyebrow="선택한 체험단 정보" title="상세 정보" />

      {selectedCampaign ? (
        <div className="mt-6 rounded-[34px] bg-[linear-gradient(180deg,rgba(255,242,248,0.95),rgba(255,232,243,0.88))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
          <div className="flex flex-wrap gap-2">
            <Badge>{selectedCampaign.site}</Badge>
            <Badge tone="mint">연락처 입력 완료</Badge>
          </div>
          <h3 className="mt-3 text-3xl font-black text-[#8f315f]">
            {selectedCampaign.title}
          </h3>
          <p className="mt-2 text-sm leading-6 text-[#8a5d75]">
            선택한 체험단의 제공 내역, 체험 기간, 리뷰 마감일, 연락처를 한 화면에서
            확인할 수 있어요.
          </p>
          <div className="mt-3 rounded-[20px] bg-white/70 px-4 py-3 text-sm font-bold text-[#b14f7f]">
            {selectedCampaign.selectedDate
              ? `현재 확정 일정: ${formatConfirmedSchedule(selectedCampaign.selectedDate, holidayMap)}`
              : "아직 일정이 확정되지 않았어요. 캘린더에서 방문 날짜를 눌러 확정해 주세요."}
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <DetailCard label="제공 내역" value={selectedCampaign.reward} />
            <DetailCard label="주소" value={selectedCampaign.address} />
            <DetailCard
              label="체험 기간"
              value={`${selectedCampaign.experienceStartDate} ~ ${selectedCampaign.experienceEndDate}`}
            />
            <DetailCard
              label="리뷰 마감일"
              value={selectedCampaign.reviewDeadline}
            />
            <DetailCard
              label="전화번호"
              value={selectedCampaign.companyPhone ?? "직접 입력 필요"}
            />
            <DetailCard
              label="확정 일정"
              value={formatConfirmedSchedule(selectedCampaign.selectedDate, holidayMap)}
            />
          </div>

          <div className="mt-3 rounded-[24px] border border-white/70 bg-white/85 px-4 py-3 shadow-[0_10px_18px_rgba(255,207,229,0.18)]">
            <p className="text-xs font-black tracking-[0.12em] text-[#d85f98]">
              상세 내용
            </p>
            <p className="mt-2 whitespace-pre-line text-sm font-bold leading-6 text-[#7b4b66]">
              {selectedCampaign.memo}
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-6 rounded-[34px] border border-dashed border-[#f0bfd8] bg-white/70 px-5 py-8 text-center text-sm leading-7 text-[#9a6280]">
          아직 선택된 체험단이 없어요. 실제 선정 링크를 등록하면 상세 정보를
          여기서 확인할 수 있어요.
        </div>
      )}
    </article>
  );
}

function DatePickModal({
  dateIso,
  holidayName,
  campaigns,
  confirmedCampaigns,
  isPending,
  onClose,
  onConfirm,
  onCancel,
  onComplete,
}: {
  dateIso: string;
  holidayName?: string;
  campaigns: Campaign[];
  confirmedCampaigns: Campaign[];
  isPending: boolean;
  onClose: () => void;
  onConfirm: (campaign: Campaign) => void;
  onCancel: (campaign: Campaign) => void;
  onComplete: (campaign: Campaign) => void;
}) {
  const [availablePage, setAvailablePage] = useState(1);
  const [confirmedPage, setConfirmedPage] = useState(1);
  const availablePageCount = Math.max(1, Math.ceil(campaigns.length / 3));
  const confirmedPageCount = Math.max(1, Math.ceil(confirmedCampaigns.length / 3));
  const visibleAvailableCampaigns = campaigns.slice(
    (availablePage - 1) * 3,
    (availablePage - 1) * 3 + 3,
  );
  const visibleConfirmedCampaigns = confirmedCampaigns.slice(
    (confirmedPage - 1) * 3,
    (confirmedPage - 1) * 3 + 3,
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#7d3159]/30 p-4 backdrop-blur-sm">
      <div className="max-h-[min(88vh,980px)] w-full max-w-3xl overflow-y-auto rounded-[36px] border-2 border-white/70 bg-[linear-gradient(180deg,rgba(255,247,251,0.98),rgba(255,236,245,0.95))] p-6 shadow-[0_30px_70px_rgba(210,89,151,0.26)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-display text-xs tracking-[0.18em] text-[#db6aa1]">
              날짜별 체험단 선택
            </p>
            <h2 className="mt-2 text-3xl font-black text-[#8f315f]">
              {formatMonthDay(dateIso)} 일정 확정
            </h2>
            {holidayName ? (
              <p className="mt-3 inline-flex rounded-full bg-[#ffe4ec] px-3 py-1.5 text-sm font-black text-[#d94f73]">
                {holidayName}
              </p>
            ) : null}
            <p className="mt-3 text-sm leading-6 text-[#8a5d75]">
              이 날짜에 체험 가능한 체험단을 확인하고 바로 일정 확정을 진행할 수
              있어요.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full bg-white px-4 py-2 text-sm font-bold text-[#c6538c] shadow-[0_10px_22px_rgba(255,190,219,0.4)]"
          >
            닫기
          </button>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_0.9fr]">
          <div className="rounded-[28px] border border-white/70 bg-white/85 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-xl font-black text-[#8d315f]">체험 가능한 체험단</h3>
              {availablePageCount > 1 ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setAvailablePage(Math.max(1, availablePage - 1))}
                    disabled={availablePage === 1}
                    className="inline-flex min-w-[56px] items-center justify-center whitespace-nowrap rounded-full bg-white px-3 py-2 text-xs font-bold text-[#c45991] shadow-[0_10px_18px_rgba(255,190,219,0.25)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    이전
                  </button>
                  <span className="rounded-full bg-[#fff3f9] px-3 py-2 text-xs font-bold text-[#a84d7f]">
                    {availablePage} / {availablePageCount}
                  </span>
                  <button
                    onClick={() =>
                      setAvailablePage(Math.min(availablePageCount, availablePage + 1))
                    }
                    disabled={availablePage === availablePageCount}
                    className="inline-flex min-w-[56px] items-center justify-center whitespace-nowrap rounded-full bg-white px-3 py-2 text-xs font-bold text-[#c45991] shadow-[0_10px_18px_rgba(255,190,219,0.25)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    다음
                  </button>
                </div>
              ) : null}
            </div>
            <div className="mt-4 grid gap-3">
              {visibleAvailableCampaigns.length ? (
                visibleAvailableCampaigns.map((campaign) => (
                  <div
                    key={campaign.id}
                    className="rounded-[24px] border border-[#ffd4e7] bg-[#fff8fc] p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap gap-2">
                          <Badge>{campaign.site}</Badge>
                          <Badge tone="yellow">체험 가능</Badge>
                        </div>
                        <h4 className="mt-3 text-xl font-black text-[#8d315f]">
                          {campaign.title}
                        </h4>
                        <p className="mt-2 text-sm text-[#8d5b75]">
                          체험 기간: {formatMonthDay(campaign.experienceStartDate)} -{" "}
                          {formatMonthDay(campaign.experienceEndDate)}
                        </p>
                      </div>
                      <button
                        onClick={() => onConfirm(campaign)}
                        disabled={isPending}
                        className="inline-flex min-w-[96px] shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-[linear-gradient(180deg,#ff7db9_0%,#ff97c5_100%)] px-4 py-2 text-[13px] font-bold leading-none text-white shadow-[0_16px_28px_rgba(255,123,184,0.35)] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isPending ? "확정 중..." : "체험 확정"}
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[24px] border border-dashed border-[#f0bfd8] bg-[#fffafc] px-4 py-6 text-center text-sm leading-6 text-[#9a6280]">
                  이 날짜에 새로 확정할 수 있는 체험단이 없어요.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-[28px] border border-white/70 bg-white/85 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-xl font-black text-[#8d315f]">이미 확정된 체험단</h3>
              {confirmedPageCount > 1 ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setConfirmedPage(Math.max(1, confirmedPage - 1))}
                    disabled={confirmedPage === 1}
                    className="inline-flex min-w-[56px] items-center justify-center whitespace-nowrap rounded-full bg-white px-3 py-2 text-xs font-bold text-[#c45991] shadow-[0_10px_18px_rgba(255,190,219,0.25)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    이전
                  </button>
                  <span className="rounded-full bg-[#fff3f9] px-3 py-2 text-xs font-bold text-[#a84d7f]">
                    {confirmedPage} / {confirmedPageCount}
                  </span>
                  <button
                    onClick={() =>
                      setConfirmedPage(Math.min(confirmedPageCount, confirmedPage + 1))
                    }
                    disabled={confirmedPage === confirmedPageCount}
                    className="inline-flex min-w-[56px] items-center justify-center whitespace-nowrap rounded-full bg-white px-3 py-2 text-xs font-bold text-[#c45991] shadow-[0_10px_18px_rgba(255,190,219,0.25)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    다음
                  </button>
                </div>
              ) : null}
            </div>
            <div className="mt-4 grid gap-3">
              {visibleConfirmedCampaigns.length ? (
                visibleConfirmedCampaigns.map((campaign) => (
                  <div
                    key={campaign.id}
                    className="rounded-[24px] border border-[#ffd4e7] bg-[#fff8fc] p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap gap-2">
                          <Badge>{campaign.site}</Badge>
                          <Badge tone="mint">확정 완료</Badge>
                        </div>
                        <h4 className="mt-3 text-lg font-black text-[#8d315f]">
                          {campaign.title}
                        </h4>
                        <p className="mt-2 text-sm text-[#8d5b75]">
                          확정 시간: {formatDateTime(campaign.selectedDate)}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                        <button
                          onClick={() => onComplete(campaign)}
                          disabled={isPending}
                          className="inline-flex min-w-[96px] shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-[linear-gradient(180deg,#ff7db9_0%,#ff97c5_100%)] px-4 py-2 text-[13px] font-bold leading-none text-white shadow-[0_16px_28px_rgba(255,123,184,0.35)] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isPending ? "처리 중..." : "체험완료"}
                        </button>
                        <button
                          onClick={() => onCancel(campaign)}
                          disabled={isPending}
                          className="inline-flex min-w-[96px] shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-white px-4 py-2 text-[13px] font-bold leading-none text-[#c55a90] shadow-[0_10px_18px_rgba(255,190,219,0.25)] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isPending ? "처리 중..." : "확정 취소"}
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[24px] border border-dashed border-[#f0bfd8] bg-[#fffafc] px-4 py-6 text-center text-sm leading-6 text-[#9a6280]">
                  아직 이 날짜에 확정된 체험단이 없어요.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CheckpointDetailModal({
  checkpoint,
  onClose,
}: {
  checkpoint: CheckpointCardData;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#7d3159]/30 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-[36px] border-2 border-white/70 bg-[linear-gradient(180deg,rgba(255,247,251,0.98),rgba(255,236,245,0.95))] p-6 shadow-[0_30px_70px_rgba(210,89,151,0.26)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-display text-xs tracking-[0.18em] text-[#db6aa1]">
              오늘의 체크 포인트
            </p>
            <h2 className="mt-2 text-3xl font-black text-[#8f315f]">
              {checkpoint.label}
            </h2>
            <p className="mt-3 text-sm leading-6 text-[#8a5d75]">
              오늘 꼭 확인해야 하는 체험단 목록이에요.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full bg-white px-4 py-2 text-sm font-bold text-[#c6538c] shadow-[0_10px_22px_rgba(255,190,219,0.4)]"
          >
            닫기
          </button>
        </div>

        <div className="mt-5 rounded-[22px] bg-white/70 px-4 py-3 text-sm font-bold text-[#b15886]">
          {checkpoint.countLabel}
        </div>

        <div className="mt-5 grid gap-3">
          {checkpoint.campaigns.length ? (
            checkpoint.campaigns.map((campaign) => (
              <div
                key={`${checkpoint.id}-${campaign.id}`}
                className="rounded-[24px] border border-[#ffd4e7] bg-[#fff8fc] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap gap-2">
                      <Badge>{campaign.site}</Badge>
                      <Badge tone="yellow">{statusLabel(campaign.status)}</Badge>
                    </div>
                    <h4 className="mt-3 text-xl font-black text-[#8d315f]">
                      {campaign.title}
                    </h4>
                    <div className="mt-2 space-y-1 text-sm text-[#8d5b75]">
                      {checkpoint.id === "today-visit" ? (
                        <p>방문 일정: {formatDateTime(campaign.selectedDate)}</p>
                      ) : null}
                      {checkpoint.id === "deadline-soon" ? (
                        <p>리뷰 마감: {formatMonthDay(campaign.reviewDeadline)}</p>
                      ) : null}
                      {checkpoint.id === "pending-complete" ? (
                        <p>확정 일정: {formatDateTime(campaign.selectedDate)}</p>
                      ) : null}
                      <p>제공 내역: {campaign.reward}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-[24px] border border-dashed border-[#f0bfd8] bg-[#fffafc] px-4 py-6 text-center text-sm leading-6 text-[#9a6280]">
              표시할 체험단이 없어요.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DeleteCampaignConfirmModal({
  campaign,
  isPending,
  onClose,
  onConfirm,
}: {
  campaign: Campaign;
  isPending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#7d3159]/30 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-[36px] border-2 border-white/70 bg-[linear-gradient(180deg,rgba(255,247,251,0.98),rgba(255,236,245,0.95))] p-6 shadow-[0_30px_70px_rgba(210,89,151,0.26)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-display text-xs tracking-[0.18em] text-[#db6aa1]">
              체험단 삭제 확인
            </p>
            <h2 className="mt-2 text-3xl font-black text-[#8f315f]">
              정말 삭제할까요?
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={isPending}
            className="rounded-full bg-white px-4 py-2 text-sm font-bold text-[#c6538c] shadow-[0_10px_22px_rgba(255,190,219,0.4)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            닫기
          </button>
        </div>

        <div className="mt-5 rounded-[24px] border border-[#ffd4e7] bg-[#fff8fc] p-4">
          <div className="flex flex-wrap gap-2">
            <Badge>{campaign.site}</Badge>
            <Badge tone="yellow">{statusLabel(campaign.status)}</Badge>
          </div>
          <h3 className="mt-3 text-2xl font-black text-[#8d315f]">
            {campaign.title}
          </h3>
          <p className="mt-2 text-sm leading-6 text-[#8a5d75]">
            삭제하면 이 체험단의 일정, 상태, 상세정보까지 현재 저장된 관련 데이터가 함께 제거돼요.
          </p>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isPending}
            className="inline-flex min-w-[96px] items-center justify-center whitespace-nowrap rounded-full bg-white px-4 py-2 text-sm font-bold text-[#c55a90] shadow-[0_10px_18px_rgba(255,190,219,0.25)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="inline-flex min-w-[112px] items-center justify-center whitespace-nowrap rounded-full bg-[linear-gradient(180deg,#ff7db9_0%,#ff97c5_100%)] px-4 py-2 text-sm font-bold text-white shadow-[0_16px_28px_rgba(255,123,184,0.35)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "삭제 중..." : "진짜 삭제하기"}
          </button>
        </div>
      </div>
    </div>
  );
}


