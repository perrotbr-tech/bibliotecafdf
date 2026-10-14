# Pasos que hace el dueño

Estas tareas no las puede hacer el agente: requieren tus cuentas y tus decisiones.

## Decisiones que conviene tomar antes de empezar

| Decisión | Lo que asumen las especificaciones | Dónde se cambia |
|---|---|---|
| Puntos del juego | 15 a tiempo, 10 en curso, 5 con atraso, 0 atrasado sin devolver | Etapa 5 |
| Pausa por atraso | Quien debe un libro no recibe medalla hasta devolverlo, también si el libro viene del Excel | Etapa 5 |
| Desde cuándo cuenta el juego | Desde la temporada en que se pone en marcha la app (`inicioJuego`) | Ajustes, etapa 6 |
| Empates | Comparten medalla; la biblioteca decide cómo premiar | Etapa 5 |
| Quién agrega libros | Solo el administrador | Etapa 2 |
| Renovar un préstamo | No existe: se devuelve y se presta de nuevo | Fuera de alcance |
| Sábado sin señal | Se anota en papel y se registra después; el administrador marca las devoluciones que fueron a tiempo | Etapa 3 |

## Para empezar localmente la Etapa 1

Abrir la carpeta en Cursor y usar LEEME-ARRANQUE-BIBLIOTECA.md. Se puede planificar y construir contra demo-biblioteca sin repositorio remoto, Firebase real ni Excel actualizado. Si falta remoto, el PR queda pendiente, no el trabajo local.

## Infraestructura — hecho el 13-10-2026

Esto ya está, no hay que repetirlo. Queda anotado porque la región y el modo de la base no se pueden cambiar después.

| Qué | Estado |
|---|---|
| Repositorio público `perrotbr-tech/bibliotecafdf` | creado |
| Proyecto de **ensayo**: `biblioteca-fdf-ensayo` | creado, plan Spark |
| Proyecto **real**: `biblioteca-fdf` | creado, plan Spark |
| Firestore en los dos | creada, edición Standard, base `(default)`, **modo producción**, **`southamerica-west1`** |
| Authentication con Google en los dos | habilitado, correo de asistencia `perrot.br@gmail.com` |
| Dominio `perrotbr-tech.github.io` autorizado en los dos | agregado |
| App web registrada en los dos | sin Firebase Hosting; se publica con GitHub Pages |
| Bloques web en `docs/js/config-publica.js` | puestos: `ensayo` y `produccion` |

Dos cosas que conviene saber de eso:

- Las reglas de los dos proyectos hoy dicen `allow read, write: if false`. Es lo correcto: la app no puede leer ni escribir nada hasta que despliegues `firestore.rules`. No lo arregles a mano en la consola.
- Los proyectos traen Google Analytics vinculado desde que se crearon. La app no lo carga, y el `measurementId` no está en el repositorio, así que no hay forma de que se active por descuido.

## Lo que sigue siendo tuyo

1. **Preparar credenciales administrativas solo en tu computador.** Usar credenciales locales autorizadas para Admin SDK; si se requiere una llave JSON, guardarla fuera del repositorio o dentro de datos/ excluida. Nunca pegarla en un chat, adjuntarla al paquete ni entregarla al agente para producción. Los scripts del agente solo usan el emulador y no requieren llaves.
2. **Un segundo destino de Pages de ensayo** si quieres probar el commit candidato antes de fusionar, según contrato §1. Nunca publicar `datos/` ni `referencia/` como app oficial.

## Las entregas que faltan

Las especificaciones siguen siendo siete documentos, pero se construyen agrupadas: menos entregas, cada una con un plan, un informe de una página y un PR.

| Entrega | Documentos | Estado |
|---|---|---|
| Base y acceso | `specs/01` | entregada, en contraprueba |
| Catálogo y lectores | `specs/02` | entregada, en contraprueba |
| Préstamos | `specs/03` + `specs/04` | por hacer |
| Juego y cierre | `specs/05` + `specs/06` | por hacer |
| QR | `specs/07` | opcional, solo si la pides |

## Después de cada entrega

1. Pasar la solicitud de cambios por una contraprueba externa. **Una sola.** Se repite únicamente si un hallazgo viene calificado «antes de producción»; los menores se corrigen y quedan declarados en el informe.
2. Desplegar reglas e índices en el proyecto de **ensayo** con el comando que indique el informe.
3. Fusionar la rama.

Desde la entrega **Préstamos** el despliegue deja de ser solo reglas: hay un índice compuesto real (`estado` + `prestadoEn` para Devueltos). Sin él, la vista Devueltos falla solo en el proyecto real (el emulador no lo exige). Comando:

```bash
firebase deploy --only firestore:rules,firestore:indexes --project biblioteca-fdf-ensayo
# y, cuando toque el real:
firebase deploy --only firestore:rules,firestore:indexes --project biblioteca-fdf
```

Espera a que el índice termine de construirse en la consola antes de probar Devueltos.

También hay que cargar el calendario de confianza antes del primer préstamo real:

```bash
node scripts/generar-calendario.mjs --desde 2025-01-01 --hasta 2028-12-31 \
  --proyecto biblioteca-fdf-ensayo --confirmo-proyecto-real
```

Las pruebas marcadas «(manual)» y las pruebas de humo de cada documento **no se hacen entrega por entrega**: se acumulan y se corren juntas, en una sesión con dos teléfonos reales sobre el proyecto de ensayo, antes de la carga de los datos reales. Esa carga ya estaba fijada para justo antes del primer sábado de uso, así que el ensayo cae en el momento correcto: cuando la app ya hace todo lo que se va a usar ese día. Recién ahí se despliegan reglas e índices en el proyecto **real**.

Una vez, cuando se fusione la primera entrega:

- **Activar GitHub Pages** desde la carpeta `docs/` de la rama `main`.
- Ejecutar `scripts/inicializar.mjs` en el proyecto real con tu correo, para quedar como primer administrador.

## Antes de cargar los datos reales (Etapa 2)

1. **Excel actualizado.** La versión original mencionaba el 12-09-2026 como último préstamo revisado; ese Excel no se adjuntó a esta revisión. Comprobar la fecha real del archivo actualizado y exportarlo con todos los sábados transcurridos.
2. **Confirmar los casos dudosos** con alguien de la biblioteca: devoluciones sin marcar, lectores que pueden ser la misma persona y libros con dos préstamos abiertos. El archivo de carga no admite un libro con dos préstamos abiertos, y cada libro que quede «sin devolver» deja a su lector en pausa en el juego.
3. Con eso se prepara `datos/carga.json`, ya depurado, en el formato que describe la Etapa 2.
4. Cargar: primero en modo simulación, luego la carga real.
5. **La carga definitiva se hace justo antes del primer sábado de uso real**, que será después de la Etapa 3. Hasta ese día la biblioteca sigue con el Excel; si cargaste antes para probar, rehaz la carga con `--reemplazar` usando el Excel de ese momento. Desde ese sábado el Excel deja de usarse.

## Cada semana

- Ejecutar `scripts/respaldar.mjs` después del sábado, verificando integridad según contrato §6; conservar una copia adicional fuera del computador. El plan gratuito no incluye el servicio de respaldos automáticos.
- Antes de agotar la cobertura del calendario, ampliarlo con el script de Etapa 3; el README debe indicar el último sábado disponible.

## Antes de que la usen los voluntarios

- Agregar a los voluntarios con sus correos de Google.
- Probar un sábado completo con dos teléfonos.
- Explicar el procedimiento para un sábado sin señal: anotar en papel y registrar después.
- Avisar a los lectores, al inscribirlos, que su nombre y su teléfono se usan solo para los préstamos de la biblioteca.
