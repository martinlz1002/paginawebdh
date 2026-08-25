import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import {
  equalTo,
  onValue,
  orderByChild,
  query,
  ref,
} from "firebase/database";
import { getDatabase } from "firebase/database";
import { app } from "../../lib/firebase";

type Punto = { latitud: number; longitud: number };
type PuntoMapa = Punto & { nombre: string };
type Tramo = { desde?: string; hasta?: string; puntosControl?: Record<string, Punto> | Punto[] };
type Ruta = {
  checkpoints?: Record<string, number>;
  puntosMapa?: Record<string, PuntoMapa>;
  orden?: Record<string, string>;
  recorrido?: { tramos?: Record<string, Tramo> };
};
type CheckpointReal = { punto: string; tiempoMs: number };
type CorredorBase = {
  competidor: string;
  competidorDisplay: string;
  nombre: string;
  categoria: string;
  distancia: string;
  team: string;
  checkpoints: CheckpointReal[];
};
type EstadoCorredor = CorredorBase & {
  posicion: number;
  x: number;
  y: number;
  progreso: number;
  distanciaRecorridaKm: number;
  puntoActual: string;
  siguientePunto: string;
  ritmoMsPorKm: number;
};
type TramoMetricos = Tramo & {
  id: string;
  puntos: Punto[];
  distanciaMetros: number;
  distanciaKm: number;
  distanciaAcumuladaInicioKm: number;
  distanciaAcumuladaFinKm: number;
};
type TramoSVG = {
  id: string;
  desde?: string;
  hasta?: string;
  puntos: { x: number; y: number }[];
  segmentos: { inicio: { x: number; y: number }; fin: { x: number; y: number }; longitud: number }[];
  longitudTotal: number;
};

export default function CarreraEnVivo() {
  const router = useRouter();
  const { id } = router.query;

  const [ruta, setRuta] = useState<Ruta | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [registrosPorCompetidor, setRegistrosPorCompetidor] = useState<Record<string, CheckpointReal[]>>({});
  const [competidoresInscritos, setCompetidoresInscritos] = useState<any[]>([]);
  const [crono, setCrono] = useState<{ isRunning: boolean; startTimeUTC: number; timeSwapBuff: number } | null>(null);
  const [tiempoActual, setTiempoActual] = useState(0);
  const [serverTimeOffset, setServerTimeOffset] = useState(0);
  const [bibBusqueda, setBibBusqueda] = useState("");
  const [distanciaSeleccionada, setDistanciaSeleccionada] =
  useState("");

const [distanciasDisponibles, setDistanciasDisponibles] =
  useState<string[]>([]);

  const [errorRuta, setErrorRuta] =
  useState("");

  const normalizarCompetidor = (valor: any) => {
    const texto = String(valor ?? "").trim();
    if (!texto) return "";
    if (/^\d+$/.test(texto)) return String(Number(texto));
    return texto.toUpperCase();
  };

  const formatearCompetidor = (valor: any) => {
    const texto = String(valor ?? "").trim();
    if (/^\d+$/.test(texto)) return texto.padStart(4, "0");
    return texto;
  };

  const normalizarPunto = (valor: any) => String(valor ?? "").trim().toUpperCase();

  const normalizarDistancia = (valor: any) =>
  String(valor ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");

    const formatearDistancia = (distancia: string) => {
  const valor = normalizarDistancia(distancia);

  if (!valor) return "";

  if (valor.endsWith("K")) {
    return `${valor.slice(0, -1)} km`;
  }

  return valor;
};


const distanciaKeyFirebase = (distancia: string) => {
  return String(distancia ?? "")
    .trim()
    .replace(/\./g, "_")
    .replace(/#/g, "_")
    .replace(/\$/g, "_")
    .replace(/\[/g, "_")
    .replace(/\]/g, "_")
    .replace(/\//g, "_");
};

  // REGISTROS: Firebase filtra por eventoId. El navegador ya no descarga
  // los registros de todas las carreras ni los reagrupa en cada render.
  useEffect(() => {
    if (!router.isReady || !id) return;
    const db = getDatabase(app);
    const registrosRef = query(ref(db, "registros"), orderByChild("eventoId"), equalTo(String(id).trim()));

    const unsubscribe = onValue(registrosRef, (snapshot) => {
      const data = snapshot.val() || {};
      const agrupados: Record<string, Record<string, CheckpointReal>> = {};

      for (const registro of Object.values(data) as any[]) {
        const competidor = normalizarCompetidor(registro?.competidor);
        const punto = normalizarPunto(registro?.punto);
        const tiempoMs = Number(registro?.tiempoMs ?? 0);
        if (!competidor || !punto || !Number.isFinite(tiempoMs) || tiempoMs < 0) continue;

        agrupados[competidor] ??= {};
        const anterior = agrupados[competidor][punto];
        if (!anterior || tiempoMs >= anterior.tiempoMs) {
          agrupados[competidor][punto] = { punto, tiempoMs };
        }
      }

      const resultado: Record<string, CheckpointReal[]> = {};
      for (const [competidor, porPunto] of Object.entries(agrupados)) {
        resultado[competidor] = Object.values(porPunto).sort((a, b) => a.tiempoMs - b.tiempoMs);
      }
      setRegistrosPorCompetidor(resultado);
    }, (err) => {
      console.error("Error cargando registros de carrera:", err);
      setRegistrosPorCompetidor({});
    });

    return () => unsubscribe();
  }, [router.isReady, id]);

  // ==========================================
// INSCRITOS
// ==========================================
// Cargamos TODOS los competidores del evento.
// La distancia se filtra localmente según
// distanciaSeleccionada.
// ==========================================

useEffect(() => {

  if (!router.isReady || !id) {
    return;
  }

  const db = getDatabase(app);

  const competidoresRef =
    ref(
      db,
      `eventos/${id}/competidores`
    );

  const unsubscribe =
    onValue(
      competidoresRef,
      (snapshot) => {

        if (!snapshot.exists()) {

          setCompetidoresInscritos([]);
          setDistanciasDisponibles([]);
          setDistanciaSeleccionada("");

          return;
        }

        const data =
          snapshot.val() || {};

        const lista =
          Object.entries(data).map(
            ([bib, valor]) => {

              const item =
                valor &&
                typeof valor === "object"
                  ? valor as Record<string, any>
                  : {};

              const distancia =
                normalizarDistancia(
                  item.distancia
                );

              return {
                ...item,
                competidor:
                  String(bib).trim(),
                distancia,
              };
            }
          );

        // ==========================================
        // DISTANCIAS DISPONIBLES
        // ==========================================

        const distancias =
          Array.from(
            new Set(
              lista
                .map(
                  (competidor) =>
                    competidor.distancia
                )
                .filter(Boolean)
            )
          ).sort(
            (a, b) => {

              const numeroA =
                parseFloat(
                  a.replace("K", "")
                );

              const numeroB =
                parseFloat(
                  b.replace("K", "")
                );

              if (
                Number.isFinite(numeroA) &&
                Number.isFinite(numeroB)
              ) {
                return numeroA - numeroB;
              }

              return a.localeCompare(b);
            }
          );

        setDistanciasDisponibles(
          distancias
        );

        // ==========================================
        // SELECCIÓN INICIAL
        // ==========================================

        setDistanciaSeleccionada(
          (actual) => {

            // Mantener la actual si todavía existe
            if (
              actual &&
              distancias.includes(actual)
            ) {
              return actual;
            }

            // Durante pruebas, preferir 10K
            if (
              distancias.includes("10K")
            ) {
              return "10K";
            }

            // Producción con una sola distancia
            return distancias[0] || "";
          }
        );

        // ==========================================
        // GUARDAMOS TODOS
        // ==========================================

        setCompetidoresInscritos(
          lista
        );
      },
      (err) => {

        console.error(
          "Error cargando competidores:",
          err
        );

        setCompetidoresInscritos([]);
        setDistanciasDisponibles([]);
      }
    );

  return () =>
    unsubscribe();

}, [
  router.isReady,
  id
]);


const competidoresDistancia =
  useMemo(() => {

    if (!distanciaSeleccionada) {
      return [];
    }

    return competidoresInscritos.filter(
      (competidor) =>
        normalizarDistancia(
          competidor.distancia
        ) === distanciaSeleccionada
    );

  }, [
    competidoresInscritos,
    distanciaSeleccionada
  ]);

  // CRONÓMETRO
  useEffect(() => {
    if (!router.isReady || !id) return;
    const db = getDatabase(app);
    const cronoRef = ref(db, `eventos/${id}/crono`);

    const unsubscribe = onValue(cronoRef, (snapshot) => {
      if (!snapshot.exists()) {
        setCrono(null);
        setTiempoActual(0);
        return;
      }
      const data = snapshot.val();
      setCrono({
        isRunning: Boolean(data.isRunning),
        startTimeUTC: Number(data.startTimeUTC),
        timeSwapBuff: Number(data.timeSwapBuff),
      });
    }, (err) => console.error("Error cargando cronómetro:", err));

    return () => unsubscribe();
  }, [router.isReady, id]);

  // HORA SERVIDOR
  useEffect(() => {
    if (!router.isReady) return;
    const db = getDatabase(app);
    const offsetRef = ref(db, ".info/serverTimeOffset");
    const unsubscribe = onValue(offsetRef, (snapshot) => {
      const offset = Number(snapshot.val());
      setServerTimeOffset(Number.isFinite(offset) ? offset : 0);
    });
    return () => unsubscribe();
  }, [router.isReady]);

  // RELOJ VISUAL: 100 ms, pero ya no dispara el cálculo de 3,000 corredores.
  useEffect(() => {
    if (!crono) {
      setTiempoActual(0);
      return;
    }

    const actualizarTiempo = () => {
      if (!crono.isRunning) {
        setTiempoActual(Math.max(0, crono.timeSwapBuff || 0));
        return;
      }
      const ahoraServidor = Date.now() + serverTimeOffset;
      const tiempo = (ahoraServidor - crono.startTimeUTC) + (crono.timeSwapBuff || 0);
      setTiempoActual(Math.max(0, tiempo));
    };

    actualizarTiempo();
    const intervalo = setInterval(actualizarTiempo, 100);
    return () => clearInterval(intervalo);
  }, [crono, serverTimeOffset]);

  // El ranking solo cambia una vez por segundo.
  const tiempoRanking = Math.floor(tiempoActual / 1000) * 1000;

  // POSICIONES BASE: solo cambia cuando cambia inscripción o un registro.
  const posicionesCorredores =
  useMemo<CorredorBase[]>(() => {

    return competidoresDistancia.map((inscrito) => {
      const competidor = normalizarCompetidor(inscrito.competidor);
      return {
        competidor,
        competidorDisplay: formatearCompetidor(inscrito.competidor),
        nombre: String(inscrito.nombre ?? ""),
        categoria: String(inscrito.categoria ?? ""),
        distancia: String(inscrito.distancia ?? "10K"),
        team: String(inscrito.team ?? ""),
        checkpoints: registrosPorCompetidor[competidor] || [],
      };
    });
  }, [competidoresDistancia,
  registrosPorCompetidor]);

  // ==========================================
// DISTANCIAS DISPONIBLES SEGÚN LAS RUTAS
// ==========================================

useEffect(() => {

  if (!router.isReady || !id) {
    return;
  }

  const db = getDatabase(app);

  const rutasRef = ref(
    db,
    `eventos/${id}/rutas`
  );

  const unsubscribe = onValue(
    rutasRef,
    (snapshot) => {

      if (!snapshot.exists()) {

        setDistanciasDisponibles([]);
        setDistanciaSeleccionada("");
        return;
      }

      const data = snapshot.val() || {};

      const distancias = Object.keys(data)
        .map((distancia) =>
          normalizarDistancia(distancia)
        )
        .filter(Boolean)
        .sort((a, b) => {

          const numeroA = parseFloat(
            a.replace("K", "")
          );

          const numeroB = parseFloat(
            b.replace("K", "")
          );

          if (
            Number.isFinite(numeroA) &&
            Number.isFinite(numeroB)
          ) {
            return numeroA - numeroB;
          }

          return a.localeCompare(b);
        });

      setDistanciasDisponibles(distancias);

      setDistanciaSeleccionada((actual) => {

        // Mantener la distancia actual
        // si todavía existe
        if (
          actual &&
          distancias.includes(actual)
        ) {
          return actual;
        }

        // Durante pruebas, preferir 10K
        if (
          distancias.includes("10K")
        ) {
          return "10K";
        }

        // Primera distancia disponible
        return distancias[0] || "";
      });

    },
    (err) => {

      console.error(
        "Error cargando rutas:",
        err
      );

      setDistanciasDisponibles([]);
      setDistanciaSeleccionada("");
    }
  );

  return () => unsubscribe();

}, [
  router.isReady,
  id
]);

// ==========================================
// CARGAR RUTA DE LA DISTANCIA SELECCIONADA
// ==========================================

useEffect(() => {

  if (
    !router.isReady ||
    !id ||
    !distanciaSeleccionada
  ) {
    return;
  }

  const db = getDatabase(app);

  const distanciaKey =
    distanciaKeyFirebase(
      distanciaSeleccionada
    );

  const rutaRef =
    ref(
      db,
      `eventos/${id}/rutas/${distanciaKey}`
    );

  setCargando(true);
  setRuta(null);
  setErrorRuta("");

  const unsubscribe =
    onValue(
      rutaRef,
      (snapshot) => {

        if (!snapshot.exists()) {

          setRuta(null);

          setErrorRuta(
            `No existe una ruta configurada para ${distanciaSeleccionada}.`
          );

          setCargando(false);

          return;
        }

        setRuta(
          snapshot.val()
        );

        setError("");
        setErrorRuta("");
        setCargando(false);
      },

      (err) => {

        console.error(
          "Error cargando ruta:",
          err
        );

        setRuta(null);

        setError(
          "No se pudo cargar la ruta."
        );

        setErrorRuta("");
        setCargando(false);
      }
    );

  return () =>
    unsubscribe();

}, [
  router.isReady,
  id,
  distanciaSeleccionada
]);


 // ==========================================
// OBTENER TRAMOS DEL RECORRIDO
// ==========================================

const tramosRecorrido = useMemo(() => {

  if (!ruta?.recorrido?.tramos) {
    return [];
  }

  const puntosMapa = ruta.puntosMapa || {};

  const orden = ruta.orden
    ? Object.values(ruta.orden)
    : [];


  // ==========================================
  // BUSCAR POSICIÓN DE UN CHECKPOINT
  // ==========================================

  const indiceCheckpoint = (nombre?: string) => {

    if (!nombre) {
      return 999999;
    }

    const indice = orden.findIndex(
      (x) =>
        x.trim().toUpperCase() ===
        nombre.trim().toUpperCase()
    );

    return indice === -1
      ? 999999
      : indice;
  };


  // ==========================================
  // OBTENER COORDENADA DE CHECKPOINT
  // ==========================================

  const obtenerPuntoMapa = (
    nombre?: string
  ): Punto | null => {

    if (!nombre) {
      return null;
    }

    const encontrado = Object.values(
      puntosMapa
    ).find(
      (punto) =>
        punto.nombre?.trim().toUpperCase() ===
        nombre.trim().toUpperCase()
    );

    if (
      !encontrado ||
      typeof encontrado.latitud !== "number" ||
      typeof encontrado.longitud !== "number"
    ) {
      return null;
    }

    return {
      latitud: encontrado.latitud,
      longitud: encontrado.longitud,
    };
  };


  // ==========================================
  // OBTENER TRAMOS
  // ==========================================

  const tramos = Object.entries(
    ruta.recorrido.tramos
  );


  // ==========================================
  // ORDENAR TRAMOS
  // ==========================================

  tramos.sort((a, b) => {

    const tramoA = a[1];
    const tramoB = b[1];

    return (
      indiceCheckpoint(tramoA.desde) -
      indiceCheckpoint(tramoB.desde)
    );

  });


  // ==========================================
  // CONSTRUIR CADA TRAMO
  // ==========================================

  const resultado: {
    id: string;
    desde?: string;
    hasta?: string;
    puntos: Punto[];
  }[] = [];


  for (const [idTramo, tramo] of tramos) {

    // ------------------------------------------
    // PUNTOS DE CONTROL
    // ------------------------------------------

    let controles: Punto[] = [];


    if (Array.isArray(tramo.puntosControl)) {

      controles = tramo.puntosControl;

    } else if (tramo.puntosControl) {

      controles = Object.entries(
        tramo.puntosControl
      )
        .sort(([a], [b]) => {

          return Number(a) - Number(b);

        })
        .map(([, punto]) => punto);

    }


    // ------------------------------------------
    // FILTRAR COORDENADAS INVÁLIDAS
    // ------------------------------------------

    controles = controles.filter(
      (punto) =>
        typeof punto?.latitud === "number" &&
        typeof punto?.longitud === "number"
    );


    // ------------------------------------------
    // COORDENADA DEL INICIO
    // ------------------------------------------

    const puntoInicio =
      obtenerPuntoMapa(tramo.desde);


    // ------------------------------------------
    // COORDENADA DEL FINAL
    // ------------------------------------------

    const puntoFinal =
      obtenerPuntoMapa(tramo.hasta);


    // ------------------------------------------
    // CONSTRUIR GEOMETRÍA COMPLETA
    //
    // INICIO
    //   ↓
    // PUNTOS DE CONTROL
    //   ↓
    // FINAL
    // ------------------------------------------

    const puntos: Punto[] = [];


    if (puntoInicio) {

      puntos.push(puntoInicio);

    }


    puntos.push(...controles);


    if (puntoFinal) {

      puntos.push(puntoFinal);

    }


    // ------------------------------------------
    // NECESITAMOS AL MENOS 2 PUNTOS
    // ------------------------------------------

    if (puntos.length < 2) {
      continue;
    }


    resultado.push({
      id: idTramo,
      desde: tramo.desde,
      hasta: tramo.hasta,
      puntos,
    });

  }


  return resultado;

}, [ruta]);


  // ==========================================
  // OBTENER CHECKPOINTS DEL MAPA
  // ==========================================

  const puntosMapa = useMemo(() => {

    if (!ruta?.puntosMapa) {
      return [];
    }

    return Object.values(
      ruta.puntosMapa
    ).filter(
      (punto) =>
        typeof punto.latitud === "number" &&
        typeof punto.longitud === "number"
    );

  }, [ruta]);


  // ==========================================
  // TRANSFORMAR GPS → SVG
  // ==========================================
  //
  // IMPORTANTE:
  //
  // NO vamos a juntar todos los puntos
  // en una sola lista.
  //
  // Cada tramo conserva su propia línea.
  //
  // Esto evita que SVG dibuje diagonales
  // entre el final de un tramo y el inicio
  // de otro tramo.
  //
  // ==========================================

  const mapa = useMemo(() => {

    if (
      tramosRecorrido.length === 0
    ) {

      return null;
    }


    // ==========================================
    // JUNTAR PUNTOS SOLAMENTE PARA CALCULAR
    // LOS LÍMITES DEL MAPA
    //
    // OJO:
    //
    // Esto NO significa que vayamos a dibujarlos
    // como una sola línea.
    // ==========================================

    const todosPuntos: Punto[] = [];


    for (
      const tramo of tramosRecorrido
    ) {

      todosPuntos.push(
        ...tramo.puntos
      );
    }


    todosPuntos.push(
      ...puntosMapa
    );


    // ==========================================
    // CALCULAR LÍMITES
    // ==========================================

    const latitudes =
      todosPuntos.map(
        (p) => p.latitud
      );

    const longitudes =
      todosPuntos.map(
        (p) => p.longitud
      );


    const minLat =
      Math.min(...latitudes);

    const maxLat =
      Math.max(...latitudes);

    const minLng =
      Math.min(...longitudes);

    const maxLng =
      Math.max(...longitudes);


    // ==========================================
    // TAMAÑO DEL SVG
    // ==========================================

    const ancho = 1000;
    const alto = 650;

    const margen = 60;


    // ==========================================
    // RANGOS
    // ==========================================

    const rangoLng =
      maxLng - minLng || 0.0001;

    const rangoLat =
      maxLat - minLat || 0.0001;


    // ==========================================
    // CONVERTIR GPS → COORDENADAS SVG
    // ==========================================

    const convertir = (
      punto: Punto
    ) => {

      const x =
        margen +
        (
          (punto.longitud - minLng) /
          rangoLng
        ) *
        (ancho - margen * 2);


      // ========================================
      // SVG CRECE HACIA ABAJO
      //
      // Por eso invertimos la latitud.
      // ========================================

      const y =
        alto -
        margen -
        (
          (punto.latitud - minLat) /
          rangoLat
        ) *
        (alto - margen * 2);


      return {
        x,
        y,
      };
    };


    // ==========================================
    // CONVERTIR CADA TRAMO POR SEPARADO
    // ==========================================

    const tramosSVG: TramoSVG[] =
      tramosRecorrido.map((tramo) => {
        const puntos = tramo.puntos.map(convertir);
        const segmentos: TramoSVG["segmentos"] = [];
        let longitudTotal = 0;

        for (let i = 0; i < puntos.length - 1; i++) {
          const inicio = puntos[i];
          const fin = puntos[i + 1];
          const dx = fin.x - inicio.x;
          const dy = fin.y - inicio.y;
          const longitud = Math.sqrt(dx * dx + dy * dy);
          segmentos.push({ inicio, fin, longitud });
          longitudTotal += longitud;
        }

        return {
          id: tramo.id,
          desde: tramo.desde,
          hasta: tramo.hasta,
          puntos,
          segmentos,
          longitudTotal,
        };
      });


    // ==========================================
    // CONVERTIR CHECKPOINTS
    // ==========================================

    const puntosMapaSVG =
      puntosMapa.map(
        (punto) => ({

          ...punto,

          ...convertir(punto),

        })
      );


    // ==========================================
    // DEVOLVER INFORMACIÓN DEL MAPA
    // ==========================================

    return {

      ancho,

      alto,

      tramosSVG,

      puntosMapaSVG,

    };

  }, [
    tramosRecorrido,
    puntosMapa,
  ]);



// ==========================================
// MOTOR DE MOVIMIENTO DE CORREDORES
// ==========================================
//
// 1. Todos los inscritos salen de META.
// 2. Ritmo inicial: 2:55 min/km.
// 3. Un checkpoint real coloca al corredor
//    inmediatamente en ese punto.
// 4. El ritmo del siguiente tramo se calcula con
//    el tiempo real / km reales del tramo anterior.
// 5. Si todavía no existe el siguiente registro,
//    se proyecta con ese ritmo.
// 6. Al llegar otro registro real, el cálculo se
//    vuelve a hacer desde cero.
//
// No se crean checkpoints falsos.
// ==========================================

const RITMO_INICIAL_MS_POR_KM =
  175000;

// ==========================================
// DISTANCIA GPS
// ==========================================

const distanciaGPS = (
  a: Punto,
  b: Punto
) => {

  const R = 6371000;

  const lat1 =
    a.latitud *
    Math.PI /
    180;

  const lat2 =
    b.latitud *
    Math.PI /
    180;

  const dLat =
    (b.latitud - a.latitud) *
    Math.PI /
    180;

  const dLng =
    (b.longitud - a.longitud) *
    Math.PI /
    180;

  const sinLat =
    Math.sin(dLat / 2);

  const sinLng =
    Math.sin(dLng / 2);

  const h =
    sinLat * sinLat +
    Math.cos(lat1) *
    Math.cos(lat2) *
    sinLng * sinLng;

  return (
    2 *
    R *
    Math.atan2(
      Math.sqrt(h),
      Math.sqrt(
        Math.max(
          0,
          1 - h
        )
      )
    )
  );
};

// ==========================================
// ==========================================
// MÉTRICAS REALES DE CADA TRAMO
// ==========================================
// Distancias acumuladas para evitar recorrer la ruta
// repetidamente durante el ranking.

const tramosMetricos = useMemo<TramoMetricos[]>(() => {
  let acumuladoKm = 0;

  return tramosRecorrido.map((tramo) => {
    let distanciaMetros = 0;

    for (let i = 0; i < tramo.puntos.length - 1; i++) {
      distanciaMetros += distanciaGPS(
        tramo.puntos[i],
        tramo.puntos[i + 1]
      );
    }

    const distanciaKm = distanciaMetros / 1000;
    const distanciaAcumuladaInicioKm = acumuladoKm;
    acumuladoKm += distanciaKm;

    return {
      ...tramo,
      distanciaMetros,
      distanciaKm,
      distanciaAcumuladaInicioKm,
      distanciaAcumuladaFinKm: acumuladoKm,
    };
  });
}, [tramosRecorrido]);

// POSICIÓN SOBRE LA GEOMETRÍA SVG
// ==========================================

const posicionSobreTramoSVG = (tramo: TramoSVG, progreso: number) => {
  const segmentos = tramo.segmentos;
  if (!segmentos || segmentos.length === 0) return tramo.puntos[0] || null;

  const progresoSeguro = Math.max(0, Math.min(1, progreso));
  const distanciaObjetivo = tramo.longitudTotal * progresoSeguro;
  let acumulado = 0;

  for (const segmento of segmentos) {
    const siguiente = acumulado + segmento.longitud;
    if (distanciaObjetivo <= siguiente) {
      const restante = distanciaObjetivo - acumulado;
      const porcentaje = segmento.longitud > 0 ? restante / segmento.longitud : 0;
      return {
        x: segmento.inicio.x + (segmento.fin.x - segmento.inicio.x) * porcentaje,
        y: segmento.inicio.y + (segmento.fin.y - segmento.inicio.y) * porcentaje,
      };
    }
    acumulado = siguiente;
  }

  return tramo.puntos[tramo.puntos.length - 1] || null;
};

// ==========================================
// TRAMO QUE EMPIEZA EN CADA CHECKPOINT
// ==========================================

const indiceTramoPorDesde = useMemo(() => {
  const resultado: Record<string, number> = {};
  tramosMetricos.forEach((tramo, index) => {
    const desde = normalizarPunto(tramo.desde);
    if (desde) resultado[desde] = index;
  });
  return resultado;
}, [tramosMetricos]);

// ==========================================
// DISTANCIA ENTRE CHECKPOINTS
// ==========================================
// Distancias acumuladas: consulta O(1).
// ==========================================

const distanciaEntrePuntos = (desdeNombre: string, hastaNombre: string) => {
  const desde = normalizarPunto(desdeNombre);
  const hasta = normalizarPunto(hastaNombre);
  const indiceInicio = desde === "META" ? 0 : indiceTramoPorDesde[desde];
  const indiceFin = indiceTramoPorDesde[hasta];

  if (indiceInicio === undefined || indiceFin === undefined || indiceFin <= indiceInicio) return 0;

  const inicio = tramosMetricos[indiceInicio];
  const fin = tramosMetricos[indiceFin - 1];
  if (!inicio || !fin) return 0;

  return fin.distanciaAcumuladaFinKm - inicio.distanciaAcumuladaInicioKm;
};

// ==========================================
// CALCULAR ESTADO DE UN CORREDOR
// ==========================================
// Conserva la lógica actual de movimiento, pero evita
// trabajo innecesario y puede ejecutarse tanto para el
// ranking como para un BIB individual.
// ==========================================

const calcularEstadoCorredor = (
  corredor: CorredorBase,
  ahora: number
): Omit<EstadoCorredor, "posicion" | keyof CorredorBase> | null => {
  if (!mapa || tramosMetricos.length === 0) return null;

  const checkpoints = corredor.checkpoints;

  // Ya están ordenados. Solo buscamos el último checkpoint ocurrido.
  let ultimoIndice = -1;
  for (let i = 0; i < checkpoints.length; i++) {
    if (checkpoints[i].tiempoMs <= ahora) ultimoIndice = i;
    else break;
  }

  let puntoAncla = "META";
  let tiempoAncla = 0;
  let segmentoInicio = 0;
  let ritmoMsPorKm = RITMO_INICIAL_MS_POR_KM;

  if (ultimoIndice >= 0) {
    const ultimo = checkpoints[ultimoIndice];
    puntoAncla = normalizarPunto(ultimo.punto);
    tiempoAncla = ultimo.tiempoMs;

    if (puntoAncla === "META") {
      segmentoInicio = 0;
    } else {
      const indice = indiceTramoPorDesde[puntoAncla];
      if (indice === undefined) return null;
      segmentoInicio = indice;
    }

    if (ultimoIndice === 0) {
      const distanciaReal = distanciaEntrePuntos("META", ultimo.punto);
      if (distanciaReal > 0 && ultimo.tiempoMs > 0) {
        ritmoMsPorKm = ultimo.tiempoMs / distanciaReal;
      }
    } else {
      const anterior = checkpoints[ultimoIndice - 1];
      const distanciaReal = distanciaEntrePuntos(anterior.punto, ultimo.punto);
      const tiempoReal = ultimo.tiempoMs - anterior.tiempoMs;
      if (distanciaReal > 0 && tiempoReal > 0) {
        ritmoMsPorKm = tiempoReal / distanciaReal;
      }
    }
  }

  if (!Number.isFinite(ritmoMsPorKm) || ritmoMsPorKm <= 0) {
    ritmoMsPorKm = RITMO_INICIAL_MS_POR_KM;
  }

  let tiempoDisponible = Math.max(0, ahora - tiempoAncla);
  let segmentoActual = segmentoInicio;
  let progreso = 0;
  let distanciaRecorridaKm =
    segmentoInicio > 0
      ? tramosMetricos[segmentoInicio]?.distanciaAcumuladaInicioKm || 0
      : 0;

  let posicionFinal: { x: number; y: number } | null = null;
  let puntoActual = puntoAncla;
  let siguientePunto = "";

  // Checkpoints confirmados desde el ancla.
  const checkpointsConfirmados = new Set<string>();
  for (let i = ultimoIndice; i >= 0; i--) {
    const checkpoint = checkpoints[i];
    if (checkpoint.tiempoMs < tiempoAncla) break;
    checkpointsConfirmados.add(normalizarPunto(checkpoint.punto));
  }

  while (segmentoActual < tramosMetricos.length) {
    const tramo = tramosMetricos[segmentoActual];
    const tramoSVG = mapa.tramosSVG[segmentoActual];
    if (!tramo || !tramoSVG || tramo.distanciaKm <= 0) return null;

    const duracionTramo = tramo.distanciaKm * ritmoMsPorKm;

    // Sigue dentro del tramo.
    if (tiempoDisponible < duracionTramo) {
      progreso = duracionTramo > 0 ? tiempoDisponible / duracionTramo : 0;
      progreso = Math.max(0, Math.min(1, progreso));
      const posicion = posicionSobreTramoSVG(tramoSVG, progreso);
      if (!posicion) return null;

      posicionFinal = posicion;
      puntoActual = normalizarPunto(tramo.desde);
      siguientePunto = normalizarPunto(tramo.hasta);
      distanciaRecorridaKm = tramo.distanciaAcumuladaInicioKm + tramo.distanciaKm * progreso;
      break;
    }

    // Llegó virtualmente al checkpoint. Se detiene aquí hasta que
    // exista el registro real, igual que el comportamiento actual.
    const nombrePuntoHasta = normalizarPunto(tramo.hasta);
    if (!checkpointsConfirmados.has(nombrePuntoHasta)) {
      const posicion = posicionSobreTramoSVG(tramoSVG, 1);
      if (!posicion) return null;

      posicionFinal = posicion;
      puntoActual = normalizarPunto(tramo.desde);
      siguientePunto = nombrePuntoHasta;
      progreso = 1;
      distanciaRecorridaKm = tramo.distanciaAcumuladaFinKm;
      break;
    }

    // El checkpoint ya fue registrado. Continúa al siguiente tramo.
    tiempoDisponible -= duracionTramo;
    segmentoActual++;

    if (segmentoActual >= tramosMetricos.length) {
      const metaSVG = mapa.puntosMapaSVG.find(
        (punto) => normalizarPunto(punto.nombre) === "META"
      );
      if (!metaSVG) return null;

      posicionFinal = { x: metaSVG.x, y: metaSVG.y };
      puntoActual = normalizarPunto(tramo.hasta);
      siguientePunto = "META";
      progreso = 1;
      distanciaRecorridaKm = tramo.distanciaAcumuladaFinKm;
      break;
    }
  }

  if (!posicionFinal) return null;

  return {
    x: posicionFinal.x,
    y: posicionFinal.y,
    progreso,
    distanciaRecorridaKm,
    puntoActual,
    siguientePunto,
    ritmoMsPorKm,
  };
};

// ==========================================
// RANKING
// ==========================================
// Solo se recalcula una vez por segundo.
// ==========================================

const rankingCorredores = useMemo(() => {
  if (!mapa || tramosMetricos.length === 0 || posicionesCorredores.length === 0) return [];

  const posiciones = posicionesCorredores.map((corredor) => {
    const estado = calcularEstadoCorredor(corredor, tiempoRanking);
    return estado ? { ...corredor, ...estado } : null;
  }).filter((corredor): corredor is NonNullable<typeof corredor> => corredor !== null);

  posiciones.sort((a, b) => {
    if (a.distanciaRecorridaKm !== b.distanciaRecorridaKm) {
      return b.distanciaRecorridaKm - a.distanciaRecorridaKm;
    }

    const tiempoA = a.checkpoints[a.checkpoints.length - 1]?.tiempoMs ?? 0;
    const tiempoB = b.checkpoints[b.checkpoints.length - 1]?.tiempoMs ?? 0;
    if (tiempoA !== tiempoB) return tiempoA - tiempoB;

    return String(a.competidorDisplay).localeCompare(
      String(b.competidorDisplay),
      undefined,
      { numeric: true }
    );
  });

  return posiciones.slice(0, 10);
}, [mapa, tramosMetricos, posicionesCorredores, tiempoRanking]);

// ==========================================
// CORREDORES VISIBLES
// ==========================================
// Sin BIB: solo los 10 del ranking.
// Con BIB: solo ese corredor.
// ==========================================

const corredoresSVG = useMemo<EstadoCorredor[]>(() => {
  if (!mapa || tramosMetricos.length === 0) return [];

  const bibNormalizado = normalizarCompetidor(bibBusqueda);
  const corredoresAProcesar = bibNormalizado
    ? posicionesCorredores.filter(
        (corredor) => normalizarCompetidor(corredor.competidor) === bibNormalizado
      )
    : rankingCorredores;

  const posiciones = corredoresAProcesar.map((corredor) => {
    const estado = calcularEstadoCorredor(corredor, tiempoActual);
    return estado ? { ...corredor, ...estado, posicion: 0 } : null;
  }).filter((corredor): corredor is EstadoCorredor => corredor !== null);

      return posiciones.map((corredor, index) => ({
    ...corredor,
    posicion: bibNormalizado ? 1 : index + 1,
  }));
}, [
  mapa,
  tramosMetricos,
  posicionesCorredores,
  rankingCorredores,
  tiempoActual,
  bibBusqueda,
]);

// ESTADOS
  // ==========================================

  if (cargando) {

    return (
      <main style={styles.cargando}>

        <div style={styles.spinner}></div>

        <h2>
          Cargando carrera...
        </h2>

        <p>
  Preparando el recorrido{" "}
  {distanciaSeleccionada}
</p>

      </main>
    );

  }


  if (error) {

    return (
      <main style={styles.error}>

        <h1>
          ⚠️
        </h1>

        <h2>
          No se pudo cargar la carrera
        </h2>

        <p>
          {error}
        </p>

      </main>
    );

  }


  return (
    <main style={styles.page}>


      {/* =====================================
          ENCABEZADO
      ====================================== */}

      <header style={styles.header}>

        <div>

          <div style={styles.subtitulo}>
            CARRERA EN VIVO
          </div>

        </div>


        <div style={styles.estado}>

          <span
            style={styles.puntoVivo}
          ></span>

          EN VIVO

        </div>

      </header>



{/* =====================================
    SELECTOR DE DISTANCIA
====================================== */}

<section
  style={{
    ...styles.info,
    marginTop: 16,
    marginBottom: 16,
    alignItems: "center",
  }}
>

  <div
    style={{
      flex: 1,
      minWidth: 220,
    }}
  >

    <span
      style={styles.etiqueta}
    >
      DISTANCIA A VISUALIZAR
    </span>

    <select
      value={distanciaSeleccionada}
      onChange={(e) =>
        setDistanciaSeleccionada(
          e.target.value
        )
      }
      disabled={
        distanciasDisponibles.length <= 1
      }
      style={{
        width: "100%",
        marginTop: 8,
        padding: "12px 14px",
        borderRadius: 12,
        border:
          "1px solid rgba(255,255,255,0.15)",
        background:
          "rgba(255,255,255,0.07)",
        color: "white",
        fontSize: 16,
        fontWeight: 800,
        outline: "none",
        cursor:
          distanciasDisponibles.length > 1
            ? "pointer"
            : "default",
      }}
    >

      {distanciasDisponibles.map(
        (distancia) => (
          <option
            key={distancia}
            value={distancia}
            style={{
              color: "#111827",
            }}
          >
            {formatearDistancia(
              distancia
            )}
          </option>
        )
      )}

    </select>

  </div>

</section>

{errorRuta && (
  <div
    style={{
      margin: "12px 25px 20px",
      padding: "14px 18px",
      borderRadius: 14,
      background:
        "rgba(245,158,11,0.10)",
      border:
        "1px solid rgba(245,158,11,0.25)",
      color: "#fbbf24",
      fontWeight: 700,
    }}
  >
    ⚠️ {errorRuta}
  </div>
)}


      {/* =====================================
          INFORMACIÓN DE LA CARRERA
      ====================================== */}

      <section style={styles.info}>

        <div>

          <span style={styles.etiqueta}>
            RUTA
          </span>

          <strong>
  {distanciaSeleccionada}
</strong>

        </div>


        <div>

          <span style={styles.etiqueta}>
            DISTANCIA
          </span>

          <strong>
  {formatearDistancia(
    distanciaSeleccionada
  )}
</strong>

        </div>


        <div>

          <span style={styles.etiqueta}>
            CHECKPOINTS
          </span>

          <strong>
            {puntosMapa.length}
          </strong>

        </div>


        <div>

          <span style={styles.etiqueta}>
  INSCRITOS {distanciaSeleccionada}
</span>

<strong>
  {competidoresDistancia.length}
</strong>

        </div>

      </section>



      {/* =====================================
          MAPA
      ====================================== */}

      <section style={styles.mapaContainer}>



        {/* =====================================
    BUSCADOR DE BIB
====================================== */}

<div
  style={{
    display: "flex",
    gap: 12,
    alignItems: "center",
    marginBottom: 20,
    flexWrap: "wrap",
  }}
>

  <div
    style={{
      flex: "1 1 300px",
      position: "relative",
    }}
  >

    <input
      type="text"
      inputMode="numeric"
      value={bibBusqueda}
      onChange={(e) =>
        setBibBusqueda(
          e.target.value
        )
      }
      placeholder="Buscar BIB..."
      style={{
        width: "100%",
        boxSizing: "border-box",
        padding: "16px 48px 16px 18px",
        borderRadius: 14,
        border:
          "1px solid rgba(255,255,255,0.12)",
        background:
          "rgba(255,255,255,0.07)",
        color: "white",
        fontSize: 17,
        fontWeight: 700,
        outline: "none",
      }}
    />

    {bibBusqueda && (
      <button
        type="button"
        onClick={() =>
          setBibBusqueda("")
        }
        style={{
          position: "absolute",
          right: 10,
          top: "50%",
          transform:
            "translateY(-50%)",
          width: 32,
          height: 32,
          borderRadius: "50%",
          border: "none",
          background:
            "rgba(255,255,255,0.12)",
          color: "white",
          cursor: "pointer",
          fontSize: 18,
          fontWeight: 900,
        }}
      >
        ×
      </button>
    )}

  </div>

  <div
    style={{
      fontSize: 13,
      opacity: 0.65,
      fontWeight: 700,
      whiteSpace: "nowrap",
    }}
  >
    {bibBusqueda
      ? `Mostrando BIB ${formatearCompetidor(
          bibBusqueda
        )}`
      : "TOP 10 EN PISTA"}
  </div>

</div>


{/* =====================================
    TOP 10
====================================== */}

{!bibBusqueda && (
  <div
    style={{
      marginBottom: 12,
      padding: "12px 14px",
      borderRadius: 18,
      background:
        "rgba(255,255,255,0.04)",
      border:
        "1px solid rgba(255,255,255,0.07)",
    }}
  >

    <div
      style={{
        fontSize: 12,
        letterSpacing: 2,
        fontWeight: 900,
        opacity: 0.55,
        marginBottom: 15,
      }}
    >
      TOP 10
    </div>

    <div
      style={{
        display: "grid",
        gridTemplateColumns:
  "repeat(10, minmax(0, 1fr))",
gap: 8,
      }}
    >

      {corredoresSVG.map(
        (corredor) => (
          <div
            key={
              `top-${corredor.competidor}`
            }
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding:
                "8px 10px",
              borderRadius: 14,
              background:
                "rgba(255,255,255,0.05)",
            }}
          >

            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background:
                  "#9EBC39",
                color: "#111827",
                fontWeight: 900,
              }}
            >
              {corredor.posicion}
            </div>

            <div>

              <div
                style={{
                  fontWeight: 900,
                  fontSize: 16,
                }}
              >
                #{corredor.competidor}
              </div>

              <div
                style={{
                  fontSize: 11,
                  opacity: 0.55,
                  marginTop: 2,
                }}
              >
                {corredor.puntoActual}
              </div>

            </div>

          </div>
        )
      )}

    </div>

  </div>
)}



        {/* =================================
            TÍTULO
        ================================== */}

        <div style={styles.mapaTitulo}>

          <div>

            <span
              style={styles.mapaTituloGrande}
            >
              RECORRIDO
            </span>

            <span
  style={styles.mapaTituloPequeno}
>
  Ruta {distanciaSeleccionada}
</span>

          </div>


          <div style={styles.mapaLeyenda}>

            <span>
              ● Checkpoint
            </span>

            <span>
              ● Recorrido
            </span>

          </div>

        </div>



        {/* =================================
            SVG
        ================================== */}

        <div style={styles.svgWrapper}>


          {mapa ? (

            <svg
              viewBox={`0 0 ${mapa.ancho} ${mapa.alto}`}
              preserveAspectRatio="xMidYMid meet"
              style={styles.svg}
            >


              {/* =================================
                  RECORRIDO
                  
                  IMPORTANTE:
                  
                  CADA TRAMO SE DIBUJA
                  DE FORMA INDEPENDIENTE.
                  
                  Esto evita que SVG conecte
                  automáticamente el final de
                  un tramo con el inicio del
                  siguiente.
              ================================== */}

              {mapa.tramosSVG.map(
                (tramo) => {

                  if (
                    tramo.puntos.length < 2
                  ) {
                    return null;
                  }


                  const puntos =
                    tramo.puntos
                      .map(
                        (p) =>
                          `${p.x},${p.y}`
                      )
                      .join(" ");


                  return (
                    <g
                      key={tramo.id}
                    >


                      {/* =================================
                          SOMBRA DEL TRAMO
                      ================================== */}

                      <polyline
                        points={puntos}
                        fill="none"
                        stroke="rgba(0,0,0,0.35)"
                        strokeWidth="20"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />


                      {/* =================================
                          RECORRIDO PRINCIPAL
                      ================================== */}

                      <polyline
                        points={puntos}
                        fill="none"
                        stroke="#7E57C2"
                        strokeWidth="12"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />

                    </g>
                  );

                }
              )}

              {/* =================================
    TOP 10 CORREDORES
================================= */}

{corredoresSVG.map(
  (corredor) => (

    <g
      key={`corredor-${corredor.competidor}`}
    >

      {/* =================================
          SOMBRA
      ================================= */}

      <circle
        cx={corredor.x}
        cy={corredor.y}
        r="30"
        fill="rgba(0,0,0,0.45)"
      />


      {/* =================================
          CÍRCULO DEL CORREDOR
      ================================= */}

      <circle
        cx={corredor.x}
        cy={corredor.y}
        r="24"
        fill="#ffffff"
        stroke="#9EBC39"
        strokeWidth="6"
      />


      {/* =================================
          CENTRO
      ================================= */}

      <circle
        cx={corredor.x}
        cy={corredor.y}
        r="10"
        fill="#9EBC39"
      />


      {/* =================================
          POSICIÓN
      ================================= */}

      <text
        x={corredor.x}
        y={corredor.y + 7}
        textAnchor="middle"
        fill="#111827"
        fontSize="14"
        fontWeight="900"
      >
        {corredor.posicion}
      </text>


      {/* =================================
          BIB
      ================================= */}

      <text
        x={corredor.x}
        y={corredor.y - 40}
        textAnchor="middle"
        fill="white"
        fontSize="18"
        fontWeight="900"
        style={{
          paintOrder: "stroke",
          stroke: "#111827",
          strokeWidth: 6,
        }}
      >
        #{corredor.competidor}
      </text>

    </g>

  )
)}



              {/* =================================
                  CHECKPOINTS
              ================================== */}

              {mapa.puntosMapaSVG.map(
                (punto, index) => (

                  <g
                    key={
                      `${punto.nombre}-${index}`
                    }
                  >


                    {/* =================================
                        CÍRCULO EXTERIOR
                    ================================== */}

                    <circle
                      cx={punto.x}
                      cy={punto.y}
                      r="20"
                      fill="white"
                      stroke="#7E57C2"
                      strokeWidth="5"
                    />


                    {/* =================================
                        PUNTO CENTRAL
                    ================================== */}

                    <circle
                      cx={punto.x}
                      cy={punto.y}
                      r="9"
                      fill="#7E57C2"
                    />


                    {/* =================================
                        NOMBRE DEL CHECKPOINT
                    ================================== */}

                    <text
                      x={punto.x}
                      y={punto.y - 30}
                      textAnchor="middle"
                      fill="white"
                      fontSize="20"
                      fontWeight="700"
                      style={{
                        paintOrder: "stroke",
                        stroke: "#111827",
                        strokeWidth: 5,
                      }}
                    >
                      {punto.nombre}
                    </text>

                  </g>

                )
              )}

            </svg>

          ) : (

            <div style={styles.sinMapa}>

              No hay datos suficientes para
              dibujar el recorrido.

            </div>

          )}

        </div>

      </section>

    </main>
  );
}


// =====================================================
// ESTILOS
// =====================================================

const styles: {
  [key: string]: React.CSSProperties;
} = {


  // ==========================================
  // PÁGINA
  // ==========================================

  page: {

    minHeight: "100vh",

    background:
      "radial-gradient(circle at top, #1f2937 0%, #0b1120 45%, #030712 100%)",

    color: "white",

    fontFamily:
      "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",

    paddingBottom: 60,

  },


  // ==========================================
  // ENCABEZADO
  // ==========================================

  header: {

    height: 90,

    display: "flex",

    alignItems: "center",

    justifyContent: "space-between",

    padding: "0 40px",

    borderBottom:
      "1px solid rgba(255,255,255,0.08)",

    background:
      "rgba(3,7,18,0.75)",

  },


  // ==========================================
  // LOGO
  // ==========================================

  logo: {

    fontSize: 30,

    fontWeight: 900,

    letterSpacing: 2,

  },


  // ==========================================
  // SUBTÍTULO
  // ==========================================

  subtitulo: {

    fontSize: 11,

    letterSpacing: 3,

    opacity: 0.55,

    marginTop: 2,

  },


  // ==========================================
  // ESTADO EN VIVO
  // ==========================================

  estado: {

    display: "flex",

    alignItems: "center",

    gap: 8,

    fontWeight: 800,

    fontSize: 14,

  },


  puntoVivo: {

    width: 10,

    height: 10,

    borderRadius: "50%",

    background: "#ef4444",

    boxShadow:
      "0 0 12px rgba(239,68,68,0.8)",

  },


  // ==========================================
  // INFORMACIÓN
  // ==========================================

  info: {
  display: "flex",
  gap: 40,
  padding: "14px 40px",
  background:
    "rgba(255,255,255,0.03)",
  borderBottom:
    "1px solid rgba(255,255,255,0.06)",
},


  etiqueta: {

    display: "block",

    fontSize: 10,

    letterSpacing: 2,

    opacity: 0.5,

    marginBottom: 5,

  },


  // ==========================================
  // CONTENEDOR DEL MAPA
  // ==========================================

  mapaContainer: {
  maxWidth: 1400,
  margin: "14px auto",
  padding: "0 25px",
},


  // ==========================================
  // TÍTULO DEL MAPA
  // ==========================================

  mapaTitulo: {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 8,
},


  mapaTituloGrande: {

    display: "block",

    fontSize: 20,

    fontWeight: 900,

    letterSpacing: 1,

  },


  mapaTituloPequeno: {

    display: "block",

    fontSize: 12,

    opacity: 0.5,

    marginTop: 3,

  },


  // ==========================================
  // LEYENDA
  // ==========================================

  mapaLeyenda: {

    display: "flex",

    gap: 20,

    fontSize: 12,

    opacity: 0.65,

  },


  // ==========================================
  // CONTENEDOR SVG
  // ==========================================

  svgWrapper: {

    width: "100%",

    borderRadius: 24,

    overflow: "hidden",

    background:
      "radial-gradient(circle, #182235 0%, #0b1220 70%)",

    border:
      "1px solid rgba(255,255,255,0.08)",

    boxShadow:
      "0 20px 60px rgba(0,0,0,0.4)",

  },


  // ==========================================
  // SVG
  // ==========================================

  svg: {
  width: "100%",
  height: "clamp(320px, 42vh, 400px)",
  display: "block",
  minHeight: 0,
},


  // ==========================================
  // CARGANDO
  // ==========================================

  cargando: {

    minHeight: "100vh",

    display: "flex",

    flexDirection: "column",

    justifyContent: "center",

    alignItems: "center",

    background: "#030712",

    color: "white",

    fontFamily: "Inter, sans-serif",

  },


  // ==========================================
  // SPINNER
  // ==========================================

  spinner: {

    width: 45,

    height: 45,

    borderRadius: "50%",

    border:
      "4px solid rgba(255,255,255,0.15)",

    borderTopColor: "#7E57C2",

    marginBottom: 20,

  },


  // ==========================================
  // ERROR
  // ==========================================

  error: {

    minHeight: "100vh",

    display: "flex",

    flexDirection: "column",

    justifyContent: "center",

    alignItems: "center",

    background: "#030712",

    color: "white",

    fontFamily: "Inter, sans-serif",

  },


  // ==========================================
  // SIN MAPA
  // ==========================================

  sinMapa: {

    minHeight: 500,

    display: "flex",

    justifyContent: "center",

    alignItems: "center",

    opacity: 0.5,

  },

};