import type { Metadata } from "next"
import { DEFAULT_LANGUAGE, dictionaries } from "@/lib/i18n/dictionaries"
import AdminLayout from "@/components/layout/AdminLayout"

// La pestaña se arma en el servidor, donde no existe el idioma elegido por el
// PM (vive en el navegador): manda el idioma por defecto.
export const metadata: Metadata = dictionaries[DEFAULT_LANGUAGE].meta.dashboard

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return <AdminLayout>{children}</AdminLayout>
}
