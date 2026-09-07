import { useRouter } from "next/router";
import { useEffect, useMemo, useRef, useState } from "react";
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
  datosInscripcion?: Record<string, any>;
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
type TramoGoogle = {
  id: string;
  desde?: string;
  hasta?: string;
  puntos: Punto[];
  segmentos: { inicio: Punto; fin: Punto; longitud: number }[];
  longitudTotal: number;
  fuente: "google" | "configurada";
};

// Google Maps se carga dinámicamente para no romper SSR de Next.js.
//
// No dependemos de google.maps.importLibrary(). En este proyecto usamos
// la carga directa de Maps JS solicitando explícitamente las librerías
// Routes y Marker. Esto evita el problema de compatibilidad que aparece
// cuando existe una instancia previa de Google Maps sin importLibrary().
let googleMapsPromise: Promise<any> | null = null;

const cargarGoogleMaps = (): Promise<any> => {
  if (typeof window === "undefined") {
    return Promise.reject(
      new Error("Google Maps solo puede cargarse en el navegador.")
    );
  }

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return Promise.reject(
      new Error(
        "Falta NEXT_PUBLIC_GOOGLE_MAPS_API_KEY en las variables de entorno."
      )
    );
  }

  const googleMapsListo = () => {
    const g = (window as any).google;
    return !!(
      g?.maps?.Map &&
      g?.maps?.Polyline &&
      g?.maps?.LatLngBounds &&
      g?.maps?.routes?.Route &&
      g?.maps?.marker?.AdvancedMarkerElement &&
      g?.maps?.marker?.PinElement
    );
  };

  if (googleMapsListo()) {
    return Promise.resolve((window as any).google);
  }

  if (googleMapsPromise) return googleMapsPromise;

  googleMapsPromise = new Promise((resolve, reject) => {
    let terminado = false;

    const resolver = () => {
      if (terminado) return;
      if (googleMapsListo()) {
        terminado = true;
        resolve((window as any).google);
      }
    };

    const rechazar = (mensaje: string) => {
      if (terminado) return;
      terminado = true;
      reject(new Error(mensaje));
    };

    // Si otro componente ya cargó Google Maps, no intentamos cargarlo otra vez.
    // Esperamos a que la instancia existente termine de inicializarse.
    const existente = document.querySelector<HTMLScriptElement>(
      'script[src*="maps.googleapis.com/maps/api/js"]'
    );

    if (existente) {
      let intentos = 0;
      const revisarExistente = () => {
        if (googleMapsListo()) {
          resolver();
          return;
        }

        if (++intentos >= 100) {
          rechazar(
            "Google Maps ya estaba cargado, pero la instancia existente no contiene Routes/Marker."
          );
          return;
        }

        window.setTimeout(revisarExistente, 100);
      };

      revisarExistente();
      return;
    }

    // Con loading=async, el evento load del <script> NO es la señal de que
    // Maps terminó de cargar. Google recomienda callback=... para eso.
    const callbackName = `__dhtimeGoogleMapsReady_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2)}`;

    (window as any)[callbackName] = () => {
      // El callback se ejecuta cuando la carga de Maps terminó completamente.
      // Damos un tick para que las librerías queden expuestas en google.maps.
      window.setTimeout(() => {
        if (googleMapsListo()) {
          resolver();
        } else {
          rechazar(
            "Google Maps terminó de cargar, pero Routes/Marker no están disponibles."
          );
        }

        try {
          delete (window as any)[callbackName];
        } catch {
          (window as any)[callbackName] = undefined;
        }
      }, 0);
    };

    const script = document.createElement("script");
    const parametros = new URLSearchParams({
      key: apiKey,
      v: "weekly",
      loading: "async",
      libraries: "maps,routes,marker",
      callback: callbackName,
    });

    script.src =
      `https://maps.googleapis.com/maps/api/js?${parametros.toString()}`;
    script.async = true;
    script.defer = true;
    script.dataset.dhtimeGoogleMaps = "true";

    script.onerror = () => {
      rechazar("No se pudo cargar Google Maps.");
    };

    document.head.appendChild(script);
  });

  googleMapsPromise.catch(() => {
    googleMapsPromise = null;
  });

  return googleMapsPromise;
};

const construirTramoVisual = (
  id: string,
  desde: string | undefined,
  hasta: string | undefined,
  puntos: Punto[],
  fuente: "google" | "configurada"
): TramoGoogle => {
  const segmentos: TramoGoogle["segmentos"] = [];
  let longitudTotal = 0;

  for (let i = 0; i < puntos.length - 1; i++) {
    const inicio = puntos[i];
    const fin = puntos[i + 1];
    const longitud = distanciaGPSGlobal(inicio, fin);
    segmentos.push({ inicio, fin, longitud });
    longitudTotal += longitud;
  }

  return { id, desde, hasta, puntos, segmentos, longitudTotal, fuente };
};

const distanciaGPSGlobal = (a: Punto, b: Punto) => {
  const R = 6371000;
  const lat1 = (a.latitud * Math.PI) / 180;
  const lat2 = (b.latitud * Math.PI) / 180;
  const dLat = ((b.latitud - a.latitud) * Math.PI) / 180;
  const dLng = ((b.longitud - a.longitud) * Math.PI) / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
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
  const [competidorHover, setCompetidorHover] = useState<EstadoCorredor | null>(null);
  const [distanciaSeleccionada, setDistanciaSeleccionada] =
  useState("");

  const [eventoIdReal, setEventoIdReal] = useState<string | null>(null);
  const [nombreEvento, setNombreEvento] = useState("");

const [distanciasDisponibles, setDistanciasDisponibles] =
  useState<string[]>([]);

  const [errorRuta, setErrorRuta] =
  useState("");

  // ==========================================
  // GOOGLE MAPS
  // ==========================================
  const [googleListo, setGoogleListo] = useState(false);
  const [tramosGoogle, setTramosGoogle] = useState<TramoGoogle[]>([]);
  const [errorGoogleMaps, setErrorGoogleMaps] = useState("");

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
    .replace(/\s+/g, "")
    .replace(/_/g, ".");

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

useEffect(() => {
  if (!router.isReady || !id) return;

  const db = getDatabase(app);
  const eventosRef = ref(db, "eventos");

  const unsubscribe = onValue(eventosRef, (snapshot) => {
    if (!snapshot.exists()) {
      setEventoIdReal(null);
      return;
    }

    const eventos = snapshot.val() || {};

    const slug = String(id)
      .trim()
      .toLowerCase();

    const encontrado = Object.entries(eventos).find(
      ([eventoId, evento]: [string, any]) => {

        const nombre = String(
          evento?.nombre ?? ""
        )
          .trim()
          .toLowerCase();

        const nombreSlug = nombre
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, "_")
          .replace(/^_+|_+$/g, "");

        return (
          eventoId === String(id).trim() ||
          nombreSlug === slug
        );
      }
    );

    if (encontrado) {
      setEventoIdReal(encontrado[0]);
      setNombreEvento(String((encontrado[1] as any)?.nombre ?? "").trim());
    } else {
      setEventoIdReal(null);
      console.error(
        "No se encontró el evento para:",
        id
      );
    }
  });

  return () => unsubscribe();
}, [router.isReady, id]);

  // REGISTROS: Firebase filtra por eventoId. El navegador ya no descarga
  // los registros de todas las carreras ni los reagrupa en cada render.
  useEffect(() => {
    if (!router.isReady || !eventoIdReal) return;
    const db = getDatabase(app);
    const registrosRef = query(ref(db, "registros"), orderByChild("eventoId"), equalTo(eventoIdReal));
    
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
  }, [router.isReady, eventoIdReal]);

  // ==========================================
// INSCRITOS
// ==========================================
// Cargamos TODOS los competidores del evento.
// La distancia se filtra localmente según
// distanciaSeleccionada.
// ==========================================

useEffect(() => {

  if (!router.isReady || !eventoIdReal) return;

const db = getDatabase(app);

const competidoresRef = ref(
  db,
  `eventos/${eventoIdReal}/competidores`
);

  const unsubscribe =
    onValue(
      competidoresRef,
      (snapshot) => {

        // ==========================================
        // SI NO HAY COMPETIDORES
        // ==========================================

        if (!snapshot.exists()) {

          setCompetidoresInscritos([]);

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
        // GUARDAMOS TODOS LOS COMPETIDORES
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
      }
    );

  return () =>
    unsubscribe();

}, [
  router.isReady,
  eventoIdReal
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
    if (!router.isReady || !eventoIdReal) return;
    const db = getDatabase(app);
    const cronoRef = ref(db, `eventos/${eventoIdReal}/crono`);

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
  }, [router.isReady, eventoIdReal]);

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
        // Conservamos todos los campos de inscripción para poder mostrarlos
        // completos en la ficha del ranking sin afectar la lógica de carrera.
        datosInscripcion: { ...inscrito },
      };
    });
  }, [competidoresDistancia,
  registrosPorCompetidor]);

  // ==========================================
// DISTANCIAS DISPONIBLES SEGÚN LAS RUTAS
// ==========================================

useEffect(() => {

  if (!router.isReady || !eventoIdReal) {
    return;
  }

  const db = getDatabase(app);

  const rutasRef = ref(
    db,
    `eventos/${eventoIdReal}/rutas`
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
  eventoIdReal
]);

// ==========================================
// CARGAR RUTA DE LA DISTANCIA SELECCIONADA
// ==========================================

useEffect(() => {

  if (
    !router.isReady ||
    !eventoIdReal ||
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
  `eventos/${eventoIdReal}/rutas/${distanciaKey}`
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
  eventoIdReal,
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
// GOOGLE MAPS + RUTAS POR CALLES
// ==========================================
//
// La ruta configurada por DHTime sigue siendo la fuente de
// verdad para distancias, tiempos, ranking y progreso.
// Google solo aporta la geometría visual siguiendo calles.
// ==========================================

useEffect(() => {
  let cancelado = false;

  if (!router.isReady || tramosRecorrido.length === 0) {
    setTramosGoogle([]);
    return;
  }

  cargarGoogleMaps()
    .then(async (google: any) => {
      if (cancelado) return;

      if (cancelado) return;

      const Route = google.maps.routes?.Route;
      if (!Route) {
        throw new Error(
          "La biblioteca Routes no está disponible en Google Maps."
        );
      }

      setGoogleListo(true);
      setErrorGoogleMaps("");

      const resultados: TramoGoogle[] = [];

      for (const tramo of tramosRecorrido) {
        if (cancelado) return;

        const puntos = tramo.puntos;

        if (puntos.length < 2) continue;

        // Routes API admite hasta 25 puntos intermedios.
        // Si un tramo tiene más, conservamos la geometría configurada.
        if (puntos.length - 2 > 25) {
          resultados.push(
            construirTramoVisual(
              tramo.id,
              tramo.desde,
              tramo.hasta,
              puntos,
              "configurada"
            )
          );
          continue;
        }

        try {
          // Calculamos cada tramo entre dos puntos consecutivos por separado.
          // Esto evita que Routes intente resolver todo el tramo como una sola
          // ruta con waypoints y termine haciendo desvíos/retornos innecesarios
          // cerca de la meta o de checkpoints anteriores.
          const puntosGoogle: Punto[] = [];

          for (let i = 0; i < puntos.length - 1; i++) {
            const origen = puntos[i];
            const destino = puntos[i + 1];

            const request: any = {
              origin: {
                lat: origen.latitud,
                lng: origen.longitud,
              },
              destination: {
                lat: destino.latitud,
                lng: destino.longitud,
              },
              // Es una carrera a pie. WALKING evita que las restricciones
              // de circulación vehicular/one-way de DRIVING introduzcan
              // vueltas que no forman parte del recorrido configurado.
              travelMode: "WALKING",
              fields: ["path"],
            };

            const resultado = await Route.computeRoutes(request);
            const rutaGoogle = resultado?.routes?.[0];
            const path = rutaGoogle?.path;

            if (!path || path.length < 2) {
              throw new Error(
                `Google no devolvió geometría para ${tramo.desde} → ${tramo.hasta}, segmento ${i + 1}.`
              );
            }

            const segmentoGoogle: Punto[] = path
              .map((p: any) => ({
                latitud: typeof p.lat === "function" ? p.lat() : Number(p.lat),
                longitud: typeof p.lng === "function" ? p.lng() : Number(p.lng),
              }))
              .filter(
                (p: Punto) =>
                  Number.isFinite(p.latitud) && Number.isFinite(p.longitud)
              );

            if (segmentoGoogle.length < 2) {
              throw new Error(`Geometría inválida en segmento ${i + 1}.`);
            }

            if (puntosGoogle.length === 0) {
              puntosGoogle.push(...segmentoGoogle);
            } else {
              // Evitamos duplicar el punto donde termina el segmento anterior.
              puntosGoogle.push(...segmentoGoogle.slice(1));
            }
          }

          if (puntosGoogle.length < 2) {
            throw new Error("Geometría de Google inválida.");
          }

          resultados.push(
            construirTramoVisual(
              tramo.id,
              tramo.desde,
              tramo.hasta,
              puntosGoogle,
              "google"
            )
          );
        } catch (error) {
          console.warn(
            `Google Maps no pudo calcular el tramo ${tramo.desde} → ${tramo.hasta}. Se usará la ruta configurada.`,
            error
          );

          resultados.push(
            construirTramoVisual(
              tramo.id,
              tramo.desde,
              tramo.hasta,
              puntos,
              "configurada"
            )
          );
        }
      }

      if (!cancelado) {
        resultados.sort(
          (a, b) =>
            tramosRecorrido.findIndex((x) => x.id === a.id) -
            tramosRecorrido.findIndex((x) => x.id === b.id)
        );
        setTramosGoogle(resultados);
      }
    })
    .catch((error) => {
      if (cancelado) return;
      console.error("Error inicializando Google Maps:", error);
      setGoogleListo(false);
      setErrorGoogleMaps(
        error instanceof Error
          ? error.message
          : "No se pudo inicializar Google Maps."
      );

      // Fallback visual: DHTime continúa funcionando con la geometría configurada.
      setTramosGoogle(
        tramosRecorrido.map((tramo) =>
          construirTramoVisual(
            tramo.id,
            tramo.desde,
            tramo.hasta,
            tramo.puntos,
            "configurada"
          )
        )
      );
    });

  return () => {
    cancelado = true;
  };
}, [tramosRecorrido]);

const tramosVisuales = useMemo<TramoGoogle[]>(() => {
  if (tramosGoogle.length === tramosRecorrido.length && tramosGoogle.length > 0) {
    return tramosGoogle;
  }

  return tramosRecorrido.map((tramo) =>
    construirTramoVisual(
      tramo.id,
      tramo.desde,
      tramo.hasta,
      tramo.puntos,
      "configurada"
    )
  );
}, [tramosGoogle, tramosRecorrido]);

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

// POSICIÓN SOBRE LA GEOMETRÍA DE GOOGLE MAPS
// ==========================================
// La geometría visual puede ser la ruta real por calles de Google.
// El progreso sigue siendo el calculado por DHTime.

const posicionSobreTramoGoogle = (tramo: TramoGoogle, progreso: number) => {
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
        latitud:
          segmento.inicio.latitud +
          (segmento.fin.latitud - segmento.inicio.latitud) *
            porcentaje,
        longitud:
          segmento.inicio.longitud +
          (segmento.fin.longitud - segmento.inicio.longitud) *
            porcentaje,
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
  if (tramosMetricos.length === 0 || tramosVisuales.length !== tramosMetricos.length) return null;

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

  let posicionFinal: Punto | null = null;
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
    const tramoVisual = tramosVisuales[segmentoActual];
    if (!tramo || !tramoVisual || tramo.distanciaKm <= 0) return null;

    const duracionTramo = tramo.distanciaKm * ritmoMsPorKm;

    // Sigue dentro del tramo.
    if (tiempoDisponible < duracionTramo) {
      progreso = duracionTramo > 0 ? tiempoDisponible / duracionTramo : 0;
      progreso = Math.max(0, Math.min(1, progreso));
      const posicion = posicionSobreTramoGoogle(tramoVisual, progreso);
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
      const posicion = posicionSobreTramoGoogle(tramoVisual, 1);
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
      const meta = puntosMapa.find(
        (punto) => normalizarPunto(punto.nombre) === "META"
      );
      if (!meta) return null;

      posicionFinal = {
        latitud: meta.latitud,
        longitud: meta.longitud,
      };
      puntoActual = normalizarPunto(tramo.hasta);
      siguientePunto = "META";
      progreso = 1;
      distanciaRecorridaKm = tramo.distanciaAcumuladaFinKm;
      break;
    }
  }

  if (!posicionFinal) return null;

  return {
    x: posicionFinal.longitud,
    y: posicionFinal.latitud,
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
  if (tramosVisuales.length !== tramosMetricos.length || posicionesCorredores.length === 0) return [];

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
}, [tramosVisuales, tramosMetricos, posicionesCorredores, tiempoRanking]);

// ==========================================
// CORREDORES VISIBLES
// ==========================================
// Sin BIB: solo los 10 del ranking.
// Con BIB: solo ese corredor.
// ==========================================

const corredoresMapa = useMemo<EstadoCorredor[]>(() => {
  if (tramosVisuales.length !== tramosMetricos.length) return [];

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
  tramosVisuales,
  tramosMetricos,
  posicionesCorredores,
  rankingCorredores,
  tiempoActual,
  bibBusqueda,
]);

// ==========================================
// DATOS PARA LA FICHA DEL COMPETIDOR
// ==========================================
const obtenerCamposFichaCompetidor = (corredor: EstadoCorredor) => {
  const datos = corredor.datosInscripcion || {};

  const conocidos: Array<[string, string[]]> = [
    ["Nombre", ["nombre", "name"]],
    ["BIB", ["competidor"]],
    ["Equipo", ["team", "equipo", "EquipoName"]],
    ["Categoría", ["categoria", "categoriaNombre", "CategoryName"]],
    ["Distancia", ["distancia", "ruta", "RouteName"]],
    ["Ciudad", ["ciudad", "Ciudad"]],
    ["Estado", ["estado", "Estado"]],
    ["Municipio", ["municipio", "Municipio"]],
    ["País", ["pais", "país", "Country"]],
    ["Fecha de nacimiento", ["fechaNacimiento", "fechaNac", "Fecha Nac."]],
    ["Celular", ["celular", "telefono", "phone"]],
    ["Correo", ["email", "correo"]],
  ];

  const usados = new Set<string>();
  const campos: Array<[string, string]> = [];

  for (const [etiqueta, claves] of conocidos) {
    const claveEncontrada = claves.find((clave) =>
      Object.prototype.hasOwnProperty.call(datos, clave) &&
      String(datos[clave] ?? "").trim() !== ""
    );
    if (!claveEncontrada) continue;
    usados.add(claveEncontrada);
    campos.push([etiqueta, String(datos[claveEncontrada])]);
  }

  // También mostramos cualquier otro dato de inscripción que exista, para
  // que "datos completos" no dependa de una lista fija de columnas.
  for (const [clave, valor] of Object.entries(datos)) {
    if (usados.has(clave) || clave === "checkpoints") continue;
    if (valor === null || valor === undefined || typeof valor === "object") continue;
    const texto = String(valor).trim();
    if (!texto) continue;
    campos.push([clave, texto]);
  }

  return campos;
};

const formatearTiempoCarrera = (ms: number) => {
  const totalSegundos = Math.max(0, Math.floor(Number(ms || 0) / 1000));
  const horas = Math.floor(totalSegundos / 3600);
  const minutos = Math.floor((totalSegundos % 3600) / 60);
  const segundos = totalSegundos % 60;
  return [horas, minutos, segundos].map((valor) => String(valor).padStart(2, "0")).join(":");
};

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
      </header>

      <style jsx>{`
        @media (max-width: 1050px) {
          .dhtime-live-content { grid-template-columns: minmax(0, 1fr) 330px !important; }
        }
        @media (max-width: 820px) {
          .dhtime-live-content { grid-template-columns: 1fr !important; }
          .dhtime-event-summary { grid-template-columns: minmax(0, 1fr) auto !important; }
        }
        @media (max-width: 640px) {
          .dhtime-live-content { grid-template-columns: 1fr !important; }
          .dhtime-event-summary { grid-template-columns: 1fr !important; gap: 10px !important; }
          .dhtime-event-summary > div { border-left: none !important; padding-left: 0 !important; align-items: flex-start !important; }
        }
      `}</style>

{/* =====================================
    CONTENIDO PRINCIPAL: MAPA + PANEL LATERAL
====================================== */}
<section className="dhtime-live-layout" style={styles.liveLayout}>

  {/* ================================
      RESUMEN DE LA CARRERA
      Ocupa todo el ancho para dejar más espacio al ranking.
  ================================= */}
  <div className="dhtime-event-summary" style={styles.eventSummary}>
    <div style={styles.eventSummaryMain}>
      <div style={styles.eventSummaryLabel}>CARRERA EN VIVO</div>
      <div style={styles.eventName}>{nombreEvento || "Carrera en vivo"}</div>
      <div style={styles.eventRoute}>
        Ruta {formatearDistancia(distanciaSeleccionada)}
      </div>
    </div>

    <div style={styles.eventSummaryTimer}>
      <span style={styles.eventSummaryTimerLabel}>TIEMPO DE CARRERA</span>
      <strong style={styles.eventSummaryTimerStrong}>{formatearTiempoCarrera(tiempoActual)}</strong>
    </div>

    <div style={styles.liveBadgeSummary}>
      <span style={styles.liveDot}></span>
      EN VIVO
    </div>
  </div>

  <div className="dhtime-live-content" style={styles.liveContent}>

    {/* ================================
        MAPA
    ================================= */}
    <div style={styles.mapColumn}>

      <GoogleRaceMap
        tramos={tramosVisuales}
        puntosMapa={puntosMapa}
        corredores={corredoresMapa}
        bibBusqueda={bibBusqueda}
        googleListo={googleListo}
        errorGoogleMaps={errorGoogleMaps}
        onRetry={() => {
          googleMapsPromise = null;
          setGoogleListo(false);
          setErrorGoogleMaps("");
          setTramosGoogle([]);
        }}
      />

    </div>

    {/* ================================
        PANEL LATERAL
    ================================= */}
    <aside style={styles.sidePanel}>

    <div style={styles.distanceCard}>
      <span style={styles.etiqueta}>DISTANCIA A VISUALIZAR</span>
      <select
        value={distanciaSeleccionada}
        onChange={(e) => setDistanciaSeleccionada(e.target.value)}
        disabled={distanciasDisponibles.length <= 1}
        style={styles.distanceSelect}
      >
        {distanciasDisponibles.map((distancia) => (
          <option key={distancia} value={distancia} style={{ color: "#111827" }}>
            {formatearDistancia(distancia)}
          </option>
        ))}
      </select>
    </div>

    <div style={styles.searchBox}>
      <span style={styles.searchIcon}>⌕</span>
      <input
        type="text"
        inputMode="numeric"
        value={bibBusqueda}
        onChange={(e) => setBibBusqueda(e.target.value)}
        placeholder="Buscar BIB..."
        style={styles.searchInput}
      />
      {bibBusqueda && (
        <button
          type="button"
          onClick={() => setBibBusqueda("")}
          style={styles.clearSearch}
          aria-label="Limpiar búsqueda"
        >
          ×
        </button>
      )}
    </div>

    {errorRuta && (
      <div style={styles.routeWarning}>⚠️ {errorRuta}</div>
    )}

    <div style={styles.rankingPanel}>
      <div style={styles.rankingTitleRow}>
        <div>
          <div style={styles.rankingTitle}>POSICIONES EN VIVO</div>
          <div style={styles.rankingSubtitle}>
            {bibBusqueda ? `Siguiendo BIB ${formatearCompetidor(bibBusqueda)}` : "Siguiendo al líder"}
          </div>
        </div>
        {!bibBusqueda && <span style={styles.top10Badge}>TOP 10</span>}
      </div>

      <div style={styles.rankingHeader}>
        <span>#</span>
        <span>BIB</span>
        <span>COMPETIDOR</span>
        <span>KM</span>
      </div>

      <div style={styles.rankingList}>
        {corredoresMapa.map((corredor) => (
          <div
            key={`ranking-${corredor.competidor}`}
            onMouseEnter={() => setCompetidorHover(corredor)}
            onMouseLeave={() => setCompetidorHover(null)}
            style={{
              ...styles.rankingRow,
              ...(corredor.posicion === 1 ? styles.rankingLeader : {}),
            }}
          >
            <div style={styles.rankBubble}>{corredor.posicion}</div>
            <div style={styles.rankingBib}>#{corredor.competidorDisplay}</div>
            <div style={styles.rankingName} title={corredor.nombre || "Sin nombre"}>
              {corredor.nombre || "Sin nombre"}
            </div>
            <div style={styles.rankingKm}>
              {corredor.distanciaRecorridaKm.toFixed(1)}
            </div>
          </div>
        ))}

        {corredoresMapa.length === 0 && (
          <div style={styles.emptyRanking}>Esperando posiciones...</div>
        )}
      </div>
    </div>

    {competidorHover && (
      <div style={styles.competitorDialogOverlay} aria-live="polite">
        <div style={styles.competitorDetails}>
          <div style={styles.detailsHeader}>
            <div style={styles.detailsRank}>{competidorHover.posicion}</div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={styles.detailsBib}>#{competidorHover.competidorDisplay}</div>
              <div style={styles.detailsName}>{competidorHover.nombre || "Sin nombre"}</div>
            </div>
            <div style={styles.detailsHoverHint}>HOVER</div>
          </div>
          <div style={styles.detailsDivider}></div>
          <div style={styles.detailsGrid}>
            {obtenerCamposFichaCompetidor(competidorHover).map(([etiqueta, valor]) => (
              <div key={`${etiqueta}-${valor}`} style={styles.detailItem}>
                <span>{etiqueta}</span>
                <strong title={valor}>{valor}</strong>
              </div>
            ))}
            <div style={styles.detailItem}>
              <span>Distancia recorrida</span>
              <strong>{competidorHover.distanciaRecorridaKm.toFixed(2)} km</strong>
            </div>
            <div style={styles.detailItem}>
              <span>Punto actual</span>
              <strong>{competidorHover.puntoActual}</strong>
            </div>
            <div style={styles.detailItem}>
              <span>Siguiente</span>
              <strong>{competidorHover.siguientePunto || "Meta"}</strong>
            </div>
          </div>
        </div>
      </div>
    )}

    </aside>
  </div>
</section>
    </main>
  );
}


// =====================================================
// COMPONENTE GOOGLE MAPS PARA LA CARRERA
// =====================================================

type GoogleRaceMapProps = {
  tramos: TramoGoogle[];
  puntosMapa: PuntoMapa[];
  corredores: EstadoCorredor[];
  bibBusqueda: string;
  googleListo: boolean;
  errorGoogleMaps: string;
  onRetry: () => void;
};

function GoogleRaceMap({
  tramos,
  puntosMapa,
  corredores,
  bibBusqueda,
  googleListo,
  errorGoogleMaps,
  onRetry,
}: GoogleRaceMapProps) {
  const contenedorRef = useRef<HTMLDivElement | null>(null);
  const mapaRef = useRef<any>(null);
  const polylinesRef = useRef<any[]>([]);
  const markersRef = useRef<any[]>([]);
  const corredoresMarkersRef = useRef<Map<string, { marker: any; contenido: HTMLDivElement; posicion: HTMLDivElement; bib: HTMLDivElement; nombre: HTMLDivElement; flecha: HTMLDivElement }>>(new Map());
  const inicializadoRef = useRef(false);
  const vistaInicialAplicadaRef = useRef(false);
  const [mapaListo, setMapaListo] = useState(false);
  const [rutaMapaLista, setRutaMapaLista] = useState(false);

  const limpiarOverlays = () => {
    for (const polyline of polylinesRef.current) {
      polyline.setMap(null);
    }
    polylinesRef.current = [];

    for (const marker of markersRef.current) {
      marker.map = null;
    }
    markersRef.current = [];

    for (const { marker } of corredoresMarkersRef.current.values()) {
      marker.map = null;
    }
    corredoresMarkersRef.current.clear();
  };

  useEffect(() => {
    let cancelado = false;

    if (!googleListo || !contenedorRef.current || inicializadoRef.current) {
      return;
    }

    const iniciar = async () => {
      try {
        const google = await cargarGoogleMaps();
        if (cancelado || !contenedorRef.current) return;

        const Map = google.maps.Map;
        if (!Map || !google.maps.marker?.AdvancedMarkerElement) {
          throw new Error(
            "Las librerías de Google Maps necesarias no están disponibles."
          );
        }

        if (cancelado) return;

        const primerPunto =
          puntosMapa[0] || tramos[0]?.puntos[0] || { latitud: 25.7905, longitud: -108.9859 };

        mapaRef.current = new Map(contenedorRef.current, {
          center: {
            lat: primerPunto.latitud,
            lng: primerPunto.longitud,
          },
          zoom: 14,
          // La vista inclinada y la rotación necesitan un mapa VECTOR.
          // El mapa ID anterior estaba renderizándose como raster, por eso
          // setTilt()/setHeading() no producían una perspectiva visible.
          mapId: "DEMO_MAP_ID",
          renderingType: "VECTOR",
          tiltInteractionEnabled: true,
          headingInteractionEnabled: true,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          gestureHandling: "greedy",
        });

        inicializadoRef.current = true;
        setMapaListo(true);
      } catch (error) {
        console.error("No se pudo crear el mapa:", error);
      }
    };

    void iniciar();

    return () => {
      cancelado = true;
    };
  }, [googleListo]);

  // Dibujar ruta y checkpoints cuando cambia la ruta.
  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa || tramos.length === 0) return;

    const dibujar = async () => {
      const google = await cargarGoogleMaps();
      const AdvancedMarkerElement =
        google.maps.marker?.AdvancedMarkerElement;
      const PinElement = google.maps.marker?.PinElement;

      if (!AdvancedMarkerElement || !PinElement) {
        throw new Error(
          "La librería Marker no está disponible en Google Maps."
        );
      }

      for (const polyline of polylinesRef.current) {
        polyline.setMap(null);
      }
      polylinesRef.current = [];

      for (const marker of markersRef.current) {
        marker.map = null;
      }
      markersRef.current = [];

      const bounds = new google.maps.LatLngBounds();

      for (const tramo of tramos) {
        if (tramo.puntos.length < 2) continue;

        const path = tramo.puntos.map((punto) => ({
          lat: punto.latitud,
          lng: punto.longitud,
        }));

        path.forEach((punto) => bounds.extend(punto));

        const sombra = new google.maps.Polyline({
          map: mapa,
          path,
          geodesic: true,
          strokeColor: "#000000",
          strokeOpacity: 0.35,
          strokeWeight: 12,
          zIndex: 10,
        });

        const ruta = new google.maps.Polyline({
          map: mapa,
          path,
          geodesic: true,
          strokeColor: "#7E57C2",
          strokeOpacity: 0.95,
          strokeWeight: 7,
          zIndex: 11,
        });

        polylinesRef.current.push(sombra, ruta);
      }

      for (const punto of puntosMapa) {
        const nombreNormalizado = String(punto.nombre ?? "").trim().toUpperCase();
        const numeroCheckpoint = nombreNormalizado.match(/\d+/)?.[0] || nombreNormalizado;

        const pin = new PinElement({
          background: "#7E57C2",
          borderColor: "#020202",
          glyphColor: "#8a00c1",
          // Nunca usamos el índice de Object.values() para numerar.
          // El número debe corresponder al checkpoint real.
          glyphText: numeroCheckpoint,
          scale: 0.9,
        });

        const marker = new AdvancedMarkerElement({
          map: mapa,
          position: {
            lat: punto.latitud,
            lng: punto.longitud,
          },
          title: punto.nombre,
          zIndex: 100,
          content: pin.element,
        });

        markersRef.current.push(marker);
        bounds.extend({ lat: punto.latitud, lng: punto.longitud });
      }

      if (!bounds.isEmpty()) {
        // Primero dejamos que Google encuadre la ruta completa. La vista
        // "primera persona" se aplica después, para que fitBounds() no la pise.
        mapa.fitBounds(bounds, 60);
      }

      setRutaMapaLista(true);
    };

    setRutaMapaLista(false);
    void dibujar();
  }, [tramos, puntosMapa, mapaListo]);

  // Seguimiento de cámara tipo "primera persona".
  // Al cargar la carrera seguimos al líder. Si el usuario escribe/selecciona
  // un BIB, seguimos exclusivamente a ese corredor. Al limpiar el BIB,
  // volvemos automáticamente al primer lugar.
  useEffect(() => {
    const mapa = mapaRef.current;

    if (!mapa || !mapaListo || !rutaMapaLista || corredores.length === 0) {
      return;
    }

    const bibNormalizado = String(bibBusqueda ?? "").trim().toUpperCase();

    const corredorSeguimiento = bibNormalizado
      ? corredores.find(
          (corredor) =>
            String(corredor.competidor ?? "").trim().toUpperCase() ===
            bibNormalizado
        ) || corredores[0]
      : corredores.find((corredor) => corredor.posicion === 1) || corredores[0];

    if (!corredorSeguimiento) return;

    const lat = Number(corredorSeguimiento.y);
    const lng = Number(corredorSeguimiento.x);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    const siguienteNombre = String(corredorSeguimiento.siguientePunto ?? "")
      .trim()
      .toUpperCase();

    const siguientePunto = puntosMapa.find(
      (punto) =>
        String(punto.nombre ?? "").trim().toUpperCase() === siguienteNombre
    );

    const toRad = (valor: number) => (valor * Math.PI) / 180;
    const toDeg = (valor: number) => (valor * 180) / Math.PI;

    let destinoLat = lat;
    let destinoLng = lng;
    let heading = 0;

    if (siguientePunto) {
      destinoLat = Number(siguientePunto.latitud);
      destinoLng = Number(siguientePunto.longitud);
    }

    if (
      Number.isFinite(destinoLat) &&
      Number.isFinite(destinoLng) &&
      (Math.abs(destinoLat - lat) > 0.000001 ||
        Math.abs(destinoLng - lng) > 0.000001)
    ) {
      const lat1 = toRad(lat);
      const lat2 = toRad(destinoLat);
      const dLng = toRad(destinoLng - lng);

      const y = Math.sin(dLng) * Math.cos(lat2);
      const x =
        Math.cos(lat1) * Math.sin(lat2) -
        Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

      heading = (toDeg(Math.atan2(y, x)) + 360) % 360;
    } else if (typeof mapa.getHeading === "function") {
      heading = Number(mapa.getHeading()) || 0;
    }

    // El centro de la cámara es SIEMPRE la posición exacta del corredor.
    // Con la vista inclinada, el heading ya deja el recorrido hacia la parte
    // superior del mapa. No desplazamos el centro hacia el siguiente punto,
    // porque eso puede sacar al corredor por la parte inferior de la pantalla.
    const centro = { lat, lng };

    // En cada actualización de posiciones movemos la cámara al corredor
    // seleccionado. moveCamera mantiene zoom, rumbo e inclinación sin
    // desmontar ni recrear los marcadores.
    if (typeof mapa.moveCamera === "function") {
      mapa.moveCamera({
        center: centro,
        zoom: 17,
        heading,
        tilt: 55,
      });
    } else {
      mapa.setCenter(centro);
      mapa.setZoom(17);
      mapa.setHeading(heading);
      if (typeof mapa.setTilt === "function") {
        mapa.setTilt(55);
      }
    }

    if (typeof mapa.setTiltInteractionEnabled === "function") {
      mapa.setTiltInteractionEnabled(true);
    }
    if (typeof mapa.setHeadingInteractionEnabled === "function") {
      mapa.setHeadingInteractionEnabled(true);
    }
  }, [
    corredores,
    puntosMapa,
    bibBusqueda,
    mapaListo,
    rutaMapaLista,
  ]);

  // Corredores: se actualizan cada segundo sin redibujar la ruta.
  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa) return;

    const actualizar = async () => {
      const google = await cargarGoogleMaps();
      const AdvancedMarkerElement =
        google.maps.marker?.AdvancedMarkerElement;

      if (!AdvancedMarkerElement) {
        throw new Error(
          "La librería Marker no está disponible en Google Maps."
        );
      }

      // IMPORTANT: no recreamos los AdvancedMarkerElement en cada tick.
      // Hacerlo provoca que Google quite el marcador y lo vuelva a insertar,
      // produciendo el parpadeo que se veía en el mapa.
      const presentes = new Set<string>();

      const bibNormalizado = String(bibBusqueda ?? "").trim().toUpperCase();
      const corredorSeguimiento = bibNormalizado
        ? corredores.find(
            (corredor) =>
              String(corredor.competidor ?? "").trim().toUpperCase() ===
              bibNormalizado
          ) || corredores[0]
        : corredores.find((corredor) => corredor.posicion === 1) || corredores[0];
      const keySeguimiento = corredorSeguimiento
        ? String(corredorSeguimiento.competidor)
        : "";

      for (const corredor of corredores) {
        const key = String(corredor.competidor);
        presentes.add(key);
        const esSeguimiento = key === keySeguimiento;

        // En la vista inclinada los edificios 3D pueden tapar un marcador
        // que está a nivel de calle. El corredor que estamos siguiendo es
        // prioritario: lo elevamos ligeramente para que su BIB siga visible
        // aunque la cámara quede lateral respecto a la calle.
        const posicionMarker = {
          lat: Number(corredor.y),
          lng: Number(corredor.x),
          ...(esSeguimiento ? { altitude: 25 } : {}),
        };

        const existente = corredoresMarkersRef.current.get(key);

        if (existente) {
          // Actualizamos solo lo que cambió. El marcador permanece montado.
          existente.marker.position = posicionMarker;
          existente.marker.zIndex = esSeguimiento
            ? 100000
            : 1000 + (100 - corredor.posicion);
          existente.marker.title = `BIB ${corredor.competidorDisplay}`;
          existente.marker.collisionBehavior = "REQUIRED";
          existente.posicion.textContent = String(corredor.posicion);
          existente.bib.textContent = `#${corredor.competidorDisplay}`;
          existente.nombre.textContent = corredor.nombre || "Sin nombre";
          existente.nombre.style.display = esSeguimiento ? "block" : "none";
          existente.flecha.style.display = esSeguimiento ? "block" : "none";
          existente.contenido.style.transform = esSeguimiento
            ? "scale(1.08)"
            : "scale(1)";
          continue;
        }

        const contenido = document.createElement("div");
        contenido.style.width = "220px";
        contenido.style.height = "104px";
        contenido.style.position = "relative";
        contenido.style.fontFamily = "Inter, system-ui, sans-serif";
        contenido.style.fontWeight = "900";
        contenido.style.color = "#111827";
        contenido.style.fontSize = "18px";
        contenido.style.display = "flex";
        contenido.style.alignItems = "flex-start";
        contenido.style.justifyContent = "center";

        const circulo = document.createElement("div");
        circulo.style.width = "52px";
        circulo.style.height = "52px";
        circulo.style.borderRadius = "50%";
        circulo.style.background = "white";
        circulo.style.border = "5px solid #9EBC39";
        circulo.style.boxShadow = "0 4px 14px rgba(0,0,0,0.45)";
        circulo.style.display = "flex";
        circulo.style.alignItems = "center";
        circulo.style.justifyContent = "center";
        circulo.style.position = "absolute";
        circulo.style.left = "50%";
        circulo.style.top = "28px";
        circulo.style.transform = "translateX(-50%)";
        contenido.appendChild(circulo);

        const posicion = document.createElement("div");
        posicion.textContent = String(corredor.posicion);
        circulo.appendChild(posicion);

        const bib = document.createElement("div");
        bib.textContent = `#${corredor.competidorDisplay}`;
        bib.style.position = "absolute";
        bib.style.left = "50%";
        bib.style.bottom = "58px";
        bib.style.transform = "translateX(-50%)";
        bib.style.padding = "4px 8px";
        bib.style.borderRadius = "8px";
        bib.style.background = "rgba(17,24,39,0.92)";
        bib.style.color = "white";
        bib.style.fontSize = "12px";
        bib.style.whiteSpace = "nowrap";
        bib.style.fontWeight = "900";
        bib.style.boxShadow = "0 3px 10px rgba(0,0,0,0.35)";
        contenido.appendChild(bib);

        const nombre = document.createElement("div");
        nombre.textContent = corredor.nombre || "Sin nombre";
        nombre.style.position = "absolute";
        nombre.style.left = "50%";
        nombre.style.top = "84px";
        nombre.style.transform = "translateX(-50%)";
        nombre.style.padding = "3px 8px";
        nombre.style.borderRadius = "7px";
        nombre.style.background = "rgba(255,255,255,0.96)";
        nombre.style.color = "#111827";
        nombre.style.fontSize = "12px";
        nombre.style.whiteSpace = "nowrap";
        nombre.style.maxWidth = "210px";
        nombre.style.overflow = "hidden";
        nombre.style.textOverflow = "ellipsis";
        nombre.style.boxShadow = "0 3px 10px rgba(0,0,0,0.30)";
        nombre.style.display = esSeguimiento ? "block" : "none";
        contenido.appendChild(nombre);

        const flecha = document.createElement("div");
        flecha.style.position = "absolute";
        flecha.style.left = "50%";
        flecha.style.top = "99px";
        flecha.style.transform = "translateX(-50%)";
        flecha.style.width = "0";
        flecha.style.height = "0";
        flecha.style.borderLeft = "8px solid transparent";
        flecha.style.borderRight = "8px solid transparent";
        flecha.style.borderTop = "10px solid #9EBC39";
        flecha.style.filter = "drop-shadow(0 2px 3px rgba(0,0,0,0.35))";
        flecha.style.display = esSeguimiento ? "block" : "none";
        contenido.appendChild(flecha);

        const marker = new AdvancedMarkerElement({
          map: mapa,
          position: posicionMarker,
          title: `BIB ${corredor.competidorDisplay}`,
          zIndex: esSeguimiento
            ? 100000
            : 1000 + (100 - corredor.posicion),
          collisionBehavior: "REQUIRED",
          content: contenido,
        });

        if (esSeguimiento) {
          contenido.style.transform = "scale(1.08)";
        }

        corredoresMarkersRef.current.set(key, {
          marker,
          contenido,
          posicion,
          bib,
          nombre,
          flecha,
        });
      }

      // Si un corredor salió del conjunto visible, quitamos únicamente ese marcador.
      for (const [key, { marker }] of corredoresMarkersRef.current) {
        if (!presentes.has(key)) {
          marker.map = null;
          corredoresMarkersRef.current.delete(key);
        }
      }
    };

    void actualizar();
  }, [corredores, bibBusqueda]);

  useEffect(() => {
    return () => {
      limpiarOverlays();
      mapaRef.current = null;
      inicializadoRef.current = false;
      vistaInicialAplicadaRef.current = false;
      setRutaMapaLista(false);
      setMapaListo(false);
    };
  }, []);

  if (errorGoogleMaps) {
    return (
      <div style={styles.mapWrapper}>
        <div style={styles.mapError}>
          <div style={{ fontSize: 42 }}>🗺️</div>
          <strong>No se pudo cargar Google Maps</strong>
          <span>{errorGoogleMaps}</span>
          <button
            type="button"
            onClick={onRetry}
            style={styles.mapRetry}
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.mapWrapper}>
      {!googleListo && (
        <div style={styles.mapLoading}>Cargando mapa...</div>
      )}
      <div ref={contenedorRef} style={styles.mapaGoogle} />
    </div>
  );
}

// =====================================================
// ESTILOS
// =====================================================

const styles: {
  [key: string]: React.CSSProperties;
} = {
  // ==========================================
  // NUEVO LAYOUT EN VIVO
  // ==========================================

  liveLayout: {
    maxWidth: 1600,
    margin: "0 auto",
    padding: "6px 28px 50px",
  },

  eventSummary: {
    width: "100%",
    minHeight: 72,
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto auto",
    alignItems: "center",
    gap: 26,
    padding: "11px 20px",
    marginBottom: 10,
    borderRadius: 18,
    background: "linear-gradient(110deg, rgba(126,87,194,0.20), rgba(255,255,255,0.045))",
    border: "1px solid rgba(255,255,255,0.09)",
    boxShadow: "0 12px 35px rgba(0,0,0,0.18)",
  },
  eventSummaryMain: { minWidth: 0 },
  eventSummaryLabel: { fontSize: 9, letterSpacing: 2, opacity: 0.45, fontWeight: 900, marginBottom: 3 },
  eventSummaryTimer: { display: "flex", flexDirection: "column", alignItems: "flex-end", paddingLeft: 22, borderLeft: "1px solid rgba(255,255,255,0.09)" },
  eventSummaryTimerLabel: { fontSize: 8, letterSpacing: 1.2, opacity: 0.45, fontWeight: 900, marginBottom: 2 },
  eventSummaryTimerStrong: { fontSize: 28, fontVariantNumeric: "tabular-nums", fontWeight: 950, letterSpacing: 1 },
  liveBadgeSummary: { display: "flex", alignItems: "center", gap: 7, color: "#9EBC39", fontSize: 12, fontWeight: 950, whiteSpace: "nowrap", paddingLeft: 22, borderLeft: "1px solid rgba(255,255,255,0.09)" },

  liveContent: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 390px",
    gap: 18,
    alignItems: "start",
  },

  mapColumn: { minWidth: 0 },

  sidePanel: {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: 10,
    position: "relative",
  },

  eventCard: {
    padding: "16px 18px",
    borderRadius: 18,
    background: "linear-gradient(145deg, rgba(126,87,194,0.22), rgba(255,255,255,0.045))",
    border: "1px solid rgba(255,255,255,0.10)",
  },
  eventCardTop: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" },
  eventName: { fontSize: 18, fontWeight: 950, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  eventRoute: { fontSize: 12, opacity: 0.6, marginTop: 4 },
  eventTimer: { fontSize: 30, fontVariantNumeric: "tabular-nums", fontWeight: 900, letterSpacing: 1, marginTop: 12 },
  liveBadge: { display: "flex", alignItems: "center", gap: 6, color: "#9EBC39", fontSize: 11, fontWeight: 900, whiteSpace: "nowrap" },
  liveDot: { width: 8, height: 8, borderRadius: "50%", background: "#9EBC39", boxShadow: "0 0 10px rgba(158,188,57,0.8)" },

  distanceCard: { padding: "12px 14px", borderRadius: 15, background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.07)" },
  distanceSelect: { width: "100%", marginTop: 7, padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.07)", color: "white", fontSize: 14, fontWeight: 800, outline: "none" },

  statsGrid: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 },
  statBox: { padding: "10px 11px", borderRadius: 13, background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.06)", minWidth: 0 },
  statLabel: { display: "block", fontSize: 8, letterSpacing: 1, opacity: 0.45, fontWeight: 900, marginBottom: 3 },

  searchBox: { display: "flex", alignItems: "center", gap: 8, padding: "0 10px 0 13px", minHeight: 46, borderRadius: 13, background: "rgba(255,255,255,0.065)", border: "1px solid rgba(255,255,255,0.11)" },
  searchIcon: { fontSize: 24, opacity: 0.55, lineHeight: 1 },
  searchInput: { flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", color: "white", fontSize: 14, fontWeight: 700 },
  clearSearch: { width: 30, height: 30, border: "none", borderRadius: "50%", background: "rgba(255,255,255,0.10)", color: "white", fontSize: 18, fontWeight: 900, cursor: "pointer" },
  routeWarning: { padding: "10px 12px", borderRadius: 12, background: "rgba(245,158,11,0.10)", border: "1px solid rgba(245,158,11,0.24)", color: "#fbbf24", fontSize: 12, fontWeight: 700 },

  rankingPanel: { overflow: "hidden", borderRadius: 17, background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.07)" },
  rankingTitleRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "15px 15px 10px" },
  rankingTitle: { fontSize: 15, fontWeight: 950, letterSpacing: 0.5 },
  rankingSubtitle: { fontSize: 10, opacity: 0.5, marginTop: 3, fontWeight: 800 },
  top10Badge: { padding: "5px 8px", borderRadius: 8, background: "rgba(158,188,57,0.14)", color: "#9EBC39", fontSize: 9, fontWeight: 900 },
  rankingHeader: { display: "grid", gridTemplateColumns: "34px 62px minmax(0, 1fr) 42px", gap: 7, padding: "7px 12px", fontSize: 9, letterSpacing: 1, opacity: 0.4, fontWeight: 900, borderTop: "1px solid rgba(255,255,255,0.05)", borderBottom: "1px solid rgba(255,255,255,0.05)" },
  rankingList: { maxHeight: 430, overflowY: "auto" },
  rankingRow: { display: "grid", gridTemplateColumns: "34px 62px minmax(0, 1fr) 42px", gap: 7, alignItems: "center", minHeight: 49, padding: "5px 12px", borderBottom: "1px solid rgba(255,255,255,0.045)", transition: "background 0.15s ease" },
  rankingLeader: { background: "rgba(158,188,57,0.08)" },
  rankBubble: { width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: "#9EBC39", color: "#111827", fontSize: 12, fontWeight: 950 },
  rankingBib: { fontSize: 11, fontWeight: 900, opacity: 0.8 },
  rankingName: { minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12, fontWeight: 800 },
  rankingKm: { textAlign: "right", fontSize: 11, fontWeight: 900, fontVariantNumeric: "tabular-nums", opacity: 0.75 },
  emptyRanking: { padding: 25, textAlign: "center", fontSize: 12, opacity: 0.5 },

  competitorDialogOverlay: {
    position: "fixed",
    inset: 0,
    zIndex: 99999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    background: "rgba(3,6,16,0.46)",
    backdropFilter: "blur(2px)",
    pointerEvents: "none",
  },
  competitorDetails: {
    width: "min(620px, calc(100vw - 48px))",
    maxHeight: "min(78vh, 680px)",
    overflowY: "auto",
    padding: "20px 22px",
    borderRadius: 20,
    background: "linear-gradient(145deg, rgba(15,19,34,0.99), rgba(8,11,21,0.99))",
    border: "1px solid rgba(126,87,194,0.58)",
    boxShadow: "0 30px 90px rgba(0,0,0,0.62), 0 0 0 1px rgba(255,255,255,0.035) inset",
    pointerEvents: "none",
  },
  detailsHeader: { display: "flex", alignItems: "center", gap: 12, marginBottom: 14 },
  detailsRank: { width: 48, height: 48, borderRadius: "50%", background: "#7E57C2", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 19, fontWeight: 950, flexShrink: 0 },
  detailsBib: { fontSize: 11, opacity: 0.58, fontWeight: 900, letterSpacing: 0.4 },
  detailsName: { fontSize: 20, fontWeight: 950, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 },
  detailsHoverHint: { padding: "5px 8px", borderRadius: 8, background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.42)", fontSize: 8, fontWeight: 900, letterSpacing: 1, flexShrink: 0 },
  detailsDivider: { height: 1, background: "rgba(255,255,255,0.09)", marginBottom: 15 },
  detailsGrid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "11px 22px" },
  detailItem: { minWidth: 0, fontSize: 11, lineHeight: 1.4, display: "grid", gridTemplateColumns: "minmax(105px, 0.75fr) minmax(0, 1.25fr)", gap: 8, alignItems: "start" },



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
  // CONTENEDOR GOOGLE MAPS
  // ==========================================

  mapWrapper: {
    width: "100%",
    height: "clamp(500px, 68vh, 760px)",
    borderRadius: 24,
    overflow: "hidden",
    background: "#dbe4ea",
    border: "1px solid rgba(255,255,255,0.08)",
    boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
    position: "relative",
  },

  mapaGoogle: {
    width: "100%",
    height: "100%",
    display: "block",
  },

  mapLoading: {
    position: "absolute",
    zIndex: 20,
    top: 16,
    left: "50%",
    transform: "translateX(-50%)",
    padding: "10px 16px",
    borderRadius: 999,
    background: "rgba(17,24,39,0.90)",
    color: "white",
    fontWeight: 800,
    fontSize: 13,
    boxShadow: "0 6px 20px rgba(0,0,0,0.25)",
  },

  mapError: {
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    padding: 30,
    boxSizing: "border-box",
    textAlign: "center",
    background: "radial-gradient(circle, #182235 0%, #0b1220 70%)",
    color: "white",
  },

  mapRetry: {
    marginTop: 8,
    border: "none",
    borderRadius: 12,
    padding: "11px 18px",
    background: "#7E57C2",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
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