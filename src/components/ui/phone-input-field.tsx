"use client"

import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Phone, Loader2 } from "lucide-react"
import { useEffect, useState } from "react"
import { catalogService } from "@/features/auth/services/catalog-service"

interface PhoneInputProps {
    value?: string;
    onChange?: (value: string) => void;
    disabled?: boolean;
    placeholder?: string;
}

export function PhoneInputField({
    value = "",
    onChange,
    disabled = false,
    placeholder = "300 123 4567"
}: PhoneInputProps) {
    const [countries, setCountries] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        async function loadCountries() {
            try {
                const data = await catalogService.getCountries()
                setCountries(data)
            } finally {
                setIsLoading(false)
            }
        }
        loadCountries()
    }, [])

    // Find current prefix and number
    const sortedCountries = [...countries].sort((a, b) => 
        (b.extra?.phone_prefix?.length || 0) - (a.extra?.phone_prefix?.length || 0)
    )

    const matchedCountry = sortedCountries.find(c => {
        const prefix = c.extra?.phone_prefix
        return prefix && value.startsWith(`+${prefix}`)
    })

    const currentPrefix = matchedCountry ? matchedCountry.extra.phone_prefix : (countries.find(c => c.name === "Colombia")?.extra?.phone_prefix || "57")
    const currentNumber = matchedCountry 
        ? value.slice(matchedCountry.extra.phone_prefix.length + 1).trim() 
        : (value.startsWith("+") ? value.slice(currentPrefix.length + 1).trim() : value)

    const handlePrefixChange = (countryName: string) => {
        const country = countries.find(c => c.name === countryName)
        if (country?.extra?.phone_prefix) {
            onChange?.(`+${country.extra.phone_prefix}${currentNumber}`)
        }
    }

    const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newNumber = e.target.value.replace(/\D/g, "") // Only numbers
        onChange?.(`+${currentPrefix}${newNumber}`)
    }

    if (isLoading) {
        return (
            <div className="flex gap-3 w-full h-11 items-center bg-slate-50/50 border border-slate-200 rounded-xl px-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Cargando prefijos...</span>
            </div>
        )
    }

    return (
        <div className="flex gap-2 items-center w-full mt-1.5">
            <div className="w-[90px] flex-shrink-0">
                <Select
                    onValueChange={handlePrefixChange}
                    value={matchedCountry?.name || (countries.length > 0 ? countries[0].name : "")}
                    disabled={disabled}
                >
                    <SelectTrigger className="w-full !h-11 px-2.5 bg-slate-50 border-slate-200 focus:ring-[var(--color-brand-purple)]/30 focus:border-[var(--color-brand-purple)] rounded-xl group-hover:border-[var(--color-brand-blue)]/40 transition-colors">
                        <SelectValue>
                            <div className="flex items-center gap-1.5 w-full">
                                <span className="text-sm shrink-0">{matchedCountry?.extra?.emoji ? `${matchedCountry.extra.emoji} ` : ""}</span>
                                <span className="text-sm font-semibold text-slate-700">{currentPrefix ? `+${currentPrefix}` : ""}</span>
                            </div>
                        </SelectValue>
                    </SelectTrigger>
                    <SelectContent position="popper" className="z-[100] max-h-[300px]">
                        {countries.map((c, index) => (
                            <SelectItem key={`${c.id}-${c.name}-${index}`} value={c.name}>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm">{c.extra.emoji ? `${c.extra.emoji} ` : ""}</span>
                                    <span className="text-sm font-medium">{c.extra.phone_prefix ? `+${c.extra.phone_prefix}` : ""}</span>
                                    <span className="text-xs text-muted-foreground ml-1 truncate max-w-[100px]">{c.name}</span>
                                </div>
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="flex-1">
                <div className="relative group">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-[var(--color-brand-purple)] transition-colors" />
                    <Input
                        placeholder={placeholder}
                        disabled={disabled}
                        value={currentNumber}
                        onChange={handleNumberChange}
                        className="pl-9 h-11 bg-slate-50/50 border-slate-200 focus-visible:ring-[var(--color-brand-purple)]/20 focus-visible:border-[var(--color-brand-purple)] rounded-xl w-full"
                    />
                </div>
            </div>
        </div>
    )
}
