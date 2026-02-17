"use client"

import Image from "next/image"
import { MoreHorizontal, MapPin, BedDouble } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
} from "@/components/ui/card"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Property } from "@/types"
import Link from "next/link"

interface PropertyCardProps {
    property: Property
}

export function PropertyCard({ property }: PropertyCardProps) {
    return (
        <Card className="overflow-hidden">
            <div className="relative aspect-video">
                <Image
                    src={property.imageUrl || "/placeholder.svg"}
                    alt={property.name}
                    fill
                    className="object-cover transition-all hover:scale-105"
                />
                <Badge
                    variant={property.status === "ACTIVE" ? "default" : "secondary"}
                    className="absolute right-2 top-2"
                >
                    {property.status}
                </Badge>
            </div>
            <CardHeader className="p-4">
                <div className="flex items-start justify-between">
                    <div className="grid gap-1">
                        <h3 className="font-semibold leading-none tracking-tight">
                            {property.name}
                        </h3>
                        <div className="flex items-center text-sm text-muted-foreground">
                            <MapPin className="mr-1 h-3 w-3" />
                            {property.city}, {property.country}
                        </div>
                    </div>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="-mt-1 h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Toggle menu</span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem asChild>
                                <Link href={`/dashboard/properties/${property.id}`}>Edit Details</Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem>Manage Automation</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive">
                                Deactivate
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </CardHeader>
            <CardContent className="p-4 pt-0">
                <div className="flex items-center text-sm text-muted-foreground">
                    <BedDouble className="mr-1 h-4 w-4" />
                    3 Units
                </div>
            </CardContent>
            <CardFooter className="p-4 pt-0">
                <Button variant="outline" className="w-full" asChild>
                    <Link href={`/dashboard/properties/${property.id}`}>Manage Property</Link>
                </Button>
            </CardFooter>
        </Card>
    )
}
