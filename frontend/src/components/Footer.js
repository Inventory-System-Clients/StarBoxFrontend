import React from 'react';

export default function Footer() {
  return (
    <footer className="bg-white/80 backdrop-blur-md border-t border-purple-100 mt-auto" data-testid="main-footer">
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
              <span className="text-white font-bold">SB</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">Star Box</p>
              <p className="text-xs text-gray-500">Gerenciamento de Contas</p>
            </div>
          </div>

          <div className="text-center md:text-left">
            <p className="text-sm text-gray-600">Contato: contato@starbox.com.br</p>
            <p className="text-sm text-gray-600">Telefone: (11) 1234-5678</p>
          </div>

          <div className="text-center md:text-right">
            <p className="text-xs text-gray-500">
              © {new Date().getFullYear()} Star Box. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
