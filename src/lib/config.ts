/**
 * Centralized Configuration for the Application
 * All environment variables should be accessed through this file.
 */


export const CONFIG = {
  // API URLs
  API_URL_GUEST: process.env.NEXT_PUBLIC_API_URL_GUEST || "https://guest.hit.tools/api/v1",
  API_URL_HIT: process.env.NEXT_PUBLIC_API_URL_HIT || "https://guest.hit.tools/api/v1",
  
  // Feature Flags
  ENABLE_MOCKS: process.env.NEXT_PUBLIC_ENABLE_MOCKS === "true",
  
  // Localization
  DEFAULT_LOCALE: "es",
};

// Common derived paths
// Browser requests go through the same-origin BFF so the shared application
// token never enters the client bundle. Server-only code may still call the
// backend directly through CONFIG.API_URL_GUEST.
export const API_BASE = typeof window === "undefined"
  ? CONFIG.API_URL_GUEST.replace(/\/$/, "")
  : "/api/guest";
