/**
 * Countries Service - Based on API Documentation
 * Handles all country-related API calls
 */

import { apiClient } from "@/lib/api-client"
import { keysToCamelCase } from "@/lib/utils/case-converter"
import type { Country, CountryApiResponse, CountryFilter } from "@/types/country"

const API_BASE = process.env.NEXT_PUBLIC_API_URL_GUEST || 'https://guest.hit.tools/api/v1'

export class CountriesService {
  /**
   * Get countries with optional filters
   * @param filters - Filter parameters
   * @returns Array of countries
   */
  async getCountries(filters?: CountryFilter): Promise<Country[]> {
    try {
      const params = new URLSearchParams()
      
      if (filters?.name) {
        params.append('name[has]', filters.name)
      }
      
      if (filters?.region) {
        params.append('region[has]', filters.region)
      }
      
      if (filters?.subregion) {
        params.append('subregion[has]', filters.subregion)
      }
      
      if (filters?.iso2) {
        params.append('iso2[eq]', filters.iso2)
      }
      
      if (filters?.iso3) {
        params.append('iso3[eq]', filters.iso3)
      }
      
      if (filters?.currency) {
        params.append('currency[eq]', filters.currency)
      }
      
      const queryString = params.toString()
      const url = `${API_BASE}/countries${queryString ? `?${queryString}` : ''}`
      
      // Public catalog, used pre-login (register form): authenticate with the app token.
      const response = await apiClient.get<{ success: boolean; data: CountryApiResponse[] }>(url, { appAuth: true })
      
      if (response.success && response.data) {
        return response.data.map(country => keysToCamelCase(country) as Country)
      }
      
      return []
    } catch (error) {
      console.error('[CountriesService] Error fetching countries:', error)
      throw error
    }
  }

  /**
   * Get country by ID
   */
  async getCountryById(id: number): Promise<Country | null> {
    try {
      const countries = await this.getCountries()
      return countries.find(c => c.id === id) || null
    } catch (error) {
      console.error('[CountriesService] Error fetching country by ID:', error)
      throw error
    }
  }

  /**
   * Get country by ISO2 code
   */
  async getCountryByIso2(iso2: string): Promise<Country | null> {
    try {
      const countries = await this.getCountries({ iso2 })
      return countries[0] || null
    } catch (error) {
      console.error('[CountriesService] Error fetching country by ISO2:', error)
      throw error
    }
  }

  /**
   * Get countries by region
   */
  async getCountriesByRegion(region: string): Promise<Country[]> {
    return this.getCountries({ region })
  }

  /**
   * Search countries by name
   */
  async searchCountries(searchTerm: string): Promise<Country[]> {
    return this.getCountries({ name: searchTerm })
  }
}

export const countriesService = new CountriesService()
