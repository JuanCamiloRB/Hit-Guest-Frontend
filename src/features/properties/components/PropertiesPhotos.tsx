"use client"

import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Upload, X, Camera } from "lucide-react"
import { useFormContext } from "react-hook-form"
import { useRef } from "react"
import { PropertyFormData } from "../types"

export function PropertiesPhotos() {
    const { watch, setValue } = useFormContext<PropertyFormData>()
    const picturesUrl = watch("picturesUrl") || []
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const filesArray = Array.from(e.target.files)

            // In a real app, you would upload to a server and get URLs.
            // For now, let's create local blob URLs to preview.
            const newImageUrls = filesArray.map(file => URL.createObjectURL(file))
            setValue("picturesUrl", [...picturesUrl, ...newImageUrls], { shouldValidate: true, shouldDirty: true })
        }
    }

    const removeImage = (indexToRemove: number) => {
        setValue("picturesUrl", picturesUrl.filter((_: string, index: number) => index !== indexToRemove), {
            shouldValidate: true,
            shouldDirty: true,
        })
    }

    return (
        <Card>
            <CardHeader className="border-b bg-slate-50/50">
                <CardTitle className="flex items-center gap-2 text-xl font-bold">
                    <Camera className="h-5 w-5 text-[var(--color-brand-purple)]" />
                    Galería de Fotos
                </CardTitle>
                <CardDescription>
                    Sube fotos de alta calidad para atraer a más huéspedes. La primera imagen será la portada.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                    {picturesUrl.map((url: string, index: number) => (
                        <div key={index} className="aspect-video relative rounded-md overflow-hidden group border">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={url}
                                alt={`Property ${index + 1}`}
                                className="object-cover w-full h-full"
                            />
                            <button
                                type="button"
                                onClick={() => removeImage(index)}
                                className="absolute top-2 right-2 p-1 bg-black/50 hover:bg-black/70 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    ))}
                    <div className="flex aspect-video items-center justify-center rounded-md border border-dashed bg-muted/20 hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                        <input
                            type="file"
                            multiple
                            accept="image/*"
                            className="hidden"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                        />
                        <Button type="button" variant="ghost" className="h-full w-full pointer-events-none">
                            <div className="flex flex-col items-center gap-2">
                                <Upload className="h-8 w-8 text-muted-foreground" />
                                <span className="text-sm text-muted-foreground">Subir Fotos</span>
                            </div>
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
