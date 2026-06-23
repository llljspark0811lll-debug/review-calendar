export type ParserSupport = "supported" | "unsupported";

export type SiteConnection = {
  id: string;
  siteName: string;
  baseUrl: string;
  loginUrl: string;
  domain: string;
  parserStatus: ParserSupport;
  createdAt: string;
};
