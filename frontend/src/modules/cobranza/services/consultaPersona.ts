export function construirConsulta(data: {
  identificacion: string;
  nombre1: string;
  nombre2: string;
  apellido1: string;
  apellido2: string;
}): string {
  const { identificacion, nombre1, nombre2, apellido1, apellido2 } = data;
  let consulta = '';

  if (identificacion) {
    consulta = `NESP=NESPselect u.val_direccion, u.num_telefono, u.num_telefono1, u.nom_correo_electronico, pr.nom_razon_social, pr.num_ident_vigente, pr.nom_primer_nombre, pr.nom_otros_nombres, pr.nom_primer_apellido, pr.nom_segundo_apellido from mas_personas_rut pr, mas_mascaras_rut mr, mas_ubicaciones u where pr.ide_persona_rut = mr.ide_mascara_rut and mr.ide_persona_rut = u.ide_persona_rut and pr.num_ident_vigente = '${identificacion}'`;
  } else {
    consulta = `NESP=NESPselect pr.num_ident_vigente, pr.nom_primer_nombre, pr.nom_otros_nombres, pr.nom_primer_apellido, pr.nom_segundo_apellido, u.val_direccion, u.num_telefono, u.num_telefono1, u.nom_correo_electronico from mas_personas_rut pr, mas_mascaras_rut mr, mas_ubicaciones u where pr.ide_persona_rut = mr.ide_mascara_rut and mr.ide_persona_rut = u.ide_persona_rut`;

    if (nombre1) consulta += ` and pr.nom_primer_nombre = '${nombre1.toUpperCase()}'`;
    if (nombre2) consulta += ` and pr.nom_otros_nombres = '${nombre2.toUpperCase()}'`;
    if (apellido1) consulta += ` and pr.nom_primer_apellido = '${apellido1.toUpperCase()}'`;
    if (apellido2) consulta += ` and pr.nom_segundo_apellido = '${apellido2.toUpperCase()}'`;

    consulta += ` order by pr.num_ident_vigente, pr.nom_primer_nombre, pr.nom_otros_nombres, pr.nom_primer_apellido, pr.nom_segundo_apellido`;
  }

  return consulta;
}

/*
export function extraerDatos(texto: string): string[][] {
  const ini = texto.indexOf('</form>[');
  if (ini === -1) return [];
 
  const parcial = texto.substring(ini + 8);
  const fin = parcial.indexOf(']');
  const datos = parcial.substring(3, fin);
 
  const filas = datos.split(', -#-');
  return filas.map(fila => {
    const limpio = fila.replace(/-#-/g, '---');
    return limpio.split('---');
  });
}
*/
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



