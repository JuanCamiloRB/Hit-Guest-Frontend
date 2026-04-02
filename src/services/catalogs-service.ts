/**
 * Catalogs Service - Based on API Documentation
 * Handles all catalog-related API calls
 */

import { apiClient } from "@/lib/api-client"
import { keysToCamelCase } from "@/lib/utils/case-converter"
import type { Catalog, CatalogApiResponse, CatalogFilter, Timezone } from "@/types/catalog"
import { API_BASE } from "@/lib/config"

export interface CatalogOption {
  id: string
  name: string
  description?: string
  extra?: any
}

export class CatalogsService {
  /**
   * Get catalogs with optional filters
   * @param filters - Filter parameters
   * @returns Array of catalogs
   */
  async getCatalogs(filters?: CatalogFilter): Promise<Catalog[]> {
    try {
      const params = new URLSearchParams()
      
      if (filters?.status) {
        params.append('status[eq]', filters.status)
      }
      
      if (filters?.catalogCategoryName) {
        params.append('catalogCategoryName[eq]', filters.catalogCategoryName)
      }
      
      if (filters?.name) {
        params.append('name[has]', filters.name)
      }
      
      if (filters?.code) {
        params.append('code[eq]', filters.code)
      }
      
      const queryString = params.toString()
      const url = `${API_BASE}/catalogs${queryString ? `?${queryString}` : ''}`
      
      const response = await apiClient.get<CatalogApiResponse[]>(url)
      
      if (response && Array.isArray(response)) {
        return response.map(catalog => keysToCamelCase(catalog) as Catalog)
      }
      
      return []
    } catch (error) {
      console.error('[CatalogsService] Error fetching catalogs:', error)
      return []
    }
  }

  /**
   * Get person types (catalog_category_id = 1)
   */
  async getPersonTypes(): Promise<CatalogOption[]> {
    const types = await this.getCatalogs({
      status: 'ACT',
      catalogCategoryName: 'person_type'
    })
    
    // Fallback if API fails
    if (types.length === 0) {
        return [
            { id: "1", name: "Individual" },
            { id: "2", name: "Empresa" }
        ]
    }
    return types.map(t => ({ id: String(t.uuid || t.id), name: t.name, extra: t.extra }))
  }

  /**
   * Get identification types (catalog_category_id = 2)
   */
  async getIdentificationTypes(): Promise<CatalogOption[]> {
    const types = await this.getCatalogs({
      status: 'ACT',
      catalogCategoryName: 'identification_type'
    })
    return types.map(t => ({ id: String(t.uuid || t.id), name: t.name, extra: t.extra }))
  }

  /**
   * Get status records (catalog_category_id = 3)
   */
  async getStatusRecords(): Promise<CatalogOption[]> {
    const types = await this.getCatalogs({
      status: 'ACT',
      catalogCategoryName: 'status_record'
    })
    return types.map(t => ({ id: String(t.uuid || t.id), name: t.name, extra: t.extra }))
  }

  /**
   * Get room types (catalog_category_id = 5)
   */
  async getRoomTypes(): Promise<CatalogOption[]> {
    const types = await this.getCatalogs({
      status: 'ACT',
      catalogCategoryName: 'room_type'
    })
    return types.map(t => ({ id: String(t.uuid || t.id), name: t.name, extra: t.extra }))
  }

  /**
   * Get reservation sources (catalog_category_id = 6)
   */
  async getReservationSources(): Promise<CatalogOption[]> {
    const types = await this.getCatalogs({
      status: 'ACT',
      catalogCategoryName: 'reservation_source'
    })
    return types.map(t => ({ id: String(t.uuid || t.id), name: t.name, extra: t.extra }))
  }

  /**
   * Get amenities (catalog_category_id = 10)
   */
  async getAmenities(): Promise<CatalogOption[]> {
    const types = await this.getCatalogs({
      status: 'ACT',
      catalogCategoryName: 'amenities'
    })
    return types.map(t => ({ id: String(t.uuid || t.id), name: t.name, extra: t.extra }))
  }

  /**
   * Get source PMS (catalog_category_id = 12)
   */
  async getSourcePms(): Promise<CatalogOption[]> {
    const types = await this.getCatalogs({
      status: 'ACT',
      catalogCategoryName: 'source_pms'
    })
    return types.map(t => ({ id: String(t.uuid || t.id), name: t.name, extra: t.extra }))
  }

  /**
   * Get bed types (catalog_category_name = 'bed_type')
   * Falls back to hardcoded values if the API doesn't have this category yet.
   */
  async getBedTypes(): Promise<CatalogOption[]> {
    const types = await this.getCatalogs({
      status: 'ACT',
      catalogCategoryName: 'bed_type'
    })
    if (types.length === 0) {
      return [
        { id: 'SINGLE', name: 'Sencilla' },
        { id: 'TWIN',   name: 'Twin (2 individuales)' },
        { id: 'DOUBLE', name: 'Doble' },
        { id: 'QUEEN',  name: 'Queen' },
        { id: 'KING',   name: 'King' },
        { id: 'BUNK',   name: 'Camarote / Litera' },
      ]
    }
    return types.map(t => ({ id: t.code || String(t.uuid || t.id), name: t.name, extra: t.extra }))
  }

  /**
   * Get bath types (catalog_category_name = 'bath_type')
   * Falls back to hardcoded values if the API doesn't have this category yet.
   */
  async getBathTypes(): Promise<CatalogOption[]> {
    const types = await this.getCatalogs({
      status: 'ACT',
      catalogCategoryName: 'bath_type'
    })
    if (types.length === 0) {
      return [
        { id: 'PRIVATE', name: 'Privado' },
        { id: 'SHARED',  name: 'Compartido' },
      ]
    }
    return types.map(t => ({ id: t.code || String(t.uuid || t.id), name: t.name, extra: t.extra }))
  }

  /**
   * Get cancellation policies (catalog_category_name = 'cancellation_policy')
   * Falls back to hardcoded values if the API doesn't have this category yet.
   */
  async getCancellationPolicies(): Promise<CatalogOption[]> {
    const types = await this.getCatalogs({
      status: 'ACT',
      catalogCategoryName: 'cancellation_policy'
    })
    if (types.length === 0) {
      return [
        { id: 'STANDARD',  name: 'Estándar' },
        { id: 'FLEXIBLE',  name: 'Flexible' },
        { id: 'STRICT',    name: 'Estricta' },
        { id: 'NON_REFUNDABLE', name: 'No reembolsable' },
      ]
    }
    return types.map(t => ({ id: t.code || String(t.uuid || t.id), name: t.name, extra: t.extra }))
  }

  /**
   * Get countries
   */
  async getCountries(): Promise<any[]> {
    try {
        const url = `${API_BASE}/countries`
        const response = await apiClient.get<any[]>(url)
        if (!Array.isArray(response)) return []

        return response.map((c: any) => ({
            id: String(c.id || c.uuid || c.iso2 || c.iso3),
            name: String(c.name || c.es_name || "Sin nombre"),
            extra: {
                ...c,
                phone_prefix: c.phonecode || c.phone_prefix || c.dial_code || ""
            }
        }))
    } catch (e) {
        console.error('[CatalogsService] Error fetching countries:', e)
        return []
    }
  }

  /**
   * Get timezones
   */
  async getTimezones(): Promise<CatalogOption[]> {
    try {
      const url = `${API_BASE}/catalogs/category/timezones`
      const response = await apiClient.get<any>(url)
      
      let allTimezones: any[] = []
      if (Array.isArray(response)) {
        // Flatten grouped timezones if returned in groups
        response.forEach((group: any) => {
          if (group.timezones && Array.isArray(group.timezones)) {
            allTimezones.push(...group.timezones)
          } else {
            allTimezones.push(group)
          }
        })
      }
      
      return allTimezones.map(tz => ({
          id: tz.value || tz.id || tz.uuid || "",
          name: tz.label || tz.name || ""
      }))
    } catch (error) {
      console.error('[CatalogsService] Error fetching timezones:', error)
      return []
    }
  }
}

export const catalogsService = new CatalogsService()
