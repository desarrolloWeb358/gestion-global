// src/modules/cobranza/components/deudor/ContactoTagInputs.tsx
// Inputs de chips para correos y teléfonos del deudor.
// Fuente única: los usan tanto DeudoresTable como DeudorDetailPage.
import React, { useState } from "react";
import { X } from "lucide-react";


export function normalizarTelefono(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("57")) digits = digits.slice(2);
  else if (digits.length === 13 && digits.startsWith("057")) digits = digits.slice(3);
  return digits;
}

// Divide una cadena de dígitos larga en chunks válidos (057+10, 57+10, o 10 dígitos).
// Cada chunk luego pasa por normalizarTelefono que elimina el prefijo, quedando siempre en 10 dígitos.
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

// Parsea uno o varios teléfonos desde un texto libre (separadores: coma, punto y coma, barra, salto de línea, o espacio cuando hay múltiples)
export function parsearTelefonosDeTexto(texto: string): string[] {
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
  for (const segment of texto.split(/[,;\/\n]+/)) {
    const digits = segment.replace(/\D/g, "");
    if (digits.length > 13) assembleAndAdd(segment);
    else tryAdd(segment);
  }
  return phones;
}

export function parsearCorreosDeTexto(texto: string): string[] {
  const correos: string[] = [];
  for (const raw of texto.split(/[,;\/\n\s]+/)) {
    const e = raw.trim().toLowerCase();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && !correos.includes(e))
      correos.push(e);
  }
  return correos;
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Separa el texto del input en correos individuales SIN descartar los inválidos,
 *  para que el usuario pueda seguir escribiendo (la validación va al guardar). */
export function separarCorreos(texto: string): string[] {
  const correos: string[] = [];
  for (const raw of texto.split(/[\s,;\/]+/)) {
    const e = raw.trim().toLowerCase();
    if (e && !correos.includes(e)) correos.push(e);
  }
  return correos;
}

export function PhoneTagInput({
  value,
  onChange,
  readOnly,
  disabled,
}: {
  value: string[];
  onChange: (phones: string[]) => void;
  readOnly?: boolean;
  disabled?: boolean;
}) {
  const [input, setInput] = useState("");

  const addPhone = (raw: string) => {
    const normalized = normalizarTelefono(raw.trim());
    if (!normalized || value.includes(normalized)) return;
    onChange([...value, normalized]);
  };

  const removePhone = (idx: number) => {
    onChange(value.filter((_, i) => i !== idx));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === "," || e.key === ";" || e.key === "Tab") {
      e.preventDefault();
      addPhone(input);
      setInput("");
    } else if (e.key === "Backspace" && input === "" && value.length > 0) {
      removePhone(value.length - 1);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text");
    const parsed = parsearTelefonosDeTexto(pasted);
    const toAdd = parsed.filter((p) => !value.includes(p));
    onChange([...value, ...toAdd]);
    setInput("");
  };

  return (
    <div className="mt-1.5 min-h-[42px] flex flex-wrap gap-1.5 rounded-md border border-brand-secondary/30 bg-white px-2 py-1.5 focus-within:border-brand-primary focus-within:ring-2 focus-within:ring-brand-primary/20 transition-colors">
      {value.map((phone, idx) => (
        <span
          key={idx}
          className="inline-flex items-center gap-1 rounded-full bg-brand-primary/10 px-2.5 py-0.5 text-sm font-medium text-brand-secondary"
        >
          {phone}
          {!readOnly && !disabled && (
            <button
              type="button"
              onClick={() => removePhone(idx)}
              className="rounded-full hover:bg-brand-primary/20 p-0.5"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </span>
      ))}
      {!readOnly && !disabled && (
        <input
          type="text"
          inputMode="numeric"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onBlur={() => { if (input.trim()) { addPhone(input); setInput(""); } }}
          placeholder={value.length === 0 ? "3001234567 — Enter o coma para agregar" : ""}
          className="flex-1 min-w-[200px] bg-transparent outline-none text-sm placeholder:text-muted-foreground"
        />
      )}
    </div>
  );
}

export function EmailTagInput({
  value,
  onChange,
  readOnly,
  disabled,
}: {
  value: string[];
  onChange: (correos: string[]) => void;
  readOnly?: boolean;
  disabled?: boolean;
}) {
  const [input, setInput] = useState("");

  const addCorreos = (raw: string) => {
    const nuevos = separarCorreos(raw).filter((c) => !value.includes(c));
    if (nuevos.length === 0) return;
    onChange([...value, ...nuevos]);
  };

  const removeCorreo = (idx: number) => {
    onChange(value.filter((_, i) => i !== idx));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === "," || e.key === ";" || e.key === " " || e.key === "Tab") {
      if (e.key === "Tab" && input.trim() === "") return; // Tab sin texto: seguir navegando
      e.preventDefault();
      addCorreos(input);
      setInput("");
    } else if (e.key === "Backspace" && input === "" && value.length > 0) {
      removeCorreo(value.length - 1);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    addCorreos(e.clipboardData.getData("text"));
    setInput("");
  };

  return (
    <div className="mt-1.5 min-h-[42px] flex flex-wrap gap-1.5 rounded-md border border-brand-secondary/30 bg-white px-2 py-1.5 focus-within:border-brand-primary focus-within:ring-2 focus-within:ring-brand-primary/20 transition-colors">
      {value.map((correo, idx) => {
        const invalido = !EMAIL_RE.test(correo);
        return (
          <span
            key={idx}
            title={invalido ? "Correo con formato inválido" : correo}
            className={
              invalido
                ? "inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-sm font-medium text-red-600 ring-1 ring-red-300"
                : "inline-flex items-center gap-1 rounded-full bg-brand-primary/10 px-2.5 py-0.5 text-sm font-medium text-brand-secondary"
            }
          >
            {correo}
            {!readOnly && !disabled && (
              <button
                type="button"
                onClick={() => removeCorreo(idx)}
                className={invalido ? "rounded-full hover:bg-red-100 p-0.5" : "rounded-full hover:bg-brand-primary/20 p-0.5"}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </span>
        );
      })}
      {!readOnly && !disabled && (
        <input
          type="text"
          inputMode="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onBlur={() => { if (input.trim()) { addCorreos(input); setInput(""); } }}
          placeholder={value.length === 0 ? "correo@example.com — Enter o coma para agregar" : ""}
          className="flex-1 min-w-[220px] bg-transparent outline-none text-sm placeholder:text-muted-foreground"
        />
      )}
    </div>
  );
}
