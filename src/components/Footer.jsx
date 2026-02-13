import { Link } from "react-router-dom";

export function Footer() {
  return (
    <footer className="bg-[#62A1D9] text-white mt-12 border-t-4 border-[#24094E]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Branding */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-gradient-to-br from-primary to-accent-yellow p-2 rounded-lg shadow-md">
                <svg
                  className="w-6 h-6 text-white"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" />
                </svg>
              </div>
              <span className="text-xl font-bold text-[#24094E]">StarBox</span>
            </div>
            <p className="text-[#24094E]/80 text-sm leading-relaxed">
              Sistema de gestão de estoque StarBox. Controle eficiente e moderno para seu negócio.
            </p>
          </div>

          {/* Links Rápidos */}
          <div>
            <h3 className="text-lg font-bold mb-4 text-[#24094E]">
              Links Rápidos
            </h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  to="/"
                  className="text-white hover:text-[#24094E] transition-colors flex items-center gap-2 group"
                >
                  <span className="w-1.5 h-1.5 bg-[#24094E] rounded-full group-hover:scale-125 transition-transform"></span>
                  Dashboard
                </Link>
              </li>
              <li>
                <Link
                  to="/movimentacoes"
                  className="text-white hover:text-[#24094E] transition-colors flex items-center gap-2 group"
                >
                  <span className="w-1.5 h-1.5 bg-[#24094E] rounded-full group-hover:scale-125 transition-transform"></span>
                  Movimentações
                </Link>
              </li>
              <li>
                <Link
                  to="/maquinas"
                  className="text-white hover:text-[#24094E] transition-colors flex items-center gap-2 group"
                >
                  <span className="w-1.5 h-1.5 bg-[#24094E] rounded-full group-hover:scale-125 transition-transform"></span>
                  Máquinas
                </Link>
              </li>
            </ul>
          </div>

          {/* Informações de Contato */}
          <div>
            <h3 className="text-lg font-bold mb-4 text-[#24094E]">
              Informações
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-2 text-white">
                <EmailIcon />
                <span>suporte@selfmachine.com.br</span>
              </div>
              <div className="flex items-start gap-2 text-white">
                <PhoneIcon />
                <span>(11) 97117-9038</span>
              </div>
              <div className="flex items-start gap-2 text-white">
                <ClockIcon />
                <span>Suporte: Seg-Sex 9h-18h</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-8 pt-6 border-t border-[#24094E]/20">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-[#24094E]/70 text-sm">
              © 2026 Agarra Mais. Todos os direitos reservados. 🧸
            </p>
            <div className="flex items-center gap-4 text-sm text-[#24094E]/70">
              <span className="bg-white/20 px-2 py-1 rounded">Versão 1.0.0</span>
              <span className="w-1 h-1 bg-[#24094E]/30 rounded-full"></span>
              <span>Made by SelfMachine developers</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

// Ícones extraídos para limpeza do código
const EmailIcon = () => (
  <svg className="w-5 h-5 text-[#24094E] flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
    <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
    <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
  </svg>
);

const PhoneIcon = () => (
  <svg className="w-5 h-5 text-[#24094E] flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
    <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
  </svg>
);

const ClockIcon = () => (
  <svg className="w-5 h-5 text-[#24094E] flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
  </svg>
);