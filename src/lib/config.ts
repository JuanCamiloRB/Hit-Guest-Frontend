/**
 * Centralized Configuration for the Application
 * All environment variables should be accessed through this file.
 */


export const CONFIG = {
  // API URLs
  API_URL_GUEST: process.env.NEXT_PUBLIC_API_URL_GUEST || "https://www.kunas.co/api/v1",
  API_URL_HIT: process.env.NEXT_PUBLIC_API_URL_HIT || "https://www.kunas.co/api/v1",
  
  // App Tokens
  APP_API_TOKEN: process.env.NEXT_PUBLIC_APP_API_TOKEN || "",
  
  // Feature Flags
  ENABLE_MOCKS: process.env.NEXT_PUBLIC_ENABLE_MOCKS === "true",
  
  // Localization
  DEFAULT_LOCALE: "es",
};

// Common derived paths
export const API_BASE = CONFIG.API_URL_GUEST.replace(/\/$/, "");
