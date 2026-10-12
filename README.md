# App de préstamos de la biblioteca

Sitio estático sin paso de compilación: HTML, CSS y módulos ES nativos. Se publica
tal cual desde `docs/` con GitHub Pages. La base de datos es Cloud Firestore en
plan gratuito, y se entra con una cuenta de Google.

**Estado: Etapa 1 (base y acceso).** Catálogo, lectores, préstamos, recordatorios,
juego y estadísticas llegan en las etapas siguientes; sus pantallas dicen
«Disponible pronto».

La especificación manda sobre el código: `specs/00-contrato-operativo.md`,
`specs/00-base.md` y el documento de cada etapa. `referencia/prototipo.html` es
solo referencia visual y de textos.

## Qué necesitas

| Herramienta | Versión con la que se construyó y se probó |
|---|---|
| Node | 22.22.0 |
| npm | 10.9.4 |
| Java (para el emulador de Firestore) | OpenJDK 21 |
| Navegador | Chromium 141, que instala Playwright |

```bash
npm ci        # instala las versiones exactas del lockfile
```

## Correr la app en local

```bash
npm start
```

Levanta los emuladores de Authentication y Firestore con el proyecto
`demo-biblioteca`, inicializa la base demo y sirve `docs/` en
<http://127.0.0.1:5173>. Ctrl-C lo apaga todo.

En local **siempre** se usa el emulador: el contrato §1 fija que solo
`localhost`, `127.0.0.1` y `[::1]` lo seleccionan, y que `?ensayo=1` ahí se
ignora. Las configuraciones de ensayo y de producción viven en
`docs/js/config-publica.js` y hoy están en `null`: hasta que el dueño entregue
los bloques web, esos ambientes muestran «Falta configurar este ambiente» y no
abren ninguna conexión.

Parámetros útiles, solo contra el emulador:

| Parámetro | Para qué |
|---|---|
| `?ahora=2026-10-10T15:00:00-03:00` | Mueve el reloj de la **interfaz**. No mueve `request.time` del servidor. |
| `?ensayo=1` | Fuera de loopback elige el proyecto de ensayo y lo recuerda en la sesión. |

## Correr las pruebas

```bash
npm test                # todo, en orden
npm run revisar         # escáner del repositorio (datos, llaves, teléfonos)
npm run prueba:unidad   # funciones puras, con node --test
npm run prueba:reglas   # reglas de seguridad contra el emulador
npm run prueba:scripts  # scripts de administración contra el emulador
npm run prueba:e2e      # flujos completos con Playwright contra el emulador
npm run prueba:carga    # volumen y mediciones
```

Cada prueba automatizada lleva en su nombre el identificador del caso del
documento de la etapa (`A-01`, `A-18`, …), así se puede ir del informe al código.

Las pruebas de extremo a extremo necesitan que el navegador descargue el SDK de
Firebase desde `www.gstatic.com`. En una red que bloquee ese host, `prueba:e2e`
y `prueba:carga` no corren; las de unidad, reglas y scripts sí.

## Scripts de administración

```bash
# Prepara una base vacía: config/app, config/contadores, config/control
# y el primer administrador.
npx firebase emulators:exec --project demo-biblioteca --only auth,firestore \
  "node scripts/inicializar.mjs --correo tu@correo.cl --nombre 'Tu Nombre'"
```

El script se niega a escribir en un proyecto que no empiece con `demo-` salvo
que se le pase `--confirmo-proyecto-real`, y se niega a correr contra un
proyecto demo si no están definidos `FIRESTORE_EMULATOR_HOST` y
`FIREBASE_AUTH_EMULATOR_HOST`. Esa bandera la usa el dueño en su computador,
nunca el agente.

`scripts/revisar-repositorio.mjs` falla si encuentra versionado algo de
`datos/`, un archivo con forma de llave de servicio, o un teléfono chileno que
no sea de prueba. Los teléfonos ficticios de este proyecto empiezan con
`5690000`; ese prefijo **no** está acreditado como rango reservado y esos
números no se contactan.

## Qué va y qué no va al repositorio

El repositorio es público, porque así lo exige GitHub Pages gratuito. La carpeta
`datos/` está en `.gitignore` y ahí viven la carga real, los respaldos y las
llaves. Ningún nombre, teléfono ni préstamo real vive en el código ni en la
página publicada.

## Despliegue

Lo hace el dueño, con sus credenciales, siguiendo `PASOS-DEL-DUENO.md`. El
agente no despliega reglas ni índices, no toca proyectos reales y no fusiona a
`main`.

## Dónde está cada cosa

```
docs/          la app publicada
  js/          main, ambiente, firebase, acceso, datos, reloj, fechas, texto,
               vistas/ y ui/
firestore.rules
tests/         unidad/, reglas/, scripts/, e2e/, carga/, ayuda/, fixtures/
scripts/       inicializar, revisar-repositorio, servir, arrancar-local
specs/         la especificación; manda sobre el código
informes/      un informe por etapa
```
