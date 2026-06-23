import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import type { Campaign } from "@/types/campaign";
import type { Holiday, HolidayType } from "@/types/holiday";
import type { ParserSupport, SiteConnection } from "@/types/site-connection";

const DB_DIR = path.join(process.cwd(), ".local");
const DB_PATH = path.join(DB_DIR, "review-calendar.db");

type CampaignRow = Omit<Campaign, "contactLocked"> & {
  contactLocked: number;
  createdAt: string;
};

type SiteConnectionRow = Omit<SiteConnection, "parserStatus"> & {
  parserStatus: ParserSupport;
};

type HolidayRow = Holiday;

declare global {
  var __reviewCalendarDb: Database.Database | undefined;
}

function ensureDbDir() {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

function createDb() {
  ensureDbDir();

  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS campaigns (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      site TEXT NOT NULL,
      reward TEXT NOT NULL,
      status TEXT NOT NULL,
      detailUrl TEXT NOT NULL,
      experienceStartDate TEXT NOT NULL,
      experienceEndDate TEXT NOT NULL,
      reviewDeadline TEXT NOT NULL,
      selectedDate TEXT,
      capacity TEXT NOT NULL,
      companyName TEXT NOT NULL,
      companyPhone TEXT,
      address TEXT NOT NULL,
      memo TEXT NOT NULL,
      sticker TEXT NOT NULL,
      accent TEXT NOT NULL,
      contactLocked INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS site_connections (
      id TEXT PRIMARY KEY,
      siteName TEXT NOT NULL,
      baseUrl TEXT NOT NULL,
      loginUrl TEXT NOT NULL,
      domain TEXT NOT NULL UNIQUE,
      parserStatus TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS holidays (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      isAlternative INTEGER NOT NULL DEFAULT 0,
      isPublicHoliday INTEGER NOT NULL DEFAULT 1,
      source TEXT NOT NULL,
      sourceUpdatedAt TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS holiday_overrides (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      isAlternative INTEGER NOT NULL DEFAULT 0,
      isPublicHoliday INTEGER NOT NULL DEFAULT 1,
      action TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
  `);

  return db;
}

function getDb() {
  if (!global.__reviewCalendarDb) {
    global.__reviewCalendarDb = createDb();
  }

  return global.__reviewCalendarDb;
}

function mapCampaign(row: CampaignRow): Campaign {
  return {
    ...row,
    contactLocked: Boolean(row.contactLocked),
  };
}

export function listCampaigns() {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM campaigns ORDER BY datetime(createdAt) DESC")
    .all() as CampaignRow[];

  return rows.map(mapCampaign);
}

export function insertCampaign(campaign: Campaign) {
  const db = getDb();
  const createdAt = new Date().toISOString();

  db.prepare(
    `
      INSERT INTO campaigns (
        id, title, site, reward, status, detailUrl,
        experienceStartDate, experienceEndDate, reviewDeadline, selectedDate,
        capacity, companyName, companyPhone, address, memo, sticker, accent,
        contactLocked, createdAt
      ) VALUES (
        @id, @title, @site, @reward, @status, @detailUrl,
        @experienceStartDate, @experienceEndDate, @reviewDeadline, @selectedDate,
        @capacity, @companyName, @companyPhone, @address, @memo, @sticker, @accent,
        @contactLocked, @createdAt
      )
    `,
  ).run({
    ...campaign,
    contactLocked: campaign.contactLocked ? 1 : 0,
    createdAt,
  });

  return campaign;
}

export function updateCampaignSchedule(id: string, selectedDate: string) {
  const db = getDb();

  db.prepare(
    `
      UPDATE campaigns
      SET selectedDate = ?, status = 'scheduled'
      WHERE id = ?
    `,
  ).run(selectedDate, id);
}

export function clearCampaignSchedule(id: string) {
  const db = getDb();

  db.prepare(
    `
      UPDATE campaigns
      SET selectedDate = NULL, status = 'unscheduled'
      WHERE id = ?
    `,
  ).run(id);
}

export function updateCampaignStatus(id: string, status: Campaign["status"]) {
  const db = getDb();

  db.prepare(
    `
      UPDATE campaigns
      SET status = ?
      WHERE id = ?
    `,
  ).run(status, id);
}

export function deleteCampaign(id: string) {
  const db = getDb();
  db.prepare("DELETE FROM campaigns WHERE id = ?").run(id);
}

export function listSiteConnections() {
  const db = getDb();
  return db
    .prepare("SELECT * FROM site_connections ORDER BY datetime(createdAt) DESC")
    .all() as SiteConnectionRow[];
}

export function insertSiteConnection(siteConnection: SiteConnection) {
  const db = getDb();

  db.prepare(
    `
      INSERT INTO site_connections (
        id, siteName, baseUrl, loginUrl, domain, parserStatus, createdAt
      ) VALUES (
        @id, @siteName, @baseUrl, @loginUrl, @domain, @parserStatus, @createdAt
      )
    `,
  ).run(siteConnection);

  return siteConnection;
}

export function deleteSiteConnection(id: string) {
  const db = getDb();
  db.prepare("DELETE FROM site_connections WHERE id = ?").run(id);
}

export function findSiteConnectionByDomain(domain: string) {
  const db = getDb();
  return db
    .prepare("SELECT * FROM site_connections WHERE domain = ?")
    .get(domain) as SiteConnectionRow | undefined;
}

export function findSiteConnectionById(id: string) {
  const db = getDb();
  return db
    .prepare("SELECT * FROM site_connections WHERE id = ?")
    .get(id) as SiteConnectionRow | undefined;
}

function mapHoliday(row: HolidayRow): Holiday {
  return {
    ...row,
    isAlternative: Boolean(row.isAlternative),
    isPublicHoliday: Boolean(row.isPublicHoliday),
  };
}

export function listHolidaysInRange(startDate: string, endDate: string) {
  const db = getDb();
  const holidayRows = db
    .prepare(
      `
        SELECT *
        FROM holidays
        WHERE date >= ? AND date <= ?
        ORDER BY date ASC
      `,
    )
    .all(startDate, endDate) as HolidayRow[];

  const overrideRows = db
    .prepare(
      `
        SELECT *
        FROM holiday_overrides
        WHERE date >= ? AND date <= ?
        ORDER BY date ASC
      `,
    )
    .all(startDate, endDate) as Array<
      HolidayRow & { action: "add" | "hide" | "rename" }
    >;

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

export function countHolidaysByYear(year: number) {
  const db = getDb();
  const row = db
    .prepare(
      `
        SELECT COUNT(*) as count
        FROM holidays
        WHERE date >= ? AND date <= ?
      `,
    )
    .get(`${year}-01-01`, `${year}-12-31`) as { count: number };

  return row.count;
}

export function upsertHolidays(
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

  const db = getDb();
  const statement = db.prepare(`
    INSERT INTO holidays (
      id, date, name, type, isAlternative, isPublicHoliday,
      source, sourceUpdatedAt, createdAt, updatedAt
    ) VALUES (
      @id, @date, @name, @type, @isAlternative, @isPublicHoliday,
      @source, @sourceUpdatedAt, @createdAt, @updatedAt
    )
    ON CONFLICT(date) DO UPDATE SET
      id = excluded.id,
      name = excluded.name,
      type = excluded.type,
      isAlternative = excluded.isAlternative,
      isPublicHoliday = excluded.isPublicHoliday,
      source = excluded.source,
      sourceUpdatedAt = excluded.sourceUpdatedAt,
      updatedAt = excluded.updatedAt
  `);

  const now = new Date().toISOString();
  const insertMany = db.transaction(
    (
      items: Array<
        Omit<Holiday, "createdAt" | "updatedAt"> & {
          createdAt?: string;
          updatedAt?: string;
        }
      >,
    ) => {
      for (const holiday of items) {
        statement.run({
          ...holiday,
          isAlternative: holiday.isAlternative ? 1 : 0,
          isPublicHoliday: holiday.isPublicHoliday ? 1 : 0,
          createdAt: holiday.createdAt ?? now,
          updatedAt: holiday.updatedAt ?? now,
        });
      }
    },
  );

  insertMany(holidays);
}

export function insertHolidayOverride(input: {
  id: string;
  date: string;
  name: string;
  type: HolidayType;
  isAlternative: boolean;
  isPublicHoliday: boolean;
  action: "add" | "hide" | "rename";
}) {
  const db = getDb();
  const now = new Date().toISOString();

  db.prepare(
    `
      INSERT INTO holiday_overrides (
        id, date, name, type, isAlternative, isPublicHoliday, action, createdAt, updatedAt
      ) VALUES (
        @id, @date, @name, @type, @isAlternative, @isPublicHoliday, @action, @createdAt, @updatedAt
      )
    `,
  ).run({
    ...input,
    isAlternative: input.isAlternative ? 1 : 0,
    isPublicHoliday: input.isPublicHoliday ? 1 : 0,
    createdAt: now,
    updatedAt: now,
  });
}
