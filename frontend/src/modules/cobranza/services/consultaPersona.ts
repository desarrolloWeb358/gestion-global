


export function extraerDatos(texto: string): string[][] {
  const ini = texto.indexOf('</form>[');
  if (ini === -1) return [];

  const parcial = texto.substring(ini + 8);
  const fin = parcial.indexOf(']');
  const datos = parcial.substring(3, fin);

  const filas = datos.split(', -#-');
  const tablaCompleta = filas.map(fila => {
    const limpio = fila.replace(/-#-/g, '---');
    return limpio.split('---');
  });

  if (tablaCompleta.length === 0) return [];

  const decode = (txt: string) =>
    new DOMParser().parseFromString(txt, "text/html").documentElement.textContent || txt;

  const encabezados = tablaCompleta[0];
  const indices = {
    documento: encabezados.indexOf('NUM_IDENT_VIGENTE'),
    primerNombre: encabezados.indexOf('NOM_PRIMER_NOMBRE'),
    segundoNombre: encabezados.indexOf('NOM_OTROS_NOMBRES'),
    primerApellido: encabezados.indexOf('NOM_PRIMER_APELLIDO'),
    segundoApellido: encabezados.indexOf('NOM_SEGUNDO_APELLIDO'),
    correo: encabezados.indexOf('NOM_CORREO_ELECTRONICO'),
    telefono1: encabezados.indexOf('NUM_TELEFONO1'),
    telefono2: encabezados.indexOf('NUM_TELEFONO'),
    direccion: encabezados.indexOf('VAL_DIRECCION'),
  };

  const agrupado: Record<string, {
    nombre: string;
    correos: Set<string>;
    telefonos: Set<string>;
    direcciones: Set<string>;
  }> = {};

  tablaCompleta.slice(1).forEach(fila => {
    const doc = fila[indices.documento];
    if (!doc) return;

    const nombreCompleto = [
      fila[indices.primerNombre],
      fila[indices.segundoNombre],
      fila[indices.primerApellido],
      fila[indices.segundoApellido],
    ].filter(Boolean).map(decode).join(' ').trim();

    if (!agrupado[doc]) {
      agrupado[doc] = {
        nombre: nombreCompleto,
        correos: new Set(),
        telefonos: new Set(),
        direcciones: new Set(),
      };
    }

    if (fila[indices.correo]) agrupado[doc].correos.add(decode(fila[indices.correo]));
    if (fila[indices.telefono1]) agrupado[doc].telefonos.add(decode(fila[indices.telefono1]));
    if (fila[indices.telefono2]) agrupado[doc].telefonos.add(decode(fila[indices.telefono2]));
    if (fila[indices.direccion]) agrupado[doc].direcciones.add(decode(fila[indices.direccion]));
  });

  const headers = ['Documento', 'Nombre', 'Correo', 'Teléfono', 'Dirección'];
  const datosAgrupados = Object.entries(agrupado).map(([documento, info]) => ([
    documento,
    info.nombre,
    Array.from(info.correos).join('\n'),
    Array.from(info.telefonos).join('\n'),
    Array.from(info.direcciones).join('\n'),
  ]));

  return [headers, ...datosAgrupados];
}



