"use client"

import type { ReactNode } from "react"
import { Building2, Cloud, Hotel, Network, RadioTower, RefreshCw } from "lucide-react"
import { KunasIntegrationPanel } from "./KunasIntegrationPanel"

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
    badgeClassName = "bg-violet-50 text-violet-600",
}: ProviderCardProps) {
    return (
        <article className="flex min-h-36 flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
            <div className="flex items-start justify-between gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-700">
                    {icon}
                </span>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${badgeClassName}`}>
                    {badge}
                </span>
            </div>
            <div className="mt-5">
                <h4 className="font-bold text-slate-900">{name}</h4>
                <p className="mt-1 text-sm leading-relaxed text-slate-500">{description}</p>
            </div>
        </article>
    )
}

function AirbnbIcon() {
    return (
        <svg viewBox="0 0 32 32" className="h-6 w-6 fill-[#FF5A5F]" aria-hidden="true">
            <path d="M16 1c2.008 0 3.463.963 4.751 3.269l.533 1.025c1.954 3.83 6.114 12.54 7.1 14.836l.145.353c.667 1.591.91 2.472.96 3.396l.01.415.001.228c0 4.062-2.877 6.478-6.357 6.478-2.224 0-4.556-1.258-6.709-3.386l-.257-.26-.172-.179h-.011l-.176.185c-2.044 2.1-4.392 3.415-6.7 3.415-3.477 0-6.32-2.316-6.32-6.275 0-1.12.247-2.19.782-3.666l.241-.634c.152-.416.323-.847.514-1.291l.244-.551A134.691 134.691 0 0 1 11.249 4.2C12.536 1.933 13.991 1 16 1zm0 2c-1.398 0-2.474.722-3.532 2.58l-.138.254c-1.574 2.924-4.62 9.294-5.913 12.01l-.226.49c-.198.442-.375.885-.53 1.328l-.206.574c-.546 1.503-.78 2.623-.73 3.49l.019.23c.029 2.91 2.112 4.301 4.32 4.301 1.761 0 3.655-1.115 5.421-2.923l.422-.444.17-.184h.015l.17.185.344.364c1.83 1.906 3.791 3.002 5.673 3.002 2.376 0 4.357-1.743 4.357-4.478l-.001-.19-.009-.32c-.046-.867-.282-1.688-.891-3.13l-.151-.365c-1-2.285-5.118-10.908-7.143-14.887l-.469-.902C18.526 3.723 17.404 3 16 3zm0 10c2.761 0 5 2.239 5 5 0 2.222-1.455 4.102-3.472 4.755l-.261.076-.267.069C16.66 23.109 16.335 23 16 23s-.66.109-1 .311V23l-.117-.021A5.006 5.006 0 0 1 11 18c0-2.761 2.239-5 5-5zm0 2c-1.657 0-3 1.343-3 3s1.343 3 3 3 3-1.343 3-3-1.343-3-3z" />
        </svg>
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
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--color-brand-purple)]/10 text-[var(--color-brand-purple)]">
                        <RefreshCw size={19} />
                    </span>
                    <div>
                        <div className="flex flex-wrap items-center gap-2">
                            <h3 id="pms-integrations" className="text-lg font-bold text-slate-900">
                                Con PMS
                            </h3>
                            <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-violet-600">
                                Conectividad Calry.app
                            </span>
                        </div>
                        <p className="mt-1 text-sm text-slate-500">
                            Sincroniza propiedades y reservas desde tu sistema de gestión.
                        </p>
                    </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <ProviderCard
                        name="Kunas PMS"
                        description="Sincroniza tus propiedades y reservas de Kunas."
                        icon={<Building2 className="h-6 w-6 text-[var(--color-brand-purple)]" />}
                        badge="Configurable"
                        badgeClassName="bg-emerald-50 text-emerald-600"
                    />
                    <ProviderCard
                        name="Guesty"
                        description="Conectividad PMS centralizada mediante Calry.app."
                        icon={<Hotel className="h-6 w-6 text-[#315CF5]" />}
                        badge="Calry.app"
                    />
                    <ProviderCard
                        name="CloudBeds"
                        description="Conectividad PMS centralizada mediante Calry.app."
                        icon={<Cloud className="h-6 w-6 text-[#1D9BF0]" />}
                        badge="Calry.app"
                    />
                    <ProviderCard
                        name="Otros PMS"
                        description="Conecta cualquiera de los demás PMS compatibles con el catálogo de Calry.app."
                        icon={<Network className="h-6 w-6 text-violet-600" />}
                        badge="Todos vía Calry.app"
                    />
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5 sm:p-6">
                    <div className="mb-5 flex items-center gap-3 border-b border-slate-200 pb-4">
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-[var(--color-brand-purple)] shadow-sm">
                            <Building2 size={17} />
                        </span>
                        <div>
                            <h4 className="font-bold text-slate-900">Configurar Kunas PMS</h4>
                            <p className="text-xs text-slate-500">Conexión disponible actualmente.</p>
                        </div>
                    </div>
                    <KunasIntegrationPanel />
                </div>
            </section>

            <section aria-labelledby="ota-integrations" className="space-y-5">
                <div className="flex items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                        <RadioTower size={19} />
                    </span>
                    <div>
                        <h3 id="ota-integrations" className="text-lg font-bold text-slate-900">
                            Con OTAs directas
                        </h3>
                        <p className="mt-1 text-sm text-slate-500">
                            Conecta directamente tus canales de venta para importar anuncios y reservas.
                        </p>
                    </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    <ProviderCard
                        name="Airbnb"
                        description="Importa tus anuncios y reservas directamente desde Airbnb."
                        icon={<AirbnbIcon />}
                        badge="Próximamente"
                        badgeClassName="bg-slate-100 text-slate-500"
                    />
                    <ProviderCard
                        name="Booking.com"
                        description="Importa tus alojamientos y reservas directamente desde Booking.com."
                        icon={<span className="text-2xl font-black leading-none text-[#003B95]">B.</span>}
                        badge="Próximamente"
                        badgeClassName="bg-slate-100 text-slate-500"
                    />
                </div>
            </section>
        </div>
    )
}
