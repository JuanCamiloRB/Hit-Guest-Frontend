/**
 * Centralized Configuration for the Application
 * All environment variables should be accessed through this file.
 */

const getEnv = (key: string, defaultValue: string = ""): string => {
  if (typeof process === 'undefined') return defaultValue;
  return (process.env[key] || defaultValue).trim();
};

export const CONFIG = {
  // API URLs
  API_URL_GUEST: getEnv("NEXT_PUBLIC_API_URL_GUEST", "https://www.kunas.co/api/v1"),
  API_URL_HIT: getEnv("NEXT_PUBLIC_API_URL_HIT", "https://www.kunas.co/api/v1"),
  
  // App Tokens
  APP_API_TOKEN: getEnv("NEXT_PUBLIC_APP_API_TOKEN"),
  
  // Feature Flags
  ENABLE_MOCKS: getEnv("NEXT_PUBLIC_ENABLE_MOCKS", "false") === "true",
  
  // Localization
  DEFAULT_LOCALE: "es",
};

// Common derived paths
export const API_BASE = CONFIG.API_URL_GUEST.replace(/\/$/, "");
