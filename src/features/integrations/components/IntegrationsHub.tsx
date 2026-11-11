"use client"

import type { ReactNode } from "react"
import { Building2, Network, RadioTower, RefreshCw } from "lucide-react"
import { Icon } from "@/components/ui/icon"
import { AirbnbMark, BookingMark, CloudbedsMark, GuestyMark } from "@/components/brand/ProviderMarks"
import { KunasIntegrationPanel } from "./KunasIntegrationPanel"
import { AirbnbIcalPanel } from "./AirbnbIcalPanel"
import { Badge } from "@/components/ui/badge"
import { Heading } from "@/components/ui/heading"
import { Surface } from "@/components/ui/card"
import { IconBadge } from "@/components/ui/icon-badge"

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
        <Surface as="article" className="flex min-h-36 flex-col justify-between p-5 transition-shadow">
            <div className="flex items-start justify-between gap-4">
                <IconBadge tone="neutral" size="md" shape="square">{icon}</IconBadge>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${badgeClassName}`}>
                    {badge}
                </span>
            </div>
            <div className="mt-5">
                <Heading level={4} size="section">{name}</Heading>
                <p className="mt-1 text-sm leading-relaxed text-ink-3">{description}</p>
            </div>
        </Surface>
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
                    <IconBadge icon={RefreshCw} tone="primary" size="md" shape="square" />
                    <div>
                        <div className="flex flex-wrap items-center gap-2">
                            <Heading level={3} id="pms-integrations">
                                Con PMS
                            </Heading>
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
                        icon={<Icon icon={Building2} size="xl" className="text-primary" />}
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
                        icon={<Icon icon={Network} size="xl" className="text-primary" />}
                        badge="Todos vía Calry.app"
                    />
                </div>

                <div className="rounded-xl border border-rule bg-sunk/50 p-5 sm:p-6">
                    <div className="mb-5 flex items-center gap-3 border-b border-rule pb-4">
                        <IconBadge icon={Building2} tone="primary" size="sm" shape="square" />
                        <div>
                            <Heading level={4} size="section">Configurar Kunas PMS</Heading>
                            <p className="text-xs text-ink-3">Conexión disponible actualmente.</p>
                        </div>
                    </div>
                    <KunasIntegrationPanel />
                </div>
            </section>

            <section aria-labelledby="ota-integrations" className="space-y-5">
                <div className="flex items-start gap-3">
                    <IconBadge icon={RadioTower} tone="info" size="md" shape="square" />
                    <div>
                        <Heading level={3} id="ota-integrations">
                            Con OTAs directas
                        </Heading>
                        <p className="mt-1 text-sm text-ink-3">
                            Conecta directamente tus canales de venta para importar anuncios y reservas.
                        </p>
                    </div>
                </div>

                {/* Una sola tarjeta de Airbnb, con los calendarios adentro. Antes había
                    una `ProviderCard` decorativa (sin acción) y debajo el panel real con el
                    mismo nombre: el PM veía «dos Airbnb» y no sabía cuál usar (2026-09-22). */}
                <Surface as="article" className="p-5">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sunk/50">
                                <AirbnbMark />
                            </span>
                            <div>
                                <Heading level={4} size="section">Airbnb</Heading>
                                <p className="mt-0.5 text-sm text-ink-3">
                                    Importa tus reservas conectando el calendario iCal de cada anuncio.
                                </p>
                            </div>
                        </div>
                        <Badge>iCal</Badge>
                    </div>
                    <div className="mt-5 border-t border-rule pt-5">
                        <AirbnbIcalPanel />
                    </div>
                </Surface>

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
