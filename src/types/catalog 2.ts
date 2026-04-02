/**
 * Catalog Types - Based on API Documentation
 */

export interface Catalog {
  id: number
  uuid?: string
  catalogCategoryId: number
  catalogCategoryName: string
  name: string
  code: string
  status: 'ACT' | 'INA'
  extra?: any
}

export interface CatalogApiResponse {
  id: number
  uuid?: string
  catalog_category_id: number
  catalogCategoryName: string
  name: string
  code: string
  status: 'ACT' | 'INA'
  extra?: any
}

export type CatalogCategoryName =
  | 'person_type'           // 1
  | 'identification_type'   // 2
  | 'status_record'         // 3
  | 'status_integration'    // 4
  | 'room_type'             // 5
  | 'reservation_source'    // 6
  | 'status_reservation'    // 7
  | 'reason_for_trip'       // 8
  | 'payment_method'        // 9
  | 'amenities'             // 10
  | 'listing_document_type' // 11
  | 'source_pms'            // 12
  | 'person_verification'   // 13
  | 'bed_type'              // bed configuration type
  | 'bath_type'             // bathroom type
  | 'cancellation_policy'   // cancellation policy type

export interface CatalogFilter {
  status?: 'ACT' | 'INA'
  catalogCategoryName?: CatalogCategoryName
  name?: string
  code?: string
}

export interface Timezone {
  value: string
  label: string
}
