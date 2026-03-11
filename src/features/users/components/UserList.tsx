"use client"

import { User } from "@/types"
import { columns } from "./columns"
import { DataTable } from "@/components/shared/data-table"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { UserDialog } from "./UserDialog"

// Mock data
const data: User[] = [
    {
        id: "1",
        name: "Juan Camilo",
        email: "admin@hitguest.com",
        role: "ADMIN",
        status: "ACTIVE",
        phone: "+57 300 123 4567"
    },
    {
        id: "2",
        name: "Maria Helper",
        email: "maria@hitguest.com",
        role: "STAFF",
        status: "ACTIVE",
        phone: "+57 310 987 6543"
    },
    {
        id: "3",
        name: "Pedro Pending",
        email: "pedro@hitguest.com",
        role: "STAFF",
        status: "INACTIVE",
        phone: "+57 320 555 1212"
    },
]

export default function UserList() {
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Team Members</h2>
                    <p className="text-muted-foreground">
                        Manage your team members and their permissions.
                    </p>
                </div>
                <UserDialog trigger={
                    <Button className="bg-[var(--color-brand-purple)] hover:bg-[#8b3ee0] text-primary-foreground font-bold shadow-md shadow-[var(--color-brand-purple)]/20 hover:shadow-lg hover:shadow-[var(--color-brand-purple)]/30 transition-all duration-300">
                        <Plus className="mr-2 h-4 w-4" /> Add Member
                    </Button>
                } />
            </div>
            <DataTable columns={columns} data={data} />
        </div>
    )
}
