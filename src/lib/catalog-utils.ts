import { CatalogOption, GroupedCatalogOption } from "@/types/catalogs"

export function groupTimezonesByRegion(options: CatalogOption[]): GroupedCatalogOption[] {
    const groups: Record<string, CatalogOption[]> = {}

    options.forEach((opt) => {
        // Standard timezone format is Region/City (e.g., Africa/Cairo)
        // Some formats might be different, we take the prefix before the first slash
        const parts = opt.id.split("/")
        const region = parts.length > 1 ? parts[0] : "Otros"

        if (!groups[region]) {
            groups[region] = []
        }
        groups[region].push(opt)
    })

    return Object.entries(groups)
        .map(([group, options]) => ({
            group,
            options: options.sort((a, b) => a.name.localeCompare(b.name))
        }))
        .sort((a, b) => a.group.localeCompare(b.group))
}
