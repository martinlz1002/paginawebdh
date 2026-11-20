
import { useState } from "react";
import Head from "next/head";
import {
  motion,
  AnimatePresence,
} from "framer-motion";

import {
  ChatBubbleLeftRightIcon,
  PhoneIcon,
  QuestionMarkCircleIcon,
  PlayCircleIcon,
  ChevronDownIcon,
  ClipboardDocumentCheckIcon,
  CreditCardIcon,
  UserCircleIcon,
  HashtagIcon,
  ExclamationCircleIcon,
  EnvelopeIcon,
  LifebuoyIcon,
} from "@heroicons/react/24/outline";

// ========================================
// CONFIGURACIÓN DE SOPORTE
// ========================================

const SOPORTE = {
  nombre: "Soporte DHTime",

  whatsapp: [
    {
      nombre: "Atención principal",
      numero: "526688207434",
      descripcion: "Dudas generales e inscripciones",
    },
    {
      nombre: "Atención secundaria",
      numero: "6683963132",
      descripcion: "Soporte adicional",
    },
  ],

  videoTutorial: "/tutorial-dhtime.mp4",

  mensajeInicial:
    "Hola, necesito ayuda con mi inscripción en DHTime.",
};

// ========================================
// PREGUNTAS FRECUENTES
// ========================================

const preguntasFrecuentes = [
  {
    categoria: "Inscripciones",
    icono: ClipboardDocumentCheckIcon,
    preguntas: [
      {
        pregunta: "¿Cómo puedo inscribirme a una carrera?",
        respuesta:
          "Ingresa a DHTime, busca la carrera en la que deseas participar, selecciona el evento y presiona el botón de inscripción. Completa tus datos y sigue los pasos indicados para finalizar tu registro.",
      },
      {
        pregunta: "¿Necesito crear una cuenta?",
        respuesta:
          "Sí. Debes crear una cuenta en DHTime para realizar y administrar tus inscripciones. También podrás consultar tus registros desde el apartado Mis Inscripciones.",
      },
      {
        pregunta: "¿Cómo puedo consultar mi inscripción?",
        respuesta:
          "Inicia sesión en tu cuenta y dirígete al apartado Mis Inscripciones. Ahí podrás consultar los eventos en los que te has registrado y el estado de cada inscripción.",
      },
    ],
  },
  {
    categoria: "Pagos",
    icono: CreditCardIcon,
    preguntas: [
      {
        pregunta: "¿Qué métodos de pago están disponibles?",
        respuesta:
          "Los métodos de pago disponibles dependen de cada evento. Consulta las opciones que aparecen durante el proceso de inscripción.",
      },
      {
        pregunta: "¿Qué hago si mi pago aparece pendiente?",
        respuesta:
          "Primero verifica que tu pago se haya realizado correctamente. Si ya fue descontado de tu cuenta y sigue apareciendo pendiente, contacta a nuestro equipo de soporte y comparte los datos de tu inscripción y comprobante.",
      },
      {
        pregunta: "¿Dónde puedo enviar mi comprobante de pago?",
        respuesta:
          "Puedes contactar a nuestro equipo de soporte mediante WhatsApp para recibir orientación sobre tu comprobante.",
      },
    ],
  },
  {
    categoria: "Datos del competidor",
    icono: UserCircleIcon,
    preguntas: [
      {
        pregunta: "¿Cómo puedo modificar mis datos?",
        respuesta:
          "Ingresa a tu cuenta y revisa el apartado Perfil. Si necesitas corregir información de una inscripción ya realizada, comunícate con soporte.",
      },
      {
        pregunta: "¿Cómo puedo consultar mi número de competidor?",
        respuesta:
          "Cuando tu inscripción esté confirmada y el organizador haya asignado tu número, podrás consultar la información correspondiente desde los apartados disponibles del evento o Mis Inscripciones.",
      },
      {
        pregunta: "¿Puedo inscribirme en más de una carrera?",
        respuesta:
          "Sí, puedes realizar inscripciones en diferentes eventos disponibles en DHTime.",
      },
    ],
  },
  {
    categoria: "Problemas frecuentes",
    icono: ExclamationCircleIcon,
    preguntas: [
      {
        pregunta: "No puedo iniciar sesión, ¿qué hago?",
        respuesta:
          "Verifica que estés utilizando el correo electrónico y contraseña correctos. Si olvidaste tu contraseña, utiliza la opción de recuperación de contraseña en la pantalla de inicio de sesión.",
      },
      {
        pregunta: "No recibí el correo de verificación.",
        respuesta:
          "Revisa tu bandeja de correo no deseado o spam. Si todavía no aparece, contacta a nuestro equipo de soporte.",
      },
    ],
  },
];

// ========================================
// COMPONENTE PRINCIPAL
// ========================================

export default function Soporte() {
  const [preguntaAbierta, setPreguntaAbierta] =
    useState<string | null>(null);

  const [categoriaActiva, setCategoriaActiva] =
    useState("Inscripciones");

  const whatsappPrincipal =
    SOPORTE.whatsapp[0].numero;

  const abrirWhatsApp = (
    numero: string,
    mensaje: string
  ) => {
    if (!numero) return;

    window.open(
      `https://wa.me/${numero}?text=${encodeURIComponent(
        mensaje
      )}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  // El video está guardado en /public/tutorial-dhtime.mp4.
  // Los archivos de public se sirven desde la raíz del sitio.
  const videoTutorial = SOPORTE.videoTutorial;

  const categoriaSeleccionada =
    preguntasFrecuentes.find(
      (cat) => cat.categoria === categoriaActiva
    );

  return (
    <>
      <Head>
        <title>Soporte | DHTime</title>
        <meta
          name="description"
          content="Centro de ayuda DHTime. Encuentra respuestas a tus dudas sobre inscripciones, pagos y eventos deportivos."
        />
      </Head>

      <main className="min-h-screen bg-dh-bg text-white overflow-hidden">

        {/* ================================= */}
        {/* HERO */}
        {/* ================================= */}

        <section className="relative pt-36 pb-20 px-6">

          <div className="absolute inset-0 bg-dh-glow opacity-40 pointer-events-none" />

          <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-dh-purple/10 blur-[120px] rounded-full" />

          <motion.div
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="relative max-w-5xl mx-auto text-center"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-dh-purple/30 bg-dh-purple/10 text-dh-purpleLight text-sm font-semibold mb-7">
              <LifebuoyIcon className="w-5 h-5" />
              CENTRO DE AYUDA
            </div>

            <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-6">
              ¿Necesitas{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-dh-purple to-dh-purpleLight">
                ayuda?
              </span>
            </h1>

            <p className="text-white/55 text-base md:text-xl max-w-2xl mx-auto leading-relaxed">
              Estamos aquí para ayudarte. Encuentra
              respuestas a tus preguntas o contacta
              directamente con nuestro equipo.
            </p>

            <div className="flex flex-wrap justify-center gap-4 mt-10">

              <a
                href="#contacto"
                className="px-7 py-3.5 rounded-full bg-gradient-to-r from-dh-purple to-dh-purpleLight font-bold shadow-[0_0_25px_rgba(126,87,194,0.3)] hover:scale-105 transition"
              >
                Contactar soporte
              </a>

              <a
                href="#faq"
                className="px-7 py-3.5 rounded-full border border-white/10 bg-white/5 font-semibold hover:bg-white/10 transition"
              >
                Ver preguntas frecuentes
              </a>

            </div>
          </motion.div>
        </section>

        {/* ================================= */}
        {/* CONTACTO */}
        {/* ================================= */}

        <section
          id="contacto"
          className="max-w-6xl mx-auto px-6 py-16 scroll-mt-24"
        >

          <div className="text-center mb-12">
            <p className="text-dh-purpleLight text-sm font-bold uppercase tracking-widest mb-3">
              Estamos para ayudarte
            </p>

            <h2 className="text-3xl md:text-4xl font-black">
              Contacta con nosotros
            </h2>

            <p className="text-white/45 mt-4">
              Elige el medio que prefieras para recibir
              atención.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">

            {SOPORTE.whatsapp
              .filter((item) => item.numero)
              .map((item, index) => (

                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className="group relative p-7 rounded-3xl bg-dh-panel border border-white/5 hover:border-dh-purple/40 transition-all duration-300"
                >

                  <div className="absolute inset-0 rounded-3xl bg-dh-purple/5 opacity-0 group-hover:opacity-100 transition" />

                  <div className="relative">

                    <div className="w-14 h-14 rounded-2xl bg-green-500/10 flex items-center justify-center mb-6">
                      <ChatBubbleLeftRightIcon className="w-8 h-8 text-green-400" />
                    </div>

                    <h3 className="text-xl font-bold mb-2">
                      {item.nombre}
                    </h3>

                    <p className="text-white/45 text-sm mb-5">
                      {item.descripcion}
                    </p>

                    <p className="text-white/80 font-semibold mb-6">
                      +{item.numero}
                    </p>

                    <button
                      onClick={() =>
                        abrirWhatsApp(
                          item.numero,
                          SOPORTE.mensajeInicial
                        )
                      }
                      className="w-full py-3.5 rounded-xl bg-green-600 hover:bg-green-500 text-white font-bold transition flex justify-center items-center gap-2"
                    >
                      <ChatBubbleLeftRightIcon className="w-5 h-5" />
                      Contactar por WhatsApp
                    </button>

                  </div>
                </motion.div>

              ))}

          </div>

          <div className="mt-6 p-6 rounded-2xl bg-dh-panel border border-white/5 flex flex-col md:flex-row items-center gap-4">

            <div className="w-12 h-12 rounded-xl bg-dh-purple/10 flex items-center justify-center shrink-0">
              <EnvelopeIcon className="w-6 h-6 text-dh-purpleLight" />
            </div>

            <div className="text-center md:text-left flex-1">
              <h3 className="font-bold">
                ¿Necesitas más ayuda?
              </h3>

              <p className="text-sm text-white/45">
                Nuestro equipo puede orientarte con
                cualquier inconveniente relacionado
                con tu inscripción.
              </p>
            </div>

            <button
              onClick={() =>
                abrirWhatsApp(
                  whatsappPrincipal,
                  SOPORTE.mensajeInicial
                )
              }
              className="px-6 py-3 rounded-xl border border-dh-purple/40 text-dh-purpleLight hover:bg-dh-purple/10 transition font-semibold"
            >
              Solicitar ayuda
            </button>

          </div>
        </section>

        {/* ================================= */}
        {/* VIDEO TUTORIAL */}
        {/* ================================= */}

        <section className="px-6 py-20 bg-white/[0.02]">

          <div className="max-w-5xl mx-auto">

            <div className="text-center mb-12">

              <div className="inline-flex items-center gap-2 text-dh-purpleLight text-sm font-bold uppercase tracking-widest mb-4">
                <PlayCircleIcon className="w-5 h-5" />
                Aprende paso a paso
              </div>

              <h2 className="text-3xl md:text-4xl font-black">
                ¿Cómo inscribirte?
              </h2>

              <p className="text-white/45 mt-4 max-w-xl mx-auto">
                Preparamos un tutorial para guiarte
                durante todo el proceso de inscripción.
              </p>

            </div>

            <div className="relative rounded-3xl overflow-hidden border border-white/10 bg-dh-panel shadow-2xl">

              {videoTutorial ? (

                <div className="bg-black">
                  <video
                    controls
                    playsInline
                    preload="metadata"
                    className="w-full h-auto max-h-[720px] mx-auto"
                    aria-label="Tutorial de inscripción DHTime"
                  >
                    <source src={videoTutorial} type="video/mp4" />
                    Tu navegador no soporta la reproducción de video.
                  </video>
                </div>

              ) : (

                <div className="aspect-video flex flex-col items-center justify-center text-center p-8">

                  <div className="w-20 h-20 rounded-full bg-dh-purple/10 flex items-center justify-center mb-6">
                    <PlayCircleIcon className="w-12 h-12 text-dh-purpleLight" />
                  </div>

                  <h3 className="text-xl font-bold mb-3">
                    Tutorial próximamente
                  </h3>

                  <p className="text-white/40 max-w-md text-sm">
                    Estamos preparando un video donde
                    te mostraremos cómo realizar tu
                    inscripción en DHTime.
                  </p>

                </div>

              )}

            </div>

          </div>
        </section>

        {/* ================================= */}
        {/* FAQ */}
        {/* ================================= */}

        <section
          id="faq"
          className="max-w-6xl mx-auto px-6 py-20 scroll-mt-24"
        >

          <div className="text-center mb-14">

            <div className="inline-flex items-center gap-2 text-dh-purpleLight text-sm font-bold uppercase tracking-widest mb-4">
              <QuestionMarkCircleIcon className="w-5 h-5" />
              Centro de respuestas
            </div>

            <h2 className="text-3xl md:text-4xl font-black">
              Preguntas frecuentes
            </h2>

            <p className="text-white/45 mt-4">
              Encuentra respuestas rápidas a las
              dudas más comunes.
            </p>

          </div>

          <div className="grid md:grid-cols-[240px_1fr] gap-8">

            {/* CATEGORÍAS */}

            <div className="flex md:flex-col gap-2 overflow-x-auto pb-3 md:pb-0">

              {preguntasFrecuentes.map((cat) => {

                const Icon = cat.icono;

                return (
                  <button
                    key={cat.categoria}
                    onClick={() => {
                      setCategoriaActiva(cat.categoria);
                      setPreguntaAbierta(null);
                    }}
                    className={`flex items-center gap-3 shrink-0 text-left px-5 py-4 rounded-xl transition ${
                      categoriaActiva === cat.categoria
                        ? "bg-dh-purple/15 border border-dh-purple/40 text-white"
                        : "bg-dh-panel border border-white/5 text-white/50 hover:text-white"
                    }`}
                  >
                    <Icon className="w-5 h-5 shrink-0" />

                    <span className="text-sm font-semibold">
                      {cat.categoria}
                    </span>
                  </button>
                );
              })}

            </div>

            {/* PREGUNTAS */}

            <div className="space-y-3">

              {categoriaSeleccionada?.preguntas.map(
                (item, index) => {

                  const id = `${categoriaActiva}-${index}`;

                  const abierta = preguntaAbierta === id;

                  return (
                    <div
                      key={id}
                      className="rounded-2xl bg-dh-panel border border-white/5 overflow-hidden hover:border-white/10 transition"
                    >

                      <button
                        onClick={() =>
                          setPreguntaAbierta(
                            abierta ? null : id
                          )
                        }
                        className="w-full flex items-center justify-between gap-4 text-left p-5 md:p-6"
                      >

                        <span className="font-semibold text-sm md:text-base">
                          {item.pregunta}
                        </span>

                        <ChevronDownIcon
                          className={`w-5 h-5 text-dh-purpleLight shrink-0 transition-transform ${
                            abierta ? "rotate-180" : ""
                          }`}
                        />

                      </button>

                      <AnimatePresence initial={false}>

                        {abierta && (

                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25 }}
                            className="overflow-hidden"
                          >

                            <div className="px-5 md:px-6 pb-6 text-sm text-white/50 leading-relaxed border-t border-white/5 pt-4">
                              {item.respuesta}
                            </div>

                          </motion.div>

                        )}

                      </AnimatePresence>

                    </div>
                  );
                }
              )}

            </div>

          </div>
        </section>

        {/* ================================= */}
        {/* CTA FINAL */}
        {/* ================================= */}

        <section className="px-6 pb-24">

          <div className="max-w-5xl mx-auto relative overflow-hidden rounded-3xl border border-dh-purple/20 bg-gradient-to-br from-dh-purple/20 to-dh-panel p-10 md:p-14 text-center">

            <div className="absolute w-64 h-64 bg-dh-purple/20 blur-[100px] rounded-full -top-20 -right-20" />

            <div className="relative">

              <div className="w-16 h-16 rounded-2xl bg-dh-purple/20 flex items-center justify-center mx-auto mb-6">
                <LifebuoyIcon className="w-9 h-9 text-dh-purpleLight" />
              </div>

              <h2 className="text-2xl md:text-4xl font-black mb-4">
                ¿No encontraste lo que buscabas?
              </h2>

              <p className="text-white/50 max-w-xl mx-auto mb-8">
                No te preocupes. Nuestro equipo de
                soporte está listo para ayudarte.
              </p>

              <button
                onClick={() =>
                  abrirWhatsApp(
                    whatsappPrincipal,
                    SOPORTE.mensajeInicial
                  )
                }
                className="px-8 py-4 rounded-full bg-gradient-to-r from-dh-purple to-dh-purpleLight font-bold hover:scale-105 transition shadow-[0_0_30px_rgba(126,87,194,0.3)]"
              >
                Hablar con soporte
              </button>

            </div>
          </div>
        </section>

      </main>
    </>
  );
}
