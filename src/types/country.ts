/**
 * Country Types - Based on API Documentation
 */

export interface CountryTimezone {
  zoneName: string
  gmtOffset: number
  gmtOffsetName: string
}

export interface Country {
  id: number
  name: string
  iso2: string
  iso3: string
  phoneCode: string
  capital: string
  currency: string
  currencyName: string
  currencySymbol: string
  region: string
  subregion: string
  timezones: CountryTimezone[]
}

export interface CountryApiResponse {
  id: number
  name: string
  iso2: string
  iso3: string
  phone_code: string
  capital: string
  currency: string
  currency_name: string
  currency_symbol: string
  region: string
  subregion: string
  timezones: CountryTimezone[]
}

export type CountryFilterOperator = 'eq' | 'neq' | 'has' | 'nhas'

export interface CountryFilter {
  name?: string
  region?: string
  subregion?: string
  iso2?: string
  iso3?: string
  currency?: string
}

export type CountryFilterParams = {
  [K in keyof CountryFilter as `${K}[${CountryFilterOperator}]`]?: string
}
