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

## Antes del ensayo con teléfonos de la Etapa 1

1. **Crear el repositorio** en GitHub, público, y copiar dentro el contenido de este paquete. Para ensayar el commit candidato antes de fusionar, preparar un segundo destino de Pages de ensayo según contrato §1; nunca publicar datos/ ni referencia/ como app oficial.
2. **Crear dos proyectos de Firebase**, ambos gratuitos y separados de los de tus otras apps:
   - el **real**, donde vivirán los datos de la biblioteca;
   - el de **ensayo**, para probar cada etapa con teléfonos reales antes de tocar el real. El emulador que usa Cursor no detecta índices faltantes ni todos los límites; el proyecto de ensayo sí.
3. En cada proyecto, **crear la base Firestore** en modo de producción, no en modo de prueba. El modo de prueba deja la base abierta a cualquiera y sus reglas caducan después de un plazo, tras lo cual la app deja de funcionar sin aviso. Región: `southamerica-west1` (Santiago). La región no se puede cambiar después.
4. En cada proyecto, **activar el inicio de sesión con Google** en Authentication y **agregar el dominio de GitHub Pages** a los dominios autorizados (por ejemplo `tucuenta.github.io`).
5. **Registrar una app web** en cada proyecto. El bloque de configuración que muestra Firebase es público por diseño y puede ir en el repositorio; ambos bloques se le entregan a Cursor antes del ensayo correspondiente. No impiden desarrollar localmente. La app usa el proyecto de ensayo cuando la dirección lleva `?ensayo=1`.
6. **Preparar credenciales administrativas solo en tu computador.** Usar credenciales locales autorizadas para Admin SDK; si se requiere una llave JSON, guardarla fuera del repositorio o dentro de datos/ excluida. Nunca pegarla en un chat, adjuntarla al paquete ni entregarla al agente para producción. Los scripts del agente solo usan el emulador y no requieren llaves.

## Después de cada etapa

1. Pasar la solicitud de cambios por una contraprueba externa.
2. Desplegar reglas e índices en el proyecto de **ensayo** con el comando que indique el informe.
3. Ejecutar la **prueba de humo** que trae el documento de la etapa, con teléfonos reales.
4. Hacer las pruebas marcadas «(manual)».
5. Si todo pasa: fusionar la rama y desplegar reglas e índices en el proyecto **real**.

Además, después de la Etapa 1:

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
