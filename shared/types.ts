export type LangCode =
  | "ca" | "gl" | "eu" | "en" | "fr" | "de" | "it" | "ru" | "bg" | "ro" | "sr" | "zh-Hans" | "ja" | "hi" | "id" | "ar" | "sw" | "tsw" | "mi" | "qu" | "es";

export interface MonitorTarget {
  id: string;
  userId: string;
  label: string;
  kind: "http" | "tcp";
  address: string;       // URL for http, host for tcp
  port?: number;         // required for tcp
  intervalMinutes: number; // 20 by default
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CheckResult {
  id: string;
  targetId: string;
  ok: boolean;
  latencyMs?: number;
  error?: string;
  checkedAt: string;
}

export interface NotificationSettings {
  emailRecipients: string[];
  telegramChatId?: string;     // per-user chat id after /start <token>
  pushDevices: string[];       // Expo push tokens
  dailyDigest: boolean;
  monthlyDigest: boolean;
}

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: string;
}
