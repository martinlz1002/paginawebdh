import Link from "next/link";
import {
  UsersIcon,
  DocumentTextIcon,
  PhoneIcon,
} from "@heroicons/react/24/outline";
import {
  FaFacebook as FacebookIcon,
  FaInstagram as InstagramIcon,
  FaTwitter as TwitterIcon,
  FaWhatsapp as WhatsappIcon,
} from "react-icons/fa";

export default function Footer() {
  return (
    <footer className="relative bg-[#0c0c0f] text-white overflow-hidden">

      {/* Glow de fondo */}
      <div className="absolute inset-0 bg-gradient-to-br from-dh-purple/20 via-black to-dh-purple/20 blur-3xl opacity-30" />

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-20">

        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">

          {/* Marca */}
          <div className="space-y-6">
            <img
              src="/mi-logo.png"
              alt="DHTime"
              className="w-36 opacity-90"
            />
            <p className="text-white/70 text-sm leading-relaxed">
              Tecnología, precisión y pasión por el cronometraje deportivo.
              Cada segundo cuenta, cada meta importa.
            </p>
          </div>

          {/* Navegación */}
          <div>
            <h4 className="text-lg font-bold mb-6 text-white">Navegación</h4>
            <ul className="space-y-3 text-white/70 text-sm">
              <li>
                <Link href="/" className="hover:text-white transition">
                  Inicio
                </Link>
              </li>
              <li>
                <Link
                  href="/mis-inscripciones"
                  className="hover:text-white transition"
                >
                  Mis Inscripciones
                </Link>
              </li>
              <li>
                <Link href="/perfil" className="hover:text-white transition">
                  Perfil
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-lg font-bold mb-6 text-white">Legal</h4>
            <ul className="space-y-3 text-white/70 text-sm">
              <li className="flex items-center gap-2">
                <DocumentTextIcon className="w-4 h-4 text-dh-purple" />
                <Link
                  href="/aviso-privacidad"
                  className="hover:text-white transition"
                >
                  Aviso de privacidad
                </Link>
              </li>
              <li className="flex items-center gap-2">
                <DocumentTextIcon className="w-4 h-4 text-dh-purple" />
                <Link
                  href="/politicas-cancelacion"
                  className="hover:text-white transition"
                >
                  Políticas de cancelación
                </Link>
              </li>
            </ul>
          </div>

          {/* Contacto */}
          <div>
            <h4 className="text-lg font-bold mb-6 text-white">Contacto</h4>

            <p className="flex items-center gap-3 text-white/70 text-sm mb-3">
              <PhoneIcon className="w-4 h-4 text-white/70" />
              +52 66 8820 7434
            </p>

            <a
              href="https://wa.me/526683963132"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 text-white/70 hover:text-white transition text-sm mb-6"
            >
              <WhatsappIcon className="text-dh-purple text-lg" />
              WhatsApp directo
            </a>

            <div className="flex gap-5 text-2xl">
              <a
                href="https://facebook.com/tuempresa"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/50 hover:text-white hover:scale-110 transition"
                aria-label="Facebook"
              >
                <FacebookIcon />
              </a>

              <a
                href="https://www.instagram.com/dhtimelm/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/50 hover:text-white hover:scale-110 transition"
                aria-label="Instagram"
              >
                <InstagramIcon />
              </a>

              <a
                href="https://twitter.com/tuempresa"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/50 hover:text-white hover:scale-110 transition"
                aria-label="Twitter"
              >
                <TwitterIcon />
              </a>
            </div>
          </div>
        </div>

        {/* Separador elegante */}
        <div className="mt-16 h-px w-full bg-gradient-to-r from-dh-purple/40 via-white/10 to-dh-purple/40" />

        {/* Bottom */}
        <div className="mt-8 text-center text-white/40 text-xs">
          © {new Date().getFullYear()} DHTime S.A. de C.V.  
          <span className="block mt-2 text-white/30">
            Precisión en cada meta.
          </span>
        </div>

      </div>
    </footer>
  );
}
