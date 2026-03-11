"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useTranslation } from "@/hooks/useTranslation"
import { PhoneInputField } from "@/components/ui/phone-input-field"
import { toast } from "sonner"

// We can define a hardcoded list of basic countries for the MVP here
const MOCK_COUNTRIES = [
  { code: "co", name: "Colombia", flag: "🇨🇴" },
  { code: "us", name: "Estados Unidos", flag: "🇺🇸" },
  { code: "de", name: "Alemania", flag: "🇩🇪" },
  { code: "es", name: "España", flag: "🇪🇸" },
  { code: "ar", name: "Argentina", flag: "🇦🇷" },
]

// Mock channels
const MOCK_CHANNELS = [
  { id: "direct", name: "Reserva Directa" },
  { id: "airbnb", name: "Airbnb" },
  { id: "booking", name: "Booking.com" },
]

// Mock Accommodations
const MOCK_ACCOMMODATIONS = [
  { id: "1", name: "U APTO 204" },
  { id: "2", name: "U APTO 305" },
  { id: "3", name: "U VILLA 1" },
]

const formSchema = z.object({
  guestName: z.string().min(2),
  country: z.string().min(2),
  accommodationId: z.string().min(1),
  channel: z.string().min(1),
  checkIn: z.string().min(1),
  checkOut: z.string().min(1), 
  totalPrice: z.union([z.coerce.number(), z.literal('')]).optional(),
  currency: z.string().default("COP"),
  guests: z.coerce.number().min(1),
  whatsapp: z.union([z.string(), z.literal('')]).optional(),
  email: z.union([z.string().email(), z.literal('')]).optional(),
})

type ReservationFormValues = z.infer<typeof formSchema>

interface NewReservationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewReservationDialog({ open, onOpenChange }: NewReservationDialogProps) {
  const { t } = useTranslation()
  const [isLoading, setIsLoading] = React.useState(false)

  const form = useForm<ReservationFormValues>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      guestName: "",
      country: "",
      accommodationId: "",
      channel: "",
      checkIn: "",
      checkOut: "",
      totalPrice: "" as any,
      currency: "COP",
      guests: 1,
      whatsapp: "",
      email: "",
    },
  })

  // Reset form when dialog opens/closes
  React.useEffect(() => {
    if (!open) {
      form.reset()
    }
  }, [open, form])

  async function onSubmit(data: ReservationFormValues) {
    setIsLoading(true)
    
    // Simulating API Call
    setTimeout(() => {
      console.log("Saving Reservation: ", data)
      toast.success(t('common.save')) // Ideally a specific success message, we re-use common for now
      setIsLoading(false)
      onOpenChange(false)
    }, 1500)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center mt-2">
            {t('newReservation.title')}
          </DialogTitle>
          <DialogDescription className="text-center text-sm font-medium text-muted-foreground pb-4 border-b">
            {t('newReservation.subtitle')}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">
            {/* ROW 1: Name, Country, Accommodation */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <FormField
                control={form.control}
                name="guestName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                      <span className="text-red-500">*</span> {t('newReservation.guestName')}
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="abraham lincoln" className="h-11" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="country"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                      <span className="text-red-500">*</span> {t('newReservation.country')}
                    </FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-11">
                          <SelectValue placeholder="Seleccione..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {MOCK_COUNTRIES.map((c) => (
                          <SelectItem key={c.code} value={c.code}>
                            <div className="flex items-center gap-2">
                              <span>{c.flag}</span>
                              <span>{c.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="accommodationId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                      <span className="text-red-500">*</span> {t('newReservation.accommodation')}
                    </FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-11">
                          <SelectValue placeholder="Seleccione..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {MOCK_ACCOMMODATIONS.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* ROW 2: Channel, Check-in, Check-out, Total Price */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <FormField
                control={form.control}
                name="channel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                      <span className="text-red-500">*</span> {t('newReservation.channel')}
                    </FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-11">
                          <SelectValue placeholder="Seleccione..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {MOCK_CHANNELS.map((ch) => (
                          <SelectItem key={ch.id} value={ch.id}>
                            {ch.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="checkIn"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                      <span className="text-red-500">*</span> {t('newReservation.checkIn')}
                    </FormLabel>
                    <FormControl>
                      <Input type="date" className="h-11" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="checkOut"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                      <span className="text-red-500">*</span> {t('newReservation.checkOut')}
                    </FormLabel>
                    <FormControl>
                      <Input type="date" className="h-11" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-2">
                <FormLabel className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                  {t('newReservation.totalPrice')}
                </FormLabel>
                <div className="flex items-center border rounded-md">
                  <div className="flex items-center justify-center px-3 border-r bg-muted text-muted-foreground h-11 text-sm shrink-0 rounded-l-md font-medium">
                    $
                  </div>
                  <div className="flex-1">
                    <FormField
                      control={form.control}
                      name="totalPrice"
                      render={({ field }) => (
                        <FormControl>
                          <Input 
                            type="number" 
                            step="any"
                            className="h-11 rounded-none border-0 focus-visible:ring-0 px-2" 
                            {...field} 
                            value={field.value || ''} 
                          />
                        </FormControl>
                      )}
                    />
                  </div>
                  <div className="w-24 shrink-0">
                    <FormField
                      control={form.control}
                      name="currency"
                      render={({ field }) => (
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-11 rounded-none border-0 border-l focus:ring-0">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="COP">COP</SelectItem>
                            <SelectItem value="USD">USD</SelectItem>
                            <SelectItem value="EUR">EUR</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* ROW 3: Guests, Whatsapp, Email */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <FormField
                control={form.control}
                name="guests"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                      <span className="text-red-500">*</span> {t('newReservation.guests')}
                    </FormLabel>
                    <FormControl>
                      <Input type="number" min="1" className="h-11" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="whatsapp"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold text-muted-foreground">
                      {t('newReservation.whatsapp')}
                    </FormLabel>
                    <FormControl>
                      <PhoneInputField 
                        value={field.value || ''} 
                        onChange={field.onChange} 
                        placeholder="+49"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold text-muted-foreground">
                      {t('newReservation.email')}
                    </FormLabel>
                    <FormControl>
                      <Input type="email" className="h-11" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="pt-6 pb-2">
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#1da0f2] hover:bg-[#198cd6] text-white font-medium h-12 text-md transition-colors"
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('common.save')}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
