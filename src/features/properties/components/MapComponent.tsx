"use client"

import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet"
import L from "leaflet"
import { useState, useEffect, useMemo } from "react"
import "leaflet/dist/leaflet.css"

// Fix for default Leaflet icon paths in Next.js
if (typeof window !== 'undefined') {
    // @ts-ignore
    delete (L.Icon.Default.prototype as any)._getIconUrl
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

function DraggableMarker({ lat, lng, onChange }: MapComponentProps) {
    const [position, setPosition] = useState<L.LatLngExpression>([lat, lng])
    const map = useMap()

    useEffect(() => {
        setPosition([lat, lng])
    }, [lat, lng])

    const eventHandlers = useMemo(() => ({
        dragend(e: any) {
            const marker = e.target
            if (marker != null) {
                const pos = marker.getLatLng()
                setPosition(pos)
                onChange(pos.lat, pos.lng)
            }
        },
    }), [onChange])

    return (
        <Marker
            draggable={true}
            eventHandlers={eventHandlers}
            position={position}
        />
    )
}

// Helper to update map view when props change
function ChangeView({ center }: { center: L.LatLngExpression }) {
    const map = useMap()
    useEffect(() => {
        map.setView(center, map.getZoom())
    }, [center, map])
    return null
}

export default function MapComponent({ lat, lng, onChange }: MapComponentProps) {
    const center = useMemo<L.LatLngExpression>(() => [lat, lng], [lat, lng])

    return (
        <MapContainer
            center={center}
            zoom={15}
            scrollWheelZoom={false}
            className="h-full w-full z-0"
        >
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <DraggableMarker lat={lat} lng={lng} onChange={onChange} />
            <ChangeView center={center} />
        </MapContainer>
    )
}
