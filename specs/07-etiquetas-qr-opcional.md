# Etapa 7 (opcional) — Etiquetas QR y escaneo

> Revisión 1.1 · 11-10-2026. Leer también `specs/00-contrato-operativo.md`; define los detalles comunes y las correcciones de esta revisión.


Esta etapa no es necesaria para usar la app. Se hace solo si el dueño la pide después de la etapa 6.

## Objetivo

Elegir un libro apuntándole con la cámara en vez de escribir su título.

## Entrega demostrable

El administrador imprime una hoja de etiquetas. En Prestar, un toque en «Escanear» abre la cámara, lee la etiqueta pegada en el libro y deja el libro elegido. En Inicio, escanear un libro prestado abre directamente su devolución.

## Alcance

1. Página de **etiquetas para imprimir**: una etiqueta por libro con el código QR, el código en texto y el título abreviado. Se eligen los libros por categoría o por rango de códigos.
2. Botón **Escanear** en Prestar y en Inicio.

## Fuera del alcance de esta etapa

Códigos de barras comerciales (ISBN). Etiquetas para lectores.

## Reglas

- El QR contiene solo el código del libro, por ejemplo `INF003`. Ningún dato personal.
- El escaneo comprueba `BarcodeDetector` y que `getSupportedFormats()` incluya `qr_code`; no decide por nombre de navegador. Si no está disponible o falla, usa una librería de lectura de QR copiada en `docs/vendor/`, con licencia abierta y versión fija. La generación del QR para imprimir usa otra librería copiada del mismo modo.
- La cámara se pide solo al tocar «Escanear» y se apaga al cerrar la hoja o al leer un código.
- Si el permiso de cámara se niega: «No hay permiso para usar la cámara. Busca el libro por título o código». El flujo sigue sin cámara.
- Un código leído que no existe en el catálogo: «Ese código no está en el catálogo». Un libro de baja: «Ese libro está dado de baja». Un QR con otro contenido, por ejemplo una dirección web: «Esa etiqueta no es de la biblioteca»; nunca se abre un enlace.
- En Inicio, escanear un libro con préstamo abierto abre la ficha de ese préstamo, con «Devolver»; escanear uno disponible abre Prestar con ese libro elegido.

## Índices

Ninguno. El escaneo y las etiquetas usan el catálogo que ya está en memoria.

## Casos de prueba

| ID | Situación | Resultado esperado |
|---|---|---|
| Q-01 | Escanear la etiqueta de un libro disponible en Prestar | El libro queda elegido |
| Q-02 | Escanear un libro prestado en Prestar | «Está prestado a (lector) hasta el (fecha)» |
| Q-03 | Escanear un libro prestado en Inicio | Se abre la ficha de su préstamo |
| Q-04 | Código inexistente, libro de baja, QR con una dirección web | Mensaje claro; nada se elige; no se abre ningún enlace |
| Q-05 | Permiso de cámara negado | Mensaje y flujo manual disponible |
| Q-06 | Navegador sin `BarcodeDetector` | Funciona con la librería de respaldo |
| Q-07 | Cerrar la hoja de escaneo | Las pistas de video quedan detenidas |
| Q-08 | Hoja de etiquetas de 150 libros | Se pagina en hojas tamaño carta sin cortar etiquetas entre páginas |
| Q-09 | Título de 120 caracteres en una etiqueta | Se abrevia con puntos suspensivos; el QR y el código quedan completos |
| Q-10 | (manual) En un teléfono Android real con una etiqueta impresa | Lee a 20 cm con luz de interior, y el indicador de cámara del teléfono desaparece al cerrar. Anotar el resultado |

### Casos adicionales de la revisión 1.1

| ID | Situación | Resultado esperado |
|---|---|---|
| Q-11 | Existe BarcodeDetector pero no soporta qr_code | Usa la librería de respaldo y mantiene la búsqueda manual |

## Carga y límites

- Generar la hoja de etiquetas de 5.000 libros: menos de 10 segundos, con aviso de avance, sin congelar la pantalla.
- El escaneo no produce lecturas a la base: resuelve el código contra el catálogo en memoria. Verificarlo con el contador de lecturas.

## Prueba de humo (la ejecuta el dueño)

1. Imprimir una hoja de etiquetas y pegar tres.
2. Prestar y devolver esos tres libros usando solo la cámara.

## Lista de entrega

- [ ] Librerías copiadas al repositorio, con sus licencias.
- [ ] `informes/etapa-7.md` con las pruebas manuales pendientes y lo que no está listo.
