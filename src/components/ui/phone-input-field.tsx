"use client"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Phone } from "lucide-react"
import { COUNTRY_CODES } from "@/features/auth/constants"

interface PhoneInputProps {
    value?: string;
    onChange?: (value: string) => void;
    disabled?: boolean;
    placeholder?: string;
    className?: string;
}

export function PhoneInputField({
    value = "",
    onChange,
    disabled = false,
    placeholder = "300 123 4567",
    className
}: PhoneInputProps) {

    let currentCode = "Colombia"
    let currentNumber = value || ""

    const matchedCountry = [...COUNTRY_CODES]
        .sort((a, b) => b.code.length - a.code.length)
        .find(c => value.startsWith(c.code))

    if (matchedCountry) {
        currentCode = matchedCountry.country
        currentNumber = value.slice(matchedCountry.code.length).trim()
    } else if (!value) {
        currentCode = "Colombia"
    }

    const handleCodeChange = (newCountry: string) => {
        const countryObj = COUNTRY_CODES.find(c => c.country === newCountry)
        const prefix = countryObj?.code || ""
        onChange?.(`${prefix}${currentNumber}`)
    }

    const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newNumber = e.target.value
        const countryObj = COUNTRY_CODES.find(c => c.country === currentCode)
        const prefix = countryObj?.code || ""
        onChange?.(`${prefix}${newNumber}`)
    }

    const countryObj = COUNTRY_CODES.find(c => c.country === currentCode)
    const currentFlag = countryObj?.flag || "🇨🇴"

    return (
        <div className={cn("flex gap-3 items-start w-full", className)}>
            <div className="w-[110px] flex-shrink-0">
                <Select
                    onValueChange={handleCodeChange}
                    value={currentCode}
                    disabled={disabled}
                >
                    <SelectTrigger className="w-full h-11 rounded-xl border-slate-200 px-3 group-focus-within:ring-[var(--color-brand-purple)]/20 shadow-sm transition-all focus:ring-[var(--color-brand-purple)]">
                        <SelectValue>
                            <span className="flex items-center gap-2">
                                <span>{currentFlag}</span>
                                <span>{countryObj?.code}</span>
                            </span>
                        </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                        {COUNTRY_CODES.map((c) => (
                            <SelectItem key={c.country} value={c.country}>
                                <span className="flex items-center gap-2">
                                    <span>{c.flag}</span>
                                    <span>{c.code}</span>
                                </span>
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="flex-1">
                <div className="relative group">
                    <Phone className="absolute left-3 top-3.5 h-4 w-4 text-slate-400 group-focus-within:text-[var(--color-brand-purple)] transition-colors" />
                    <Input
                        placeholder={placeholder}
                        disabled={disabled}
                        value={currentNumber}
                        onChange={handleNumberChange}
                        className="pl-9 h-11 rounded-xl border-slate-200 focus-visible:ring-[var(--color-brand-purple)]/20 focus-visible:border-[var(--color-brand-purple)] shadow-sm transition-all w-full bg-white"
                    />
                </div>
            </div>
        </div>
    )
}
