"use client"

import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet"
import L from "leaflet"
import { useEffect, useMemo, useRef } from "react"
import "leaflet/dist/leaflet.css"

// Fix for default Leaflet icon paths in Next.js
if (typeof window !== 'undefined') {
    delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl
    L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
    })
}

interface MapComponentProps {
    lat: number
    lng: number
    onChange: (lat: number, lng: number) => void
}

interface MapViewProps extends MapComponentProps {
    /**
     * Nivel de zoom inicial. Lo decide el llamador con `resolveMapView()`: nivel
     * de calle cuando hay una ubicación real, vista de mundo cuando todavía no,
     * para que el usuario pueda navegar hasta su ciudad y soltar el pin.
     */
    zoom?: number
}

function DraggableMarker({ lat, lng, onChange }: MapComponentProps) {
    const eventHandlers = useMemo(() => ({
        dragend(event: L.LeafletEvent) {
            const marker = event.target as L.Marker
            const position = marker.getLatLng()
            onChange(position.lat, position.lng)
        },
    }), [onChange])

    return (
        <Marker
            draggable={true}
            eventHandlers={eventHandlers}
            position={[lat, lng]}
        />
    )
}

// Helper to update map view when props change
function ChangeView({ center, zoom }: { center: L.LatLngExpression; zoom: number }) {
    const map = useMap()
    const lastZoom = useRef(zoom)
    useEffect(() => {
        // Se preserva el zoom que el usuario haya elegido a mano; solo se fuerza
        // cuando el llamador lo cambia, que es el salto de "sin ubicación" (vista
        // de mundo) a una dirección ya resuelta (nivel de calle). Sin esto, quien
        // se acercaba para colocar el pin veía el mapa alejarse solo en cuanto
        // arrastraba, porque cada arrastre reescribe el centro.
        const nextZoom = zoom !== lastZoom.current ? zoom : map.getZoom()
        lastZoom.current = zoom
        map.setView(center, nextZoom)
    }, [center, zoom, map])
    return null
}

export default function MapComponent({ lat, lng, onChange, zoom = 15 }: MapViewProps) {
    const center = useMemo<L.LatLngExpression>(() => [lat, lng], [lat, lng])

    return (
        <MapContainer
            center={center}
            zoom={zoom}
            scrollWheelZoom={false}
            className="h-full w-full z-0"
        >
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <DraggableMarker lat={lat} lng={lng} onChange={onChange} />
            <ChangeView center={center} zoom={zoom} />
        </MapContainer>
    )
}
