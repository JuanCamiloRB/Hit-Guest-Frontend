export interface CatalogOption {
    id: string
    name: string
    description?: string
}

export interface GroupedCatalogOption {
    group: string
    options: CatalogOption[]
}
