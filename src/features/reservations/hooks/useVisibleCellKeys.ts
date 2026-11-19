"use client"

import { useMemo } from "react"
import { visibleCellKeys, type CellKey } from "../lib/automation-cells"

type Rows = Parameters<typeof visibleCellKeys>[1]

/**
 * `visibleCellKeys` con identidad ESTABLE: las filas cambian con cada estado
 * que llega, pero las columnas de la tabla solo deben rehacerse cuando el
 * conjunto de claves cambia de verdad (la tabla recalcula su modelo con cada
 * `columns` nuevo). La firma en texto es la dependencia del memo; comparar
 * arreglos en un ref durante el render lo prohíbe `react-hooks/refs`.
 */
export function useVisibleCellKeys(accountSlugs: ReadonlySet<string> | null | undefined, rows: Rows): CellKey[] {
    const signature = visibleCellKeys(accountSlugs, rows).join(",")
    return useMemo(() => (signature ? (signature.split(",") as CellKey[]) : []), [signature])
}
