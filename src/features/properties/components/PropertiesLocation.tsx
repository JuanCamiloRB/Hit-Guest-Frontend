"use client"

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MapPin } from "lucide-react"

export function PropertiesLocation() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Location</CardTitle>
                <CardDescription>
                    Set the exact location of your property for guests.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid gap-2">
                    <Label>Address Search</Label>
                    <div className="relative">
                        <MapPin className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input className="pl-9" placeholder="Enter address to search..." />
                    </div>
                </div>
                <div className="aspect-video w-full rounded-md bg-muted/20 border flex items-center justify-center relative overflow-hidden">
                    {/* Map Placeholder */}
                    <div className="absolute inset-0 bg-[url('https://maps.googleapis.com/maps/api/staticmap?center=Cartagena,Colombia&zoom=13&size=600x300&maptype=roadmap&key=YOUR_API_KEY_HERE')] bg-cover bg-center opacity-50 grayscale hover:grayscale-0 transition-all"></div>
                    <span className="relative z-10 bg-background/80 px-4 py-2 rounded shadow text-sm font-medium">
                        Interactive Map Integration Pending
                    </span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                        <Label>Latitude</Label>
                        <Input placeholder="10.3910" />
                    </div>
                    <div className="grid gap-2">
                        <Label>Longitude</Label>
                        <Input placeholder="-75.4794" />
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
