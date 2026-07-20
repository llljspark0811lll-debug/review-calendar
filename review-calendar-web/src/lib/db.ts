import { randomUUID } from "node:crypto";
import postgres from "postgres";
import type { Campaign } from "@/types/campaign";
import type { Holiday } from "@/types/holiday";

export type AppUser = {
  id: string;
  username: string;
  email: string;
  name: string;
  createdAt: string;
  onboardingCompletedAt: string | null;
};

type UserRow = {
  id: string;
  username: string;
  email: string;
  name: string;
  passwordHash: string;
  createdAt: string;
  onboardingCompletedAt: string | null;
};

type EmailVerificationCodeRow = {
  id: string;
  email: string;
  codeHash: string;
  expiresAt: string;
  consumedAt: string | null;
  attempts: number;
  createdAt: string;
};

type CampaignRow = Omit<
  Campaign,
  | "detailUrl"
  | "experienceStartDate"
  | "experienceEndDate"
  | "reviewDeadline"
  | "selectedDate"
  | "companyName"
  | "companyPhone"
  | "contactLocked"
> & {
  detailUrl: string;
  experienceStartDate: string;
  experienceEndDate: string;
  reviewDeadline: string;
  selectedDate: string | null;
  companyName: string;
  companyPhone: string | null;
  contactLocked: boolean;
  createdAt: string;
};

type HolidayRow = Holiday;
type HolidayOverrideAction = "add" | "hide" | "rename";

declare global {
  var __reviewCalendarSql: ReturnType<typeof postgres> | undefined;
  var __reviewCalendarSchemaReady: Promise<void> | undefined;
}

function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL 환경변수가 필요해요.");
  }

  return databaseUrl;
}

function getSql() {
  if (!global.__reviewCalendarSql) {
    const databaseUrl = getDatabaseUrl();
    const requiresSsl =
      process.env.NODE_ENV === "production" ||
      databaseUrl.includes("sslmode=require");

    global.__reviewCalendarSql = postgres(databaseUrl, {
      prepare: false,
      ssl: requiresSsl ? "require" : undefined,
      onnotice: () => {},
      // 서버리스 인스턴스마다 별도 풀이 뜨므로, 인스턴스당 커넥션 수를 낮게 잡아
      // 동시 콜드스타트가 몰려도 DB 커넥션 한도를 빠르게 소진하지 않게 한다.
      max: 3,
      idle_timeout: 20,
      connect_timeout: 10,
    });
  }

  return global.__reviewCalendarSql;
}

async function ensureSchema() {
  const sql = getSql();

  if (!global.__reviewCalendarSchemaReady) {
    global.__reviewCalendarSchemaReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          username TEXT UNIQUE,
          email TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          password_hash TEXT NOT NULL,
          created_at TEXT NOT NULL
        )
      `;

      await sql`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS username TEXT
      `;

      await sql`
        UPDATE users
        SET username = 'user_' || substr(replace(id, '-', ''), 1, 10)
        WHERE username IS NULL
      `;

      await sql`
        CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique_idx
        ON users(username)
        WHERE username IS NOT NULL
      `;

      await sql`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS onboarding_completed_at TEXT
      `;

      // 이 컬럼이 생기기 전에 가입한 계정은 강제 튜토리얼 대상이 아니므로,
      // 배포 시점 이전 가입자만 완료 처리된 것으로 소급 처리한다. 이 시점
      // 이후 가입하는(온보딩 컬럼이 NULL인) 계정만 실제로 튜토리얼을 보게 된다.
      await sql`
        UPDATE users
        SET onboarding_completed_at = created_at
        WHERE onboarding_completed_at IS NULL
          AND created_at < '2026-07-20T00:00:00.000Z'
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS email_verification_codes (
          id TEXT PRIMARY KEY,
          email TEXT NOT NULL,
          code_hash TEXT NOT NULL,
          expires_at TEXT NOT NULL,
          consumed_at TEXT,
          attempts INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL
        )
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS email_verification_codes_email_idx
        ON email_verification_codes(email)
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS user_sessions (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          token_hash TEXT NOT NULL UNIQUE,
          expires_at TEXT NOT NULL,
          created_at TEXT NOT NULL
        )
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS user_sessions_user_id_idx
        ON user_sessions(user_id)
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS user_sessions_expires_at_idx
        ON user_sessions(expires_at)
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS campaigns (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        site TEXT NOT NULL,
        reward TEXT NOT NULL,
        status TEXT NOT NULL,
        detail_url TEXT NOT NULL,
        experience_start_date TEXT NOT NULL,
        experience_end_date TEXT NOT NULL,
        review_deadline TEXT NOT NULL,
        selected_date TEXT,
        capacity TEXT NOT NULL,
        company_name TEXT NOT NULL,
        company_phone TEXT,
        address TEXT NOT NULL,
        memo TEXT NOT NULL,
        sticker TEXT NOT NULL,
        accent TEXT NOT NULL,
        contact_locked BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TEXT NOT NULL
        )
      `;

      await sql`
        ALTER TABLE campaigns
        ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES users(id) ON DELETE CASCADE
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS campaigns_user_id_idx
        ON campaigns(user_id)
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS holidays (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        is_alternative BOOLEAN NOT NULL DEFAULT FALSE,
        is_public_holiday BOOLEAN NOT NULL DEFAULT TRUE,
        source TEXT NOT NULL,
        source_updated_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
        )
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS rate_limit_events (
        id TEXT PRIMARY KEY,
        scope TEXT NOT NULL,
        identifier TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS rate_limit_events_lookup_idx
        ON rate_limit_events(scope, identifier, created_at)
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS holiday_overrides (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        is_alternative BOOLEAN NOT NULL DEFAULT FALSE,
        is_public_holiday BOOLEAN NOT NULL DEFAULT TRUE,
        action TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
        )
      `;
    })();
  }

  await global.__reviewCalendarSchemaReady;
}

function mapCampaign(row: CampaignRow): Campaign {
  return {
    id: row.id,
    title: row.title,
    site: row.site,
    reward: row.reward,
    status: row.status,
    detailUrl: row.detailUrl,
    experienceStartDate: row.experienceStartDate,
    experienceEndDate: row.experienceEndDate,
    reviewDeadline: row.reviewDeadline,
    selectedDate: row.selectedDate,
    capacity: row.capacity,
    companyName: row.companyName,
    companyPhone: row.companyPhone,
    address: row.address,
    memo: row.memo,
    sticker: row.sticker,
    accent: row.accent,
    contactLocked: row.contactLocked,
  };
}

function mapUser(row: UserRow): AppUser {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    name: row.name,
    createdAt: row.createdAt,
    onboardingCompletedAt: row.onboardingCompletedAt,
  };
}

const userSelect = `
  SELECT
    id,
    username,
    email,
    name,
    password_hash AS "passwordHash",
    created_at AS "createdAt",
    onboarding_completed_at AS "onboardingCompletedAt"
  FROM users
`;

export async function findUserByEmail(email: string) {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql<UserRow[]>`
    ${sql.unsafe(userSelect)}
    WHERE email = ${email.toLowerCase()}
    LIMIT 1
  `;

  return rows[0];
}

export async function findUserByUsername(username: string) {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql<UserRow[]>`
    ${sql.unsafe(userSelect)}
    WHERE username = ${username.toLowerCase()}
    LIMIT 1
  `;

  return rows[0];
}

export async function findUserById(id: string) {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql<UserRow[]>`
    ${sql.unsafe(userSelect)}
    WHERE id = ${id}
    LIMIT 1
  `;

  return rows[0];
}

export async function updateUserEmail(id: string, email: string) {
  await ensureSchema();
  const sql = getSql();

  await sql`
    UPDATE users SET email = ${email.toLowerCase()} WHERE id = ${id}
  `;
}

export async function deleteUser(id: string) {
  await ensureSchema();
  const sql = getSql();

  await sql`DELETE FROM users WHERE id = ${id}`;
}

export async function insertUser(input: {
  id: string;
  username: string;
  email: string;
  name: string;
  passwordHash: string;
}) {
  await ensureSchema();
  const sql = getSql();
  const createdAt = new Date().toISOString();

  await sql`
    INSERT INTO users (id, username, email, name, password_hash, created_at)
    VALUES (${input.id}, ${input.username.toLowerCase()}, ${input.email.toLowerCase()}, ${input.name}, ${input.passwordHash}, ${createdAt})
  `;

  return {
    id: input.id,
    username: input.username.toLowerCase(),
    email: input.email.toLowerCase(),
    name: input.name,
    createdAt,
    onboardingCompletedAt: null,
  };
}

export async function insertUserSession(input: {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: string;
}) {
  await ensureSchema();
  const sql = getSql();

  await sql`
    INSERT INTO user_sessions (id, user_id, token_hash, expires_at, created_at)
    VALUES (${input.id}, ${input.userId}, ${input.tokenHash}, ${input.expiresAt}, ${new Date().toISOString()})
  `;
}

export async function findUserBySessionTokenHash(tokenHash: string) {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql<UserRow[]>`
    SELECT
      users.id,
      users.username,
      users.email,
      users.name,
      users.password_hash AS "passwordHash",
      users.created_at AS "createdAt",
      users.onboarding_completed_at AS "onboardingCompletedAt"
    FROM user_sessions
    INNER JOIN users ON users.id = user_sessions.user_id
    WHERE user_sessions.token_hash = ${tokenHash}
      AND user_sessions.expires_at > ${new Date().toISOString()}
    LIMIT 1
  `;

  return rows[0] ? mapUser(rows[0]) : undefined;
}

export async function deleteUserSessionByTokenHash(tokenHash: string) {
  await ensureSchema();
  const sql = getSql();

  await sql`DELETE FROM user_sessions WHERE token_hash = ${tokenHash}`;
}

export async function completeUserOnboarding(id: string) {
  await ensureSchema();
  const sql = getSql();

  await sql`
    UPDATE users
    SET onboarding_completed_at = ${new Date().toISOString()}
    WHERE id = ${id}
  `;
}

export async function insertEmailVerificationCode(input: {
  id: string;
  email: string;
  codeHash: string;
  expiresAt: string;
}) {
  await ensureSchema();
  const sql = getSql();

  await sql`
    INSERT INTO email_verification_codes (
      id, email, code_hash, expires_at, created_at
    ) VALUES (
      ${input.id}, ${input.email.toLowerCase()}, ${input.codeHash}, ${input.expiresAt}, ${new Date().toISOString()}
    )
  `;
}

export async function consumeRateLimit(
  scope: string,
  identifier: string,
  limit: number,
  windowSeconds: number,
) {
  await ensureSchema();
  const sql = getSql();
  const windowStart = new Date(Date.now() - windowSeconds * 1000).toISOString();

  await sql`
    DELETE FROM rate_limit_events
    WHERE scope = ${scope} AND identifier = ${identifier} AND created_at < ${windowStart}
  `;

  const rows = await sql<{ count: number }[]>`
    SELECT COUNT(*)::int AS count
    FROM rate_limit_events
    WHERE scope = ${scope} AND identifier = ${identifier}
  `;

  if ((rows[0]?.count ?? 0) >= limit) {
    return { allowed: false };
  }

  await sql`
    INSERT INTO rate_limit_events (id, scope, identifier)
    VALUES (${randomUUID()}, ${scope}, ${identifier})
  `;

  return { allowed: true };
}

export async function findLatestEmailVerificationCode(email: string) {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql<EmailVerificationCodeRow[]>`
    SELECT
      id,
      email,
      code_hash AS "codeHash",
      expires_at AS "expiresAt",
      consumed_at AS "consumedAt",
      attempts,
      created_at AS "createdAt"
    FROM email_verification_codes
    WHERE email = ${email.toLowerCase()}
    ORDER BY created_at DESC
    LIMIT 1
  `;

  return rows[0];
}

export async function incrementEmailVerificationAttempts(id: string) {
  await ensureSchema();
  const sql = getSql();

  await sql`
    UPDATE email_verification_codes
    SET attempts = attempts + 1
    WHERE id = ${id}
  `;
}

export async function consumeEmailVerificationCode(id: string) {
  await ensureSchema();
  const sql = getSql();

  await sql`
    UPDATE email_verification_codes
    SET consumed_at = ${new Date().toISOString()}
    WHERE id = ${id}
  `;
}

const campaignSelect = `
  SELECT
    id,
    title,
    site,
    reward,
    status,
    detail_url AS "detailUrl",
    experience_start_date AS "experienceStartDate",
    experience_end_date AS "experienceEndDate",
    review_deadline AS "reviewDeadline",
    selected_date AS "selectedDate",
    capacity,
    company_name AS "companyName",
    company_phone AS "companyPhone",
    address,
    memo,
    sticker,
    accent,
    contact_locked AS "contactLocked",
    created_at AS "createdAt"
  FROM campaigns
`;

export async function listCampaigns(userId: string) {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql<CampaignRow[]>`
    ${sql.unsafe(campaignSelect)}
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
  `;

  return rows.map(mapCampaign);
}

export async function findCampaignById(id: string, userId: string) {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql<CampaignRow[]>`
    ${sql.unsafe(campaignSelect)}
    WHERE id = ${id} AND user_id = ${userId}
    LIMIT 1
  `;

  return rows[0] ? mapCampaign(rows[0]) : undefined;
}

export async function insertCampaign(campaign: Campaign, userId: string) {
  await ensureSchema();
  const sql = getSql();
  const createdAt = new Date().toISOString();

  await sql`
    INSERT INTO campaigns (
      id, user_id, title, site, reward, status, detail_url,
      experience_start_date, experience_end_date, review_deadline, selected_date,
      capacity, company_name, company_phone, address, memo, sticker, accent,
      contact_locked, created_at
    ) VALUES (
      ${campaign.id}, ${userId}, ${campaign.title}, ${campaign.site}, ${campaign.reward}, ${campaign.status}, ${campaign.detailUrl},
      ${campaign.experienceStartDate}, ${campaign.experienceEndDate}, ${campaign.reviewDeadline}, ${campaign.selectedDate},
      ${campaign.capacity}, ${campaign.companyName}, ${campaign.companyPhone}, ${campaign.address}, ${campaign.memo}, ${campaign.sticker}, ${campaign.accent},
      ${campaign.contactLocked}, ${createdAt}
    )
  `;

  return campaign;
}

export async function updateCampaignSchedule(
  id: string,
  selectedDate: string,
  userId: string,
) {
  await ensureSchema();
  const sql = getSql();

  await sql`
    UPDATE campaigns
    SET selected_date = ${selectedDate}, status = 'scheduled'
    WHERE id = ${id} AND user_id = ${userId}
  `;
}

export async function clearCampaignSchedule(id: string, userId: string) {
  await ensureSchema();
  const sql = getSql();

  await sql`
    UPDATE campaigns
    SET selected_date = NULL, status = 'unscheduled'
    WHERE id = ${id} AND user_id = ${userId}
  `;
}

export async function updateCampaignStatus(
  id: string,
  status: Campaign["status"],
  userId: string,
) {
  await ensureSchema();
  const sql = getSql();

  await sql`
    UPDATE campaigns
    SET status = ${status}
    WHERE id = ${id} AND user_id = ${userId}
  `;
}

export async function deleteCampaign(id: string, userId: string) {
  await ensureSchema();
  const sql = getSql();
  await sql`DELETE FROM campaigns WHERE id = ${id} AND user_id = ${userId}`;
}

function mapHoliday(row: HolidayRow): Holiday {
  return {
    ...row,
    isAlternative: row.isAlternative,
    isPublicHoliday: row.isPublicHoliday,
  };
}

export async function listHolidaysInRange(startDate: string, endDate: string) {
  await ensureSchema();
  const sql = getSql();
  const holidayRows = await sql<HolidayRow[]>`
    SELECT
      id,
      date,
      name,
      type,
      is_alternative AS "isAlternative",
      is_public_holiday AS "isPublicHoliday",
      source,
      source_updated_at AS "sourceUpdatedAt",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM holidays
    WHERE date >= ${startDate} AND date <= ${endDate}
    ORDER BY date ASC
  `;

  const overrideRows = await sql<Array<HolidayRow & { action: HolidayOverrideAction }>>`
    SELECT
      id,
      date,
      name,
      type,
      is_alternative AS "isAlternative",
      is_public_holiday AS "isPublicHoliday",
      'manual' AS source,
      NULL::text AS "sourceUpdatedAt",
      created_at AS "createdAt",
      updated_at AS "updatedAt",
      action
    FROM holiday_overrides
    WHERE date >= ${startDate} AND date <= ${endDate}
    ORDER BY date ASC
  `;

  const holidayMap = new Map<string, Holiday>(
    holidayRows.map((row) => [row.date, mapHoliday(row)]),
  );

  for (const override of overrideRows) {
    if (override.action === "hide") {
      holidayMap.delete(override.date);
      continue;
    }

    if (override.action === "rename" && holidayMap.has(override.date)) {
      holidayMap.set(override.date, mapHoliday(override));
      continue;
    }

    if (override.action === "add") {
      holidayMap.set(override.date, mapHoliday(override));
    }
  }

  return Array.from(holidayMap.values()).sort((left, right) =>
    left.date.localeCompare(right.date),
  );
}

export async function countHolidaysByYear(year: number) {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql<Array<{ count: string }>>`
    SELECT COUNT(*)::text AS count
    FROM holidays
    WHERE date >= ${`${year}-01-01`} AND date <= ${`${year}-12-31`}
  `;

  return Number.parseInt(rows[0]?.count ?? "0", 10);
}

export async function upsertHolidays(
  holidays: Array<
    Omit<Holiday, "createdAt" | "updatedAt"> & {
      createdAt?: string;
      updatedAt?: string;
    }
  >,
) {
  if (!holidays.length) {
    return;
  }

  await ensureSchema();
  const sql = getSql();
  const now = new Date().toISOString();

  await sql.begin(async (transaction) => {
    for (const holiday of holidays) {
      await transaction`
        INSERT INTO holidays (
          id, date, name, type, is_alternative, is_public_holiday,
          source, source_updated_at, created_at, updated_at
        ) VALUES (
          ${holiday.id}, ${holiday.date}, ${holiday.name}, ${holiday.type}, ${holiday.isAlternative}, ${holiday.isPublicHoliday},
          ${holiday.source}, ${holiday.sourceUpdatedAt}, ${holiday.createdAt ?? now}, ${holiday.updatedAt ?? now}
        )
        ON CONFLICT(date) DO UPDATE SET
          id = EXCLUDED.id,
          name = EXCLUDED.name,
          type = EXCLUDED.type,
          is_alternative = EXCLUDED.is_alternative,
          is_public_holiday = EXCLUDED.is_public_holiday,
          source = EXCLUDED.source,
          source_updated_at = EXCLUDED.source_updated_at,
          updated_at = EXCLUDED.updated_at
      `;
    }
  });
}

