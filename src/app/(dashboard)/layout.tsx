import AdminLayout from "@/components/layout/AdminLayout"

export const metadata = {
    title: "Dashboard - Hit Guest",
    description: "Manage your properties and reservations",
}

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return <AdminLayout>{children}</AdminLayout>
}
