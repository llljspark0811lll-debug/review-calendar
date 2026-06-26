import fs from "node:fs";
import { chromium, type LaunchOptions } from "playwright";

const WINDOWS_BROWSER_PATHS = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
];

function findInstalledBrowser() {
  return WINDOWS_BROWSER_PATHS.find((browserPath) => fs.existsSync(browserPath));
}

export async function launchVisibleBrowser(options: LaunchOptions = {}) {
  const executablePath = findInstalledBrowser();
  const args = [...(options.args ?? []), "--start-maximized"];

  return chromium.launch({
    ...options,
    args,
    headless: false,
    ...(executablePath ? { executablePath } : {}),
  });
}
