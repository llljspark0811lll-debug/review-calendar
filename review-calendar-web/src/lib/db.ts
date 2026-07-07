import postgres from "postgres";
import type { Campaign } from "@/types/campaign";
import type { Holiday, HolidayType } from "@/types/holiday";
import type { SiteConnection } from "@/types/site-connection";

export type AppUser = {
  id: string;
  email: string;
  name: string;
  createdAt: string;
};

export type AutomationJobStatus = "pending" | "running" | "succeeded" | "failed";
export type AutomationJobType = "parse_campaign";

export type AutomationJob = {
  id: string;
  userId: string;
  type: AutomationJobType;
  status: AutomationJobStatus;
  input: {
    url: string;
  };
  result: {
    campaignId?: string;
  } | null;
  errorMessage: string | null;
  attempts: number;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
};

type UserRow = {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
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

type SiteConnectionRow = SiteConnection;
type HolidayRow = Holiday;
type HolidayOverrideAction = "add" | "hide" | "rename";
type JsonValue = postgres.JSONValue;
type ExternalSiteSessionRow = {
  storageState: JsonValue;
};
type AutomationJobRow = {
  id: string;
  userId: string;
  type: AutomationJobType;
  status: AutomationJobStatus;
  input: AutomationJob["input"];
  result: AutomationJob["result"];
  errorMessage: string | null;
  attempts: number;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
};

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
    });
  }

  return global.__reviewCalendarSql;
}

export async function closeDb() {
  if (global.__reviewCalendarSql) {
    await global.__reviewCalendarSql.end();
    global.__reviewCalendarSql = undefined;
    global.__reviewCalendarSchemaReady = undefined;
  }
}

async function ensureSchema() {
  const sql = getSql();

  if (!global.__reviewCalendarSchemaReady) {
    global.__reviewCalendarSchemaReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          password_hash TEXT NOT NULL,
          created_at TEXT NOT NULL
        )
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
        CREATE TABLE IF NOT EXISTS site_connections (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
        site_name TEXT NOT NULL,
        base_url TEXT NOT NULL,
        login_url TEXT NOT NULL,
        domain TEXT NOT NULL,
        parser_status TEXT NOT NULL,
        created_at TEXT NOT NULL
        )
      `;

      await sql`
        ALTER TABLE campaigns
        ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES users(id) ON DELETE CASCADE
      `;

      await sql`
        ALTER TABLE site_connections
        ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES users(id) ON DELETE CASCADE
      `;

      await sql`
        ALTER TABLE site_connections
        DROP CONSTRAINT IF EXISTS site_connections_domain_key
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS campaigns_user_id_idx
        ON campaigns(user_id)
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS site_connections_user_id_idx
        ON site_connections(user_id)
      `;

      await sql`
        CREATE UNIQUE INDEX IF NOT EXISTS site_connections_user_domain_idx
        ON site_connections(user_id, domain)
        WHERE user_id IS NOT NULL
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS external_site_sessions (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          connector_id TEXT NOT NULL,
          storage_state JSONB NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE(user_id, connector_id)
        )
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS external_site_sessions_user_id_idx
        ON external_site_sessions(user_id)
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS automation_jobs (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          type TEXT NOT NULL,
          status TEXT NOT NULL,
          input JSONB NOT NULL,
          result JSONB,
          error_message TEXT,
          attempts INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          started_at TEXT,
          finished_at TEXT
        )
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS automation_jobs_user_id_idx
        ON automation_jobs(user_id)
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS automation_jobs_status_created_at_idx
        ON automation_jobs(status, created_at)
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
    email: row.email,
    name: row.name,
    createdAt: row.createdAt,
  };
}

const userSelect = `
  SELECT
    id,
    email,
    name,
    password_hash AS "passwordHash",
    created_at AS "createdAt"
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

export async function findUserById(id: string) {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql<UserRow[]>`
    ${sql.unsafe(userSelect)}
    WHERE id = ${id}
    LIMIT 1
  `;

  return rows[0] ? mapUser(rows[0]) : undefined;
}

export async function insertUser(input: {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
}) {
  await ensureSchema();
  const sql = getSql();
  const createdAt = new Date().toISOString();

  await sql`
    INSERT INTO users (id, email, name, password_hash, created_at)
    VALUES (${input.id}, ${input.email.toLowerCase()}, ${input.name}, ${input.passwordHash}, ${createdAt})
  `;

  return {
    id: input.id,
    email: input.email.toLowerCase(),
    name: input.name,
    createdAt,
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
      users.email,
      users.name,
      users.password_hash AS "passwordHash",
      users.created_at AS "createdAt"
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

export async function listSiteConnections(userId: string) {
  await ensureSchema();
  const sql = getSql();

  return sql<SiteConnectionRow[]>`
    SELECT
      id,
      site_name AS "siteName",
      base_url AS "baseUrl",
      login_url AS "loginUrl",
      domain,
      parser_status AS "parserStatus",
      created_at AS "createdAt"
    FROM site_connections
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
  `;
}

export async function insertSiteConnection(
  siteConnection: SiteConnection,
  userId: string,
) {
  await ensureSchema();
  const sql = getSql();

  await sql`
    INSERT INTO site_connections (
      id, user_id, site_name, base_url, login_url, domain, parser_status, created_at
    ) VALUES (
      ${siteConnection.id}, ${userId}, ${siteConnection.siteName}, ${siteConnection.baseUrl}, ${siteConnection.loginUrl},
      ${siteConnection.domain}, ${siteConnection.parserStatus}, ${siteConnection.createdAt}
    )
  `;

  return siteConnection;
}

export async function deleteSiteConnection(id: string, userId: string) {
  await ensureSchema();
  const sql = getSql();
  await sql`DELETE FROM site_connections WHERE id = ${id} AND user_id = ${userId}`;
}

export async function findSiteConnectionByDomain(domain: string, userId: string) {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql<SiteConnectionRow[]>`
    SELECT
      id,
      site_name AS "siteName",
      base_url AS "baseUrl",
      login_url AS "loginUrl",
      domain,
      parser_status AS "parserStatus",
      created_at AS "createdAt"
    FROM site_connections
    WHERE domain = ${domain} AND user_id = ${userId}
    LIMIT 1
  `;

  return rows[0];
}

export async function findSiteConnectionById(id: string, userId: string) {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql<SiteConnectionRow[]>`
    SELECT
      id,
      site_name AS "siteName",
      base_url AS "baseUrl",
      login_url AS "loginUrl",
      domain,
      parser_status AS "parserStatus",
      created_at AS "createdAt"
    FROM site_connections
    WHERE id = ${id} AND user_id = ${userId}
    LIMIT 1
  `;

  return rows[0];
}

export async function findExternalSiteSession(
  userId: string,
  connectorId: string,
) {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql<ExternalSiteSessionRow[]>`
    SELECT storage_state AS "storageState"
    FROM external_site_sessions
    WHERE user_id = ${userId} AND connector_id = ${connectorId}
    LIMIT 1
  `;

  return rows[0]?.storageState;
}

export async function upsertExternalSiteSession(input: {
  id: string;
  userId: string;
  connectorId: string;
  storageState: JsonValue;
}) {
  await ensureSchema();
  const sql = getSql();
  const now = new Date().toISOString();

  await sql`
    INSERT INTO external_site_sessions (
      id, user_id, connector_id, storage_state, created_at, updated_at
    ) VALUES (
      ${input.id}, ${input.userId}, ${input.connectorId}, ${sql.json(input.storageState)}, ${now}, ${now}
    )
    ON CONFLICT(user_id, connector_id) DO UPDATE SET
      storage_state = EXCLUDED.storage_state,
      updated_at = EXCLUDED.updated_at
  `;
}

export async function deleteExternalSiteSession(
  userId: string,
  connectorId: string,
) {
  await ensureSchema();
  const sql = getSql();

  await sql`
    DELETE FROM external_site_sessions
    WHERE user_id = ${userId} AND connector_id = ${connectorId}
  `;
}

function mapAutomationJob(row: AutomationJobRow): AutomationJob {
  return {
    id: row.id,
    userId: row.userId,
    type: row.type,
    status: row.status,
    input: row.input,
    result: row.result,
    errorMessage: row.errorMessage,
    attempts: row.attempts,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
  };
}

const automationJobSelect = `
  SELECT
    id,
    user_id AS "userId",
    type,
    status,
    input,
    result,
    error_message AS "errorMessage",
    attempts,
    created_at AS "createdAt",
    updated_at AS "updatedAt",
    started_at AS "startedAt",
    finished_at AS "finishedAt"
  FROM automation_jobs
`;

export async function insertAutomationJob(input: {
  id: string;
  userId: string;
  type: AutomationJobType;
  input: AutomationJob["input"];
}) {
  await ensureSchema();
  const sql = getSql();
  const now = new Date().toISOString();

  await sql`
    INSERT INTO automation_jobs (
      id, user_id, type, status, input, created_at, updated_at
    ) VALUES (
      ${input.id}, ${input.userId}, ${input.type}, 'pending', ${sql.json(input.input)}, ${now}, ${now}
    )
  `;

  return {
    id: input.id,
    userId: input.userId,
    type: input.type,
    status: "pending" as const,
    input: input.input,
    result: null,
    errorMessage: null,
    attempts: 0,
    createdAt: now,
    updatedAt: now,
    startedAt: null,
    finishedAt: null,
  };
}

export async function findAutomationJobById(id: string, userId: string) {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql<AutomationJobRow[]>`
    ${sql.unsafe(automationJobSelect)}
    WHERE id = ${id} AND user_id = ${userId}
    LIMIT 1
  `;

  return rows[0] ? mapAutomationJob(rows[0]) : undefined;
}

export async function claimNextAutomationJob() {
  await ensureSchema();
  const sql = getSql();

  return sql.begin(async (transaction) => {
    const jobs = await transaction<AutomationJobRow[]>`
      ${transaction.unsafe(automationJobSelect)}
      WHERE status = 'pending'
      ORDER BY created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    `;
    const job = jobs[0];

    if (!job) {
      return undefined;
    }

    const now = new Date().toISOString();
    const updatedJobs = await transaction<AutomationJobRow[]>`
      UPDATE automation_jobs
      SET
        status = 'running',
        attempts = attempts + 1,
        started_at = ${now},
        updated_at = ${now},
        error_message = NULL
      WHERE id = ${job.id}
      RETURNING
        id,
        user_id AS "userId",
        type,
        status,
        input,
        result,
        error_message AS "errorMessage",
        attempts,
        created_at AS "createdAt",
        updated_at AS "updatedAt",
        started_at AS "startedAt",
        finished_at AS "finishedAt"
    `;

    return updatedJobs[0] ? mapAutomationJob(updatedJobs[0]) : undefined;
  });
}

export async function markAutomationJobSucceeded(
  id: string,
  result: AutomationJob["result"],
) {
  await ensureSchema();
  const sql = getSql();
  const now = new Date().toISOString();

  await sql`
    UPDATE automation_jobs
    SET
      status = 'succeeded',
      result = ${sql.json(result ?? {})},
      error_message = NULL,
      updated_at = ${now},
      finished_at = ${now}
    WHERE id = ${id}
  `;
}

export async function markAutomationJobFailed(id: string, errorMessage: string) {
  await ensureSchema();
  const sql = getSql();
  const now = new Date().toISOString();

  await sql`
    UPDATE automation_jobs
    SET
      status = 'failed',
      error_message = ${errorMessage},
      updated_at = ${now},
      finished_at = ${now}
    WHERE id = ${id}
  `;
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

export async function insertHolidayOverride(input: {
  id: string;
  date: string;
  name: string;
  type: HolidayType;
  isAlternative: boolean;
  isPublicHoliday: boolean;
  action: HolidayOverrideAction;
}) {
  await ensureSchema();
  const sql = getSql();
  const now = new Date().toISOString();

  await sql`
    INSERT INTO holiday_overrides (
      id, date, name, type, is_alternative, is_public_holiday,
      action, created_at, updated_at
    ) VALUES (
      ${input.id}, ${input.date}, ${input.name}, ${input.type}, ${input.isAlternative}, ${input.isPublicHoliday},
      ${input.action}, ${now}, ${now}
    )
  `;
}
