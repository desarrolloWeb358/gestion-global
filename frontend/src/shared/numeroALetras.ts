// Utilidad para convertir números a palabras en español (solo enteros, hasta miles de millones)
const UNIDADES = [
  "", "UNO", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE",
  "DIEZ", "ONCE", "DOCE", "TRECE", "CATORCE", "QUINCE", "DIECISÉIS", "DIECISIETE",
  "DIECIOCHO", "DIECINUEVE", "VEINTE"
];
const DECENAS = [
  "", "", "VEINTE", "TREINTA", "CUARENTA", "CINCUENTA",
  "SESENTA", "SETENTA", "OCHENTA", "NOVENTA"
];
// Aquí cambiamos "CIEN" por "CIENTO" en el índice 1
const CENTENAS = [
  "", "CIENTO", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS",
  "QUINIENTOS", "SEISCIENTOS", "SETECIENTOS", "OCHOCIENTOS", "NOVECIENTOS"
];

function numeroALetras(num: number): string {
  if (num === 0) return "CERO";
  if (num < 0) return "MENOS " + numeroALetras(Math.abs(num));

  let palabras = "";

  // MILES DE MILLONES
  if (num >= 1_000_000_000) {
    const milesDeMillones = Math.floor(num / 1_000_000_000);
    // Singular y plural
    palabras += milesDeMillones === 1
      ? "MIL MILLONES "
      : numeroALetras(milesDeMillones) + " MIL MILLONES ";
    num %= 1_000_000_000;
  }

  // MILLONES
  if (num >= 1_000_000) {
    const millones = Math.floor(num / 1_000_000);
    palabras += millones === 1
      ? "UN MILLÓN "
      : numeroALetras(millones) + " MILLONES ";
    num %= 1_000_000;
  }

  // MILES
  if (num >= 1000) {
    const miles = Math.floor(num / 1000);
    palabras += miles === 1
      ? "MIL "
      : numeroALetras(miles) + " MIL ";
    num %= 1000;
  }

  // CENTENAS
  if (num >= 100) {
    if (num === 100) {
      palabras += "CIEN ";
      num = 0;
    } else {
      const c = Math.floor(num / 100);
      palabras += CENTENAS[c] + " ";
      num %= 100;
    }
  }

  // DECENAS y UNIDADES
  if (num > 20) {
    const d = Math.floor(num / 10);
    palabras += DECENAS[d];
    if (num % 10 !== 0) {
      palabras += " Y " + UNIDADES[num % 10];
    }
  } else if (num > 0) {
    palabras += UNIDADES[num];
  }

  return palabras.trim();
}

export default numeroALetras;
