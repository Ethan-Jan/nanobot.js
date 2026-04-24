/** 与 workspace `.nanobot/user-context.json` / API 对齐 */

export type UserProfileDTO = {
  summary?: string;
  role?: string;
  domain?: string;
  techStack?: string[];
  timezoneOrSchedule?: string;
  notes?: string;
};

export type UserIntentDTO = {
  summary?: string;
  shortTerm?: string;
  updatedAt?: string;
};

export type UserPreferencesDTO = {
  responseLanguage?: string;
  detailLevel?: "brief" | "normal" | "detailed";
  codeAndDocsStyle?: string;
  extra?: string;
};

export type UserContextDTO = {
  version: 1;
  updatedAt: string;
  profile?: UserProfileDTO;
  intent?: UserIntentDTO;
  preferences?: UserPreferencesDTO;
};
