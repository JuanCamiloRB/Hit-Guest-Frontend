import { Metadata } from "next"
import UserList from "@/features/users/components/UserList"
import { Page, PageHeader } from "@/components/ui/page"

export const metadata: Metadata = {
    title: "Team - Hit Guest",
    description: "Manage your team members",
}

export default function TeamPage() {
    return (
        <Page>
            <UserList />
        </Page>
    )
}
