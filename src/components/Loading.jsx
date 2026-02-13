export function LoadingSpinner({ size = "md", message = "Carregando..." }) {
  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-16 h-16",
    lg: "w-24 h-24",
  };

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-12">
      <div className="relative">
        {/* Outer ring */}
        <div className={`${sizeClasses[size]} spinner border-4`}></div>

        {/* Inner decoration */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-2xl animate-bounce">🧸</div>
        </div>
      </div>

      {message && (
        <p className="text-gray-600 font-medium animate-pulse">{message}</p>
      )}
    </div>
  );
}

export function PageLoader() {
  return (
    <div className="min-h-screen bg-[#62A1D9] flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-lg text-center p-8 border border-[#24094E]">
        <div className="relative inline-block mb-6">
          <div className="w-20 h-20 spinner border-4 border-[#62A1D9]"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-3xl animate-bounce text-[#733D38]">🧸</div>
          </div>
        </div>
        <h2 className="text-2xl font-bold mb-2 text-[#24094E]">
          <span>StarBox</span>
        </h2>
        <p className="text-[#A6806A] animate-pulse">
          Carregando seu sistema...
        </p>
      </div>
    </div>
  );
}

export function EmptyState({
  icon = "📦",
  title,
  description,
  message,
  action,
}) {
  return (
    <div className="bg-white rounded-xl shadow-lg text-center py-12 border border-[#62A1D9]">
      <div className="text-6xl mb-4 text-[#733D38]">{icon}</div>
      <h3 className="text-xl font-bold text-[#24094E] mb-2">{title}</h3>
      <p className="text-[#A6806A] mb-6">{description || message}</p>
      {action && (
        <div>
          {typeof action === "object" && action.label ? (
            <button
              onClick={action.onClick}
              className="bg-[#733D38] hover:bg-[#A6806A] text-white font-semibold px-4 py-2 rounded transition"
            >
              {action.label}
            </button>
          ) : (
            action
          )}
        </div>
      )}
    </div>
  );
}
