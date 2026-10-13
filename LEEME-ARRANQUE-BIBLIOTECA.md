# Biblioteca — cómo seguimos

Revisión 1.1 · 11-10-2026, hora de Chile.

## Decisión

**Construir en Cursor y contraprobar en Codex.** Conserva el flujo del proyecto y permite ejecutar emuladores, pruebas y Git en el computador donde Eduardo trabaja. La elección es de organización y trazabilidad; no supone que una herramienta sea incapaz de construir la app. Si se cambia el implementador a Codex, se conservan las mismas reglas de AGENTS.md y un revisor separado.

Este paquete contiene especificaciones corregidas, el prototipo de referencia y datos de ensayo. No contiene todavía la app oficial, el repositorio remoto creado ni proyectos Firebase configurados.

## Qué se resolvió

- Hora del servidor sin alternativa al reloj desconfigurado del teléfono.
- Préstamos normales exclusivamente en sábado; transcripción administrativa desde papel con fecha efectiva y motivo.
- Validación de sábados y vencimientos mediante calendario de confianza, sin Cloud Functions.
- Confirmación por identidad de operación y correlativos enlazados; existencia del documento no equivale a éxito.
- Devoluciones que calculan puntualidad con el timestamp definitivo del servidor.
- Cierre consistente, fotografía sin recortar empatados, unión reanudable y protección de alias.
- Respaldo con mantenimiento, hash y restauración verificable; límites de confianza y cuota declarados.
- Ensayo del commit antes de fusionar y posibilidad de empezar localmente sin Firebase real.

No se cambian los puntos 15/10/5/0, la pausa por atraso, las medallas compartidas, el administrador como responsable de libros ni la ausencia de renovación.

## Plan concreto de Etapa 1

1. Leer reglas y confirmar las versiones compatibles de Node, Java y herramientas. Revisar el prototipo como referencia.
2. Preparar rama `etapa-1`, andamiaje, lockfile, emuladores demo y comprobador del repositorio. Si existe trabajo previo, inspeccionarlo y conservarlo.
3. Escribir pruebas de permisos, ambientes, reloj, control, intentos de guardado y recuperación. Todos los casos A-01 a A-40; A-31 es manual.
4. Implementar configuración cerrada por ambiente, acceso Google, navegación vacía, pantalla Voluntarios, reloj y datos.js.
5. Probar reglas, unidad, E2E y volumen local. Medir y documentar; no usar una pantalla de demostración para declarar pruebas aprobadas.
6. Entregar commits, informe y PR si hay remoto. Codex contraprueba el SHA; después Eduardo publica el candidato en ensayo y prueba teléfonos.

### Archivos de implementación previstos

| Grupo | Archivos |
|---|---|
| Configuración | package.json, package-lock.json, firebase.json, firestore.rules, firestore.indexes.json, .gitignore, configuración de Playwright |
| App | docs/index.html, docs/manifest.json, docs/iconos/, docs/css/app.css |
| Módulos | docs/js/main.js, config-publica.js, firebase.js, acceso.js, datos.js, reloj.js, texto.js; vistas/ y ui/ necesarios para Etapa 1 |
| Pruebas | tests/unidad/, tests/reglas/, tests/e2e/, tests/carga/ correspondientes a Etapa 1 |
| Administración | scripts/inicializar.mjs y scripts/revisar-repositorio.mjs |
| Entrega | .github/workflows/pruebas.yml, README.md, informes/etapa-1.md |

No implementar aún las pantallas de libros, lectores, préstamos, juego o QR. El contrato define sus dependencias para no construir una base incompatible.

## Qué hace Eduardo ahora

1. Descargar y extraer el ZIP actualizado.
2. Abrir en Cursor la carpeta `biblioteca-app` que contiene AGENTS.md, specs/ y referencia/.
3. Pegar el comando de abajo. Cursor debe devolver el plan ajustado al entorno real.
4. Aprobar ese plan para que comience a programar la Etapa 1.

El requisito de aprobación del plan viene de PROMPT-MAESTRO-CURSOR.md del paquete original. Se conserva. La autorización para corregir esta especificación no se presenta como aprobación de un plan de implementación que aún no ha sido contrastado con tu computador.

## Comando para pegar en Cursor

```text
Prepara el arranque de la Etapa 1 de biblioteca-app, revisión 1.1.

Lee AGENTS.md, PROMPT-MAESTRO-CURSOR.md, specs/00-contrato-operativo.md,
specs/00-base.md y specs/01-base-y-acceso.md completos.
Revisa referencia/prototipo.html solo como referencia visual y de textos.

Inspecciona el repositorio y el entorno local sin modificar trabajo ajeno.
Comprueba Git, Node, Java y la posibilidad de instalar y ejecutar Firebase
Emulator Suite y Playwright con versiones fijadas.

Devuélveme un plan concreto, los archivos que crearás o modificarás y cualquier
contradicción o limitación comprobada. Usa como base LEEME-ARRANQUE-BIBLIOTECA.md.
No escribas código de la etapa hasta que apruebe el plan.

Trabajaremos en etapa-1 y exclusivamente con demo-biblioteca.
La configuración de producción y ensayo puede permanecer en null.
No pidas llaves privadas ni bloquees el trabajo local por falta de Firebase real.
Si falta remoto, entrega commits locales y señala el PR como pendiente.
No despliegues, no fusiones y no empujes a main.

Al construir, cubrirás A-01 a A-40, separando A-31 manual; incluirás unidad,
reglas y E2E, pruebas de red, concurrencia, reloj y entorno, mediciones y el informe
de ocho apartados en informes/etapa-1.md. La contraprueba la hará Codex sobre el SHA
entregado. No inicies la Etapa 2.
```

## Preparaciones necesarias para el ensayo, no para comenzar localmente

| Elemento | Momento | Estado de esta entrega |
|---|---|---|
| Repositorio principal público y remoto | Antes de entregar PR/publicar | No creado ni verificado; sugerencia de nombre: biblioteca-app |
| Destino separado de GitHub Pages para ensayo | Antes de ensayar candidato en teléfonos | No creado; sugerencia: biblioteca-app-ensayo |
| Firebase real y ensayo con Firestore y Google Auth | Antes de usar cada ambiente remoto | No creados ni verificados |
| Configuraciones web públicas | Antes del ensayo remoto correspondiente | No recibidas; nunca sustituir por secretos |
| Credenciales administrativas locales del dueño | Antes de inicializar/cargar/desplegar | Solo en su computador; no requeridas por el agente en demo |
| Excel actualizado y dudas resueltas | Antes de carga definitiva, tras Etapa 3 | No recibido ni revisado en esta entrega |
| Pruebas en Android/iPhone, app instalada y WhatsApp | En las etapas indicadas | Pendientes de implementación y dispositivos |

Una página que aún no supera la Etapa 3 no se usa para llevar los préstamos reales. Se mantiene el Excel hasta la carga definitiva y el primer sábado aprobado.

## Cómo pedir la contraprueba a Codex

Entregar enlace de PR o ZIP del código, SHA exacto e informes/etapa-1.md:

```text
Contraprueba la Etapa 1 de biblioteca-app, revisión 1.1, en el SHA que adjunto.
Actúa como revisor separado del implementador. Lee AGENTS.md, contrato operativo,
base y Etapa 1. No modifiques la rama ni despliegues nada.
Ejecuta las pruebas posibles contra demo-biblioteca y busca escenarios adversos
de permisos, reloj, concurrencia, falta de red e identidad de operaciones.
Por cada hallazgo entrega gravedad, archivo, reproducción y criterio de corrección.
Separa pruebas ejecutadas, comprobaciones estáticas y pendientes manuales.
No apruebes por el reporte del implementador sin comprobar su evidencia.
```
