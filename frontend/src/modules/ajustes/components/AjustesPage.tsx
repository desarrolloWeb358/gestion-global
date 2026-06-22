import { useState } from "react";
import { Phone } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { obtenerClientes } from "@/modules/clientes/services/clienteService";
import { obtenerDeudorPorCliente, actualizarDeudorDatos } from "@/modules/cobranza/services/deudorService";

/* ── Utilidades de teléfonos (réplica de DeudoresTable) ─────────────────── */

function normalizarTelefono(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("57")) digits = digits.slice(2);
  else if (digits.length === 13 && digits.startsWith("057")) digits = digits.slice(3);
  return digits;
}

function splitarNumerosLargos(digits: string): string[] {
  const result: string[] = [];
  let i = 0;
  while (i < digits.length) {
    const rem = digits.length - i;
    if (digits.startsWith("057", i) && rem >= 13) {
      result.push(digits.slice(i, i + 13)); i += 13;
    } else if (digits.startsWith("57", i) && rem >= 12) {
      result.push(digits.slice(i, i + 12)); i += 12;
    } else if (rem >= 10) {
      result.push(digits.slice(i, i + 10)); i += 10;
    } else {
      result.push(digits.slice(i)); break;
    }
  }
  return result;
}

function parsearTelefonosDeTexto(texto: string): string[] {
  const phones: string[] = [];
  const tryAdd = (raw: string) => {
    const n = normalizarTelefono(raw);
    if (n && !phones.includes(n)) phones.push(n);
  };
  const assembleAndAdd = (segment: string) => {
    const tokens = segment.trim().split(/\s+/);
    let acc = "";
    for (const token of tokens) {
      acc += token.replace(/\D/g, "");
      if (
        acc.length === 10 ||
        (acc.length === 12 && acc.startsWith("57")) ||
        (acc.length === 13 && acc.startsWith("057"))
      ) { tryAdd(acc); acc = ""; }
    }
    if (acc) {
      if (acc.length > 13) splitarNumerosLargos(acc).forEach(tryAdd);
      else tryAdd(acc);
    }
  };
  for (const segment of texto.split(/[,;/\n]+/)) {
    const digits = segment.replace(/\D/g, "");
    if (digits.length > 13) assembleAndAdd(segment);
    else tryAdd(segment);
  }
  return phones;
}

/* ── Tipos ─────────────────────────────────────────────────────────────── */

interface PhoneError {
  deudorId: string;
  deudorNombre: string;
  clienteId: string;
  clienteNombre: string;
  telefonoOriginal: string;
  telefonosCorregidos: string[];
}

/* ── Componente ─────────────────────────────────────────────────────────── */

export default function AjustesPage() {
  const [analizando, setAnalizando] = useState(false);
  const [ajustando, setAjustando] = useState(false);
  const [progreso, setProgreso] = useState("");
  const [errores, setErrores] = useState<PhoneError[] | null>(null);
  const [resultadoAjuste, setResultadoAjuste] = useState<{ ok: number; fail: number } | null>(null);

  const analizar = async () => {
    setAnalizando(true);
    setErrores(null);
    setResultadoAjuste(null);
    setProgreso("Cargando clientes...");

    try {
      const clientes = await obtenerClientes();
      const encontrados: PhoneError[] = [];

      for (const cliente of clientes) {
        if (!cliente.id) continue;
        setProgreso(`Analizando: ${cliente.nombre ?? cliente.id}`);

        const deudores = await obtenerDeudorPorCliente(cliente.id);
        for (const deudor of deudores) {
          for (const tel of deudor.telefonos ?? []) {
            const normalizado = normalizarTelefono(tel);
            if (normalizado.length !== 10) {
              const corregidos = parsearTelefonosDeTexto(tel).filter(t => t.length === 10);
              encontrados.push({
                deudorId: deudor.id!,
                deudorNombre: deudor.nombre,
                clienteId: cliente.id,
                clienteNombre: cliente.nombre ?? cliente.id,
                telefonoOriginal: tel,
                telefonosCorregidos: corregidos,
              });
            }
          }
        }
      }

      setErrores(encontrados);
    } catch (e: any) {
      setProgreso(`Error: ${e?.message}`);
    } finally {
      setAnalizando(false);
      setProgreso("");
    }
  };

  const ajustar = async () => {
    if (!errores?.length) return;
    setAjustando(true);
    setResultadoAjuste(null);

    // Agrupar errores por deudor
    const porDeudor = new Map<string, { clienteId: string; deudorId: string; clienteNombre: string }>();
    for (const e of errores) {
      porDeudor.set(`${e.clienteId}/${e.deudorId}`, {
        clienteId: e.clienteId,
        deudorId: e.deudorId,
        clienteNombre: e.clienteNombre,
      });
    }

    // Re-leer teléfonos actuales y construir lista corregida
    let ok = 0;
    let fail = 0;

    for (const { clienteId, deudorId } of porDeudor.values()) {
      try {
        const deudores = await obtenerDeudorPorCliente(clienteId);
        const deudor = deudores.find(d => d.id === deudorId);
        if (!deudor) continue;

        const telefonosActuales = deudor.telefonos ?? [];
        const nuevos: string[] = [];

        for (const tel of telefonosActuales) {
          const normalizado = normalizarTelefono(tel);
          if (normalizado.length === 10) {
            if (!nuevos.includes(normalizado)) nuevos.push(normalizado);
          } else {
            const corregidos = parsearTelefonosDeTexto(tel).filter(t => t.length === 10);
            if (corregidos.length > 0) {
              for (const c of corregidos) {
                if (!nuevos.includes(c)) nuevos.push(c);
              }
            } else {
              // Sin corrección automática → conservar el original sin tocar
              if (!nuevos.includes(tel)) nuevos.push(tel);
            }
          }
        }

        await actualizarDeudorDatos(clienteId, deudorId, { telefonos: nuevos });
        ok++;
      } catch {
        fail++;
      }
    }

    setAjustando(false);
    setResultadoAjuste({ ok, fail });
    setErrores(null);
  };

  return (
    <div className="flex h-full min-h-[calc(100vh-4rem)] bg-background">
      {/* Menú izquierdo */}
      <aside className="w-56 border-r bg-sidebar flex-shrink-0 p-4 space-y-1">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-2">
          Ajustes
        </p>
        <button
          className="w-full text-left flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium bg-brand-primary/10 text-brand-primary"
        >
          <Phone className="h-4 w-4 flex-shrink-0" />
          Teléfonos de deudores
        </button>
      </aside>

      {/* Contenido */}
      <main className="flex-1 p-6 overflow-auto">
        <div className="max-w-5xl space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-brand-primary">Ajustar números de teléfono</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Revisa todos los deudores de todos los clientes y detecta teléfonos inválidos: números de más de 10 dígitos,
              números concatenados, prefijos 57/057. Luego corrígelos con un clic.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={analizar}
              disabled={analizando || ajustando}
              variant="outline"
              className="gap-2"
            >
              <Phone className="h-4 w-4" />
              {analizando ? "Analizando..." : "Analizar teléfonos"}
            </Button>

            {errores && errores.length > 0 && errores.some(e => e.telefonosCorregidos.length > 0) && (
              <Button
                onClick={ajustar}
                disabled={ajustando}
                variant="brand"
                className="gap-2"
              >
                {ajustando
                  ? "Ajustando..."
                  : `Ajustar ${errores.filter(e => e.telefonosCorregidos.length > 0).length} de ${errores.length} inconsistencias`}
              </Button>
            )}
          </div>

          {progreso && (
            <p className="text-sm text-muted-foreground animate-pulse">{progreso}</p>
          )}

          {resultadoAjuste && (
            <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
              Ajuste completado — {resultadoAjuste.ok} deudores corregidos
              {resultadoAjuste.fail > 0 && `, ${resultadoAjuste.fail} con error`}.
            </div>
          )}

          {errores !== null && errores.length === 0 && (
            <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
              No se encontraron teléfonos con inconsistencias.
            </div>
          )}

          {errores && errores.length > 0 && (
            <div className="rounded-lg border overflow-hidden">
              <div className="bg-muted/30 px-4 py-2 text-xs font-medium text-muted-foreground border-b">
                {errores.length} inconsistencia{errores.length !== 1 ? "s" : ""} encontrada{errores.length !== 1 ? "s" : ""}
              </div>
              <table className="w-full text-sm">
                <thead className="bg-muted/20">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Cliente</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Deudor</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Teléfono con error</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Se corregirá a</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {errores.map((e, i) => (
                    <tr key={i} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 text-muted-foreground">{e.clienteNombre}</td>
                      <td className="px-4 py-3 font-medium">{e.deudorNombre}</td>
                      <td className="px-4 py-3">
                        <code className="rounded bg-red-50 px-1.5 py-0.5 text-xs text-red-700">
                          {e.telefonoOriginal}
                        </code>
                        <span className="ml-1.5 text-xs text-muted-foreground">
                          ({e.telefonoOriginal.replace(/\D/g, "").length} dígitos)
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {e.telefonosCorregidos.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {e.telefonosCorregidos.map((c, j) => (
                              <code key={j} className="rounded bg-green-50 px-1.5 py-0.5 text-xs text-green-700">
                                {c}
                              </code>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs italic text-muted-foreground">
                            Sin corrección automática disponible
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
