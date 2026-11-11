"use client"

import type { ReactNode } from "react"
import { Building2, Network, RadioTower, RefreshCw } from "lucide-react"
import { AirbnbMark, BookingMark, CloudbedsMark, GuestyMark } from "@/components/brand/ProviderMarks"
import { KunasIntegrationPanel } from "./KunasIntegrationPanel"
import { AirbnbIcalPanel } from "./AirbnbIcalPanel"

interface ProviderCardProps {
    name: string
    description: string
    icon: ReactNode
    badge: string
    badgeClassName?: string
}

function ProviderCard({
    name,
    description,
    icon,
    badge,
    badgeClassName = "bg-primary/5 text-primary",
}: ProviderCardProps) {
    return (
        <article className="flex min-h-36 flex-col justify-between rounded-xl border border-rule bg-white p-5 shadow-sm transition-shadow hover:shadow-sm">
            <div className="flex items-start justify-between gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sunk/50 text-ink-2">
                    {icon}
                </span>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${badgeClassName}`}>
                    {badge}
                </span>
            </div>
            <div className="mt-5">
                <h4 className="font-bold text-ink">{name}</h4>
                <p className="mt-1 text-sm leading-relaxed text-ink-3">{description}</p>
            </div>
        </article>
    )
}

/**
 * Integrations are grouped by connection type. Kunas is the only provider with
 * a confirmed frontend/backend connection flow today. The rest are catalogued
 * without inventing credentials or API calls that do not exist yet.
 */
export function IntegrationsHub() {
    return (
        <div className="space-y-12">
            <section aria-labelledby="pms-integrations" className="space-y-5">
                <div className="flex items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <RefreshCw size={19} />
                    </span>
                    <div>
                        <div className="flex flex-wrap items-center gap-2">
                            <h3 id="pms-integrations" className="text-lg font-bold text-ink">
                                Con PMS
                            </h3>
                            <span className="rounded-full bg-primary/5 px-2.5 py-1 text-xs font-bold text-primary">
                                Conectividad Calry.app
                            </span>
                        </div>
                        <p className="mt-1 text-sm text-ink-3">
                            Sincroniza propiedades y reservas desde tu sistema de gestión.
                        </p>
                    </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <ProviderCard
                        name="Kunas PMS"
                        description="Sincroniza tus propiedades y reservas de Kunas."
                        icon={<Building2 className="h-6 w-6 text-primary" />}
                        badge="Configurable"
                        badgeClassName="bg-success-sunk text-success"
                    />
                    <ProviderCard
                        name="Guesty"
                        description="Conectividad PMS centralizada mediante Calry.app."
                        icon={<GuestyMark />}
                        badge="Calry.app"
                    />
                    <ProviderCard
                        name="CloudBeds"
                        description="Conectividad PMS centralizada mediante Calry.app."
                        icon={<CloudbedsMark />}
                        badge="Calry.app"
                    />
                    <ProviderCard
                        name="Otros PMS"
                        description="Conecta cualquiera de los demás PMS compatibles con el catálogo de Calry.app."
                        icon={<Network className="h-6 w-6 text-primary" />}
                        badge="Todos vía Calry.app"
                    />
                </div>

                <div className="rounded-xl border border-rule bg-sunk/60 p-5 sm:p-6">
                    <div className="mb-5 flex items-center gap-3 border-b border-rule pb-4">
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-primary shadow-sm">
                            <Building2 size={17} />
                        </span>
                        <div>
                            <h4 className="font-bold text-ink">Configurar Kunas PMS</h4>
                            <p className="text-xs text-ink-3">Conexión disponible actualmente.</p>
                        </div>
                    </div>
                    <KunasIntegrationPanel />
                </div>
            </section>

            <section aria-labelledby="ota-integrations" className="space-y-5">
                <div className="flex items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-info-sunk text-info">
                        <RadioTower size={19} />
                    </span>
                    <div>
                        <h3 id="ota-integrations" className="text-lg font-bold text-ink">
                            Con OTAs directas
                        </h3>
                        <p className="mt-1 text-sm text-ink-3">
                            Conecta directamente tus canales de venta para importar anuncios y reservas.
                        </p>
                    </div>
                </div>

                {/* Una sola tarjeta de Airbnb, con los calendarios adentro. Antes había
                    una `ProviderCard` decorativa (sin acción) y debajo el panel real con el
                    mismo nombre: el PM veía «dos Airbnb» y no sabía cuál usar (2026-09-22). */}
                <article className="rounded-xl border border-rule bg-white p-5 shadow-sm">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sunk/50">
                                <AirbnbMark />
                            </span>
                            <div>
                                <h4 className="font-bold text-ink">Airbnb</h4>
                                <p className="mt-0.5 text-sm text-ink-3">
                                    Importa tus reservas conectando el calendario iCal de cada anuncio.
                                </p>
                            </div>
                        </div>
                        <span className="shrink-0 rounded-full bg-danger-sunk px-2.5 py-1 text-xs font-bold text-danger">
                            iCal
                        </span>
                    </div>
                    <div className="mt-5 border-t border-rule pt-5">
                        <AirbnbIcalPanel />
                    </div>
                </article>

                <div className="grid gap-4 sm:grid-cols-2">
                    <ProviderCard
                        name="Booking.com"
                        description="Importa tus alojamientos y reservas directamente desde Booking.com."
                        icon={<BookingMark />}
                        badge="Próximamente"
                        badgeClassName="bg-sunk text-ink-3"
                    />
                </div>
            </section>
        </div>
    )
}
