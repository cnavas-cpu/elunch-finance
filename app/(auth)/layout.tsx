/**
 * Layout del grupo (auth) — solo para /login.
 * Fondo crema de la marca, centrado verticalmente.
 * No tiene sidebar ni navegación.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-brand-cream flex flex-col items-center justify-center p-4">
      {children}
    </div>
  );
}
