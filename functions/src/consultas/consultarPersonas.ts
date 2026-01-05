

import fetch from 'node-fetch';


export const consultarPersonasService = async (formData: {
  identificacion: string;
  nombre1: string;
  nombre2: string;
  apellido1: string;
  apellido2: string;
}) => {
  const { identificacion, nombre1, nombre2, apellido1, apellido2 } = formData;
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

  console.log("Consulta construida:", consulta);

  const response = await fetch("https://muisca.dian.gov.co/WebArancel/DefConsultaNomenclaturaPorCriterio.faces", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: consulta,
  });

  const text = await response.text();
  return text;
};

