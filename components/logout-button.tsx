"use client";

import { logout } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { useTransition } from "react";

/**
 * Botón de logout — Client Component para poder usar el estado de carga.
 * Llama a la Server Action `logout` que invalida la sesión.
 */
export default function LogoutButton() {
  const [isPending, startTransition] = useTransition();

  return (
    <form
      action={() => {
        startTransition(async () => {
          await logout();
        });
      }}
    >
      <Button
        type="submit"
        disabled={isPending}
        variant="ghost"
        size="sm"
        className={[
          "w-full justify-start text-xs",
          "text-brand-cream/60 hover:text-brand-cream hover:bg-white/10",
          "disabled:opacity-50",
        ].join(" ")}
      >
        {isPending ? "Cerrando sesión..." : "Cerrar sesión"}
      </Button>
    </form>
  );
}
