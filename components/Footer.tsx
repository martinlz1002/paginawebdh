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
    <footer className="bg-gray-800 text-gray-300 py-10">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8 px-4">
        {/* Sobre nosotros */}
        <div>
          <h3 className="text-white font-semibold mb-3 flex items-center space-x-2">
            <UsersIcon className="w-5 h-5" />
            <span>Nosotros</span>
          </h3>
          <p className="text-sm">
            Conoce más sobre nuestra misión, visión y los valores que nos
            impulsan a organizar las mejores carreras.
          </p>
          <Link href="/nosotros">
            <a className="mt-2 inline-block text-purple-400 hover:underline text-sm">
              Leer más →
            </a>
          </Link>
        </div>

        {/* Navegación */}
        <div>
          <h3 className="text-white font-semibold mb-3">Enlaces</h3>
          <ul className="space-y-2 text-sm">
            <li>
              <Link href="/">
                <a className="hover:text-white">Inicio</a>
              </Link>
            </li>
            <li>
              <Link href="/carreras">
                <a className="hover:text-white">Carreras</a>
              </Link>
            </li>
            <li>
              <Link href="/mis-inscripciones">
                <a className="hover:text-white">Mis Inscripciones</a>
              </Link>
            </li>
            <li>
              <Link href="/perfil">
                <a className="hover:text-white">Perfil</a>
              </Link>
            </li>
          </ul>
        </div>

        {/* Políticas */}
        <div>
          <h3 className="text-white font-semibold mb-3">Legal</h3>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center space-x-2">
              <DocumentTextIcon className="w-5 h-5" />
              <Link href="/aviso-privacidad">
                <a className="hover:text-white">Aviso de privacidad</a>
              </Link>
            </li>
            <li className="flex items-center space-x-2">
              <DocumentTextIcon className="w-5 h-5" />
              <Link href="/politicas-cancelacion">
                <a className="hover:text-white">Políticas de cancelación</a>
              </Link>
            </li>
          </ul>
        </div>

        {/* Contacto & redes */}
        <div>
          <h3 className="text-white font-semibold mb-3">Contacto</h3>
          <p className="flex items-center space-x-2 text-sm mb-2">
            <PhoneIcon className="w-5 h-5" />
            <span>+52 55 1234 5678</span>
          </p>
          <p className="flex items-center space-x-2 text-sm mb-4">
            <WhatsappIcon className="w-5 h-5 text-green-400" />
            <a
              href="https://wa.me/525512345678"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white"
            >
              WhatsApp
            </a>
          </p>
          <div className="flex space-x-4 text-2xl">
            <Link href="https://facebook.com/tuempresa">
              <a target="_blank" className="hover:text-white">
                <FacebookIcon />
              </a>
            </Link>
            <Link href="https://instagram.com/tuempresa">
              <a target="_blank" className="hover:text-white">
                <InstagramIcon />
              </a>
            </Link>
            <Link href="https://twitter.com/tuempresa">
              <a target="_blank" className="hover:text-white">
                <TwitterIcon />
              </a>
            </Link>
          </div>
        </div>
      </div>

      <div className="mt-10 text-center text-gray-500 text-xs">
        © {new Date().getFullYear()} DHTime S.A. de C.V. Todos los derechos
        reservados.
      </div>
    </footer>
  );
}