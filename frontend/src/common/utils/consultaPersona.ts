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
      consulta = `NESP=NESPselect u.val_direccion, u.num_telefono, u.num_telefono1, u.nom_correo_electronico, pr.nom_razon_social, pr.num_ident_vigente from mas_personas_rut pr, mas_mascaras_rut mr, mas_ubicaciones u where pr.ide_persona_rut = mr.ide_mascara_rut and mr.ide_persona_rut = u.ide_persona_rut and pr.num_ident_vigente = '${identificacion}'`;
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
  