import { Metadata } from "next"
import UserList from "@/features/users/components/UserList"

export const metadata: Metadata = {
    title: "Team - Hit Guest",
    description: "Manage your team members",
}

export default function TeamPage() {
    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <UserList />
        </div>
    )
}
