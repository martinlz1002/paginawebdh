import Link from "next/link";
import { UsersIcon, DocumentTextIcon, PhoneIcon } from "@heroicons/react/24/outline";
import {
  FaFacebook as FacebookIcon,
  FaInstagram as InstagramIcon,
  FaTwitter as TwitterIcon,
  FaWhatsapp as WhatsappIcon,
} from "react-icons/fa";

export default function Footer() {
  return (
    <footer className="mt-10 border-t border-white/10 bg-dh-dark/95 text-white/70">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8 px-4 py-10">
        {/* Sobre nosotros */}
        <div>
          <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
            <UsersIcon className="w-5 h-5 text-dh-green" />
            <span>Nosotros</span>
          </h3>
          <p className="text-sm text-white/70">
            Conoce más sobre nuestra misión, visión y los valores que nos impulsan a organizar las
            mejores carreras.
          </p>
          <Link href="/nosotros" className="mt-2 inline-block text-dh-green hover:underline text-sm">
            Leer más →
          </Link>
        </div>

        {/* Navegación */}
        <div>
          <h3 className="text-white font-semibold mb-3">Enlaces</h3>
          <ul className="space-y-2 text-sm">
            <li>
              <Link href="/" className="hover:text-white transition">
                Inicio
              </Link>
            </li>
            <li>
              <Link href="/mis-inscripciones" className="hover:text-white transition">
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

        {/* Políticas */}
        <div>
          <h3 className="text-white font-semibold mb-3">Legal</h3>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center gap-2">
              <DocumentTextIcon className="w-5 h-5 text-dh-purple/80" />
              <Link href="/aviso-privacidad" className="hover:text-white transition">
                Aviso de privacidad
              </Link>
            </li>
            <li className="flex items-center gap-2">
              <DocumentTextIcon className="w-5 h-5 text-dh-purple/80" />
              <Link href="/politicas-cancelacion" className="hover:text-white transition">
                Políticas de cancelación
              </Link>
            </li>
          </ul>
        </div>

        {/* Contacto & redes */}
        <div>
          <h3 className="text-white font-semibold mb-3">Contacto</h3>

          <p className="flex items-center gap-2 text-sm mb-2">
            <PhoneIcon className="w-5 h-5 text-white/70" />
            <span className="text-white/70">+52 66 8820 7434</span>
          </p>

          <p className="flex items-center gap-2 text-sm mb-4">
            <WhatsappIcon className="w-5 h-5 text-dh-green" />
            <a
              href="https://wa.me/526688207434"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition"
            >
              WhatsApp
            </a>
          </p>

          <div className="flex gap-4 text-2xl">
            <a
              href="https://facebook.com/tuempresa"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition"
              aria-label="Facebook"
            >
              <FacebookIcon />
            </a>
            <a
              href="https://www.instagram.com/dhtimelm/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition"
              aria-label="Instagram"
            >
              <InstagramIcon />
            </a>
            <a
              href="https://twitter.com/tuempresa"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition"
              aria-label="Twitter"
            >
              <TwitterIcon />
            </a>
          </div>

          <div className="mt-4 h-px w-full bg-gradient-to-r from-dh-purple/40 to-dh-green/40" />
          <p className="mt-3 text-xs text-white/50">
            Soporte y cronometraje DHTime 🟣🟢
          </p>
        </div>
      </div>

      <div className="text-center text-white/40 text-xs py-5 border-t border-white/10">
        © {new Date().getFullYear()} DHTime S.A. de C.V. Todos los derechos reservados.
      </div>
    </footer>
  );
}
