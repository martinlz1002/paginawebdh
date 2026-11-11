# DHTime: recepción y entrega de kits

## Qué se agregó

- Configuración de mesas por rangos de `Bib` desde el panel administrativo.
- PIN compartido de 4 a 8 dígitos. Se guarda como hash scrypt + salt en `configuracionEntrega/active` y nunca se entrega al navegador.
- Acción **Marcar como encontrado** en `/buscar-competidor`. La Cloud Function valida el PIN, comprueba el rango y cambia el estado a `en_proceso`.
- Página pública `/entrega-kits?mesa=mesa-id`, con actualización en tiempo real y botón **Marcar como entregado**.
- Vista administrativa de estadísticas en tiempo real.
- Transacciones para impedir que dos operadores procesen o entreguen el mismo competidor.
- Proyección pública `publicCompetidores`, separada de los documentos privados `competidores`. La página pública de búsqueda consulta esta proyección.
- Protección al republicar: si hay entregas registradas, solicita confirmación antes de borrar el avance. Cada publicación nueva elimina la configuración anterior de mesas, por lo que debe configurarse nuevamente.

## Orden de uso

1. Publicar el Excel desde **Panel Admin → Buscar Competidor**.
2. Abrir **Panel Admin → Configurar mesas**.
3. Definir rangos sin traslapes que cubran todos los números `Bib` del Excel.
4. Establecer un PIN de 4 a 8 dígitos. Se recomienda usar 6 a 8.
5. Guardar. El servidor valida que todos los competidores tengan número válido y estén dentro de un rango.
6. Compartir el enlace `/buscar-competidor` con recepción y el enlace generado de cada mesa con su estación.
7. En recepción, ingresar el PIN y marcar al competidor como encontrado.
8. En la mesa asignada, ingresar el PIN y marcar el kit como entregado.
9. Consultar **Panel Admin → Control de entregas**.

## Despliegue

Desde la raíz del proyecto:

```bash
cd functions
npm install
npm run build
cd ..
firebase deploy --only functions,firestore:rules,firestore:indexes
```

Después compilar y desplegar el frontend usando el procedimiento que ya utiliza este proyecto.

## Estructura Firestore

- `busquedaCompetidor/active`: configuración pública del buscador (sin PIN ni hash).
- `busquedaCompetidor/active/competidores/{id}`: registro completo privado del competidor.
- `busquedaCompetidor/active/publicCompetidores/{id}`: proyección para búsqueda pública, con los campos seleccionados y el estado.
- `busquedaCompetidor/active/entregas/{id}`: datos mínimos que consume cada mesa y sus estados.
- `configuracionEntrega/active`: rangos, conteos por mesa y hash/salt del PIN. Solo administrador puede leerlo.

Las escrituras de estado se hacen desde Cloud Functions. Las estaciones no escriben directamente en Firestore.

## Seguridad y notas

- Las reglas nuevas permiten lectura pública únicamente del documento de configuración del buscador, la proyección `publicCompetidores` y los registros mínimos de `entregas`. Los documentos completos `competidores` siguen protegidos por las reglas generales de administrador.
- Los campos que el administrador seleccione como visibles se incluyen en la proyección pública. No selecciones correo o celular si no deseas que aparezcan públicamente.
- Si se cambia el PIN, los operadores deben usar el nuevo PIN. Los rangos quedan bloqueados para cambios una vez que exista al menos una entrega; sí se puede rotar el PIN sin cambiar rangos.
- Si se publica una lista nueva, hay que volver a configurar mesas y PIN.
- El ZIP original incluía `scripts/serviceAccountKey.json`. Este archivo se excluyó del paquete de salida. Si esa clave estuvo compartida, revócala en Google Cloud y genera otra si todavía la necesitas. También revisa los historiales Git donde pudiera haberse guardado.
