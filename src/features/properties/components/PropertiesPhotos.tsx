"use client"

import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Upload, X } from "lucide-react"
import Image from "next/image"

export function PropertiesPhotos() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Photos</CardTitle>
                <CardDescription>
                    Upload images of your property. Drag and drop to reorder.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                    <div className="aspect-video relative rounded-md overflow-hidden group">
                        <Image
                            src="https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&auto=format&fit=crop&q=60"
                            alt="Property 1"
                            fill
                            className="object-cover"
                        />
                        <button className="absolute top-2 right-2 p-1 bg-black/50 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity">
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                    <div className="aspect-video relative rounded-md overflow-hidden group">
                        <Image
                            src="https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&auto=format&fit=crop&q=60"
                            alt="Property 2"
                            fill
                            className="object-cover"
                        />
                        <button className="absolute top-2 right-2 p-1 bg-black/50 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity">
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                    <div className="flex aspect-video items-center justify-center rounded-md border border-dashed">
                        <Button variant="ghost" className="h-full w-full">
                            <div className="flex flex-col items-center gap-2">
                                <Upload className="h-8 w-8 text-muted-foreground" />
                                <span className="text-sm text-muted-foreground">Upload Photo</span>
                            </div>
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
