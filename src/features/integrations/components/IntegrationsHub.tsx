"use client"

import { RefreshCw } from "lucide-react"
import { KunasIntegrationPanel } from "./KunasIntegrationPanel"

/**
 * Integrations hub — the Integraciones tab hosts SEVERAL integrations, not one.
 * Product naming (per backend/product): the client never picks a specific PMS —
 * the PMS section is a single "Conexión PMS" (today powered by Kunas; the Calry
 * aggregator will take over this same slot later), and "Conexión Airbnb" is next.
 * Adding a future integration = appending a section here.
 */
export function IntegrationsHub() {
    return (
        <div className="space-y-8">
            {/* ── Conexión PMS ── */}
            <section className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-brand-purple)]/10 text-[var(--color-brand-purple)]">
                            <RefreshCw size={18} />
                        </span>
                        <div>
                            <h3 className="font-bold text-slate-900 leading-tight">Conexión PMS</h3>
                            <p className="text-sm text-slate-500">
                                Sincroniza propiedades y reservas desde tu PMS.
                            </p>
                        </div>
                    </div>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-white p-5">
                    <KunasIntegrationPanel />
                </div>
            </section>

            {/* ── Conexión Airbnb ── */}
            <section className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FF5A5F]/10">
                            <svg viewBox="0 0 32 32" className="h-5 w-5 fill-[#FF5A5F]" aria-hidden>
                                <path d="M16 1c2.008 0 3.463.963 4.751 3.269l.533 1.025c1.954 3.83 6.114 12.54 7.1 14.836l.145.353c.667 1.591.91 2.472.96 3.396l.01.415.001.228c0 4.062-2.877 6.478-6.357 6.478-2.224 0-4.556-1.258-6.709-3.386l-.257-.26-.172-.179h-.011l-.176.185c-2.044 2.1-4.392 3.415-6.7 3.415-3.477 0-6.32-2.316-6.32-6.275 0-1.12.247-2.19.782-3.666l.241-.634c.152-.416.323-.847.514-1.291l.244-.551A134.691 134.691 0 0 1 11.249 4.2C12.536 1.933 13.991 1 16 1zm0 2c-1.398 0-2.474.722-3.532 2.58l-.138.254c-1.574 2.924-4.62 9.294-5.913 12.01l-.226.49c-.198.442-.375.885-.53 1.328l-.206.574c-.546 1.503-.78 2.623-.73 3.49l.019.23c.029 2.91 2.112 4.301 4.32 4.301 1.761 0 3.655-1.115 5.421-2.923l.422-.444.17-.184h.015l.17.185.344.364c1.83 1.906 3.791 3.002 5.673 3.002 2.376 0 4.357-1.743 4.357-4.478l-.001-.19-.009-.32c-.046-.867-.282-1.688-.891-3.13l-.151-.365c-1-2.285-5.118-10.908-7.143-14.887l-.469-.902C18.526 3.723 17.404 3 16 3zm0 10c2.761 0 5 2.239 5 5 0 2.222-1.455 4.102-3.472 4.755l-.261.076-.267.069C16.66 23.109 16.335 23 16 23s-.66.109-1 .311V23l-.117-.021A5.006 5.006 0 0 1 11 18c0-2.761 2.239-5 5-5zm0 2c-1.657 0-3 1.343-3 3s1.343 3 3 3 3-1.343 3-3-1.343-3-3-3z" />
                            </svg>
                        </span>
                        <div>
                            <h3 className="font-bold text-slate-900 leading-tight">Conexión Airbnb</h3>
                            <p className="text-sm text-slate-500">
                                Conecta tu cuenta de Airbnb para importar tus anuncios y reservas.
                            </p>
                        </div>
                    </div>
                    <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                        Próximamente
                    </span>
                </div>
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center">
                    <p className="text-sm text-slate-400">
                        Esta integración estará disponible pronto.
                    </p>
                </div>
            </section>
        </div>
    )
}
