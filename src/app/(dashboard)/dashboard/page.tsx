"use client"

import { mockDashboardReservations } from "@/features/reservations/data/mock-dashboard-data"
import { format } from "date-fns"
import { es } from "date-fns/locale"

export default function DashboardPage() {
    return (
        <div style={{ padding: "20px", fontFamily: "sans-serif" }}>
            <h1>Tablero de Operaciones</h1>
            <p>Gestión de reservas y automatizaciones activas</p>

            <hr />

            <div style={{ margin: "20px 0" }}>
                <h2>Métricas</h2>
                <ul style={{ listStyle: "none", padding: 0 }}>
                    <li><strong>CHECK-INS HOY:</strong> 4</li>
                    <li><strong>CHECK-OUTS HOY:</strong> 2</li>
                    <li><strong>PENDIENTES:</strong> 8</li>
                    <li><strong>INGRESOS (FEB):</strong> $14.5M COP</li>
                </ul>
            </div>

            <hr />

            <h2>Lista de Reservas</h2>
            <table border={1} cellPadding={10} style={{ borderCollapse: "collapse", width: "100%" }}>
                <thead>
                    <tr style={{ textAlign: "left" }}>
                        <th>Huésped</th>
                        <th>Alojamiento</th>
                        <th>Fechas</th>
                        <th>Origen</th>
                        <th>Estado</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    {mockDashboardReservations.map((res) => (
                        <tr key={res.id}>
                            <td>
                                <div>{res.guestName}</div>
                            </td>
                            <td>
                                <div>{res.propertyName}</div>
                                <small>{res.unitName}</small>
                            </td>
                            <td>
                                <div>{format(res.checkIn, "d MMM", { locale: es })} – {format(res.checkOut, "d MMM", { locale: es })}</div>
                                <small>{res.nights} noches</small>
                            </td>
                            <td>{res.source}</td>
                            <td>{res.status}</td>
                            <td>
                                <button onClick={() => alert(`ID: ${res.id}`)}>Ver detalles</button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}
