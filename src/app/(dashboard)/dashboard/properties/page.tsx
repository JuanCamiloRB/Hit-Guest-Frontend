import { Metadata } from "next"
import { DEFAULT_LANGUAGE, dictionaries } from "@/lib/i18n/dictionaries"
import { PropertiesList } from "@/features/properties/components/PropertiesList"

// La pestaña se arma en el servidor, donde no existe el idioma elegido por el
// PM (vive en el navegador): manda el idioma por defecto.
export const metadata: Metadata = dictionaries[DEFAULT_LANGUAGE].meta.properties
import { Page, PageHeader } from "@/components/ui/page"

export default function PropertiesPage() {
    return (
        <Page>
            <PropertiesList />
        </Page>
    )
}
