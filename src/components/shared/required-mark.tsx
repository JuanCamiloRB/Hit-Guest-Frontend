/**
 * El asterisco de un campo obligatorio: visible y parte del nombre del campo
 * («Propiedad *»), en el rojo de error pero pequeño, para que no domine.
 */
export function RequiredMark() {
    return <span className="text-danger">*</span>
}
