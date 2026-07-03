#!/usr/bin/env node

/**
 * Script de migración: Corregir honorariosRecaudo con la fórmula correcta
 *
 * FÓRMULA CORRECTA:
 * El recaudo ya incluye Capital + Honorarios
 * Honorarios del Recaudo = Recaudo × (% / (100 + %))
 *
 * PROCESO:
 * 1. Recorre todos los clientes
 * 2. De cada cliente recorre todos los deudores
 * 3. De cada deudor recorre todos los estados mensuales
 * 4. Si el estado mensual tiene recaudo, recalcula honorariosRecaudo
 * 5. Solo actualiza, no toca nada más
 *
 * USO:
 * node migrar-honorarios-recaudo-correcto.js
 */

const admin = require('firebase-admin');

// Cargar credenciales de servicio
let serviceAccount;
try {
  serviceAccount = require('./serviceAccountKey.json');
} catch (e) {
  console.error('❌ No se encontró el archivo de credenciales: serviceAccountKey.json');
  console.error('   Copia el archivo de credenciales a esta carpeta:');
  console.error('   copy c:\\keys\\serviceAccountGestionGlobal.json .\\serviceAccountKey.json');
  process.exit(1);
}

// Inicializar Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'gestionglobal-9eac8',
});

const db = admin.firestore();

async function migrarHonorariosRecaudo() {
  console.log('🚀 Iniciando migración de honorariosRecaudo...\n');

  let totalProcesados = 0;
  let totalActualizados = 0;
  let totalErrores = 0;
  let clientesProcesados = 0;

  try {
    // Obtener todos los clientes
    const clientesSnap = await db.collection('clientes').get();
    console.log(`📋 Encontrados ${clientesSnap.size} clientes\n`);

    for (const clienteDoc of clientesSnap.docs) {
      const clienteId = clienteDoc.id;
      const clienteNombre = clienteDoc.data().nombre || clienteId;
      clientesProcesados++;

      console.log(`\n👤 [${clientesProcesados}/${clientesSnap.size}] Cliente: ${clienteNombre} (${clienteId})`);

      try {
        // Obtener todos los deudores del cliente
        const deudoresSnap = await db.collection(`clientes/${clienteId}/deudores`).get();
        let deudoresConCambios = 0;

        for (const deudorDoc of deudoresSnap.docs) {
          const deudorId = deudorDoc.id;
          const deudorNombre = deudorDoc.data().nombre || deudorId;

          try {
            // Obtener todos los estados mensuales del deudor
            const estadosSnap = await db
              .collection(`clientes/${clienteId}/deudores/${deudorId}/estadosMensuales`)
              .get();

            for (const estadoDoc of estadosSnap.docs) {
              totalProcesados++;
              const estadoId = estadoDoc.id;
              const estadoData = estadoDoc.data();

              // Solo procesar si hay recaudo
              const recaudo = Number(estadoData.recaudo ?? 0);
              if (recaudo <= 0) {
                continue; // Saltar si no hay recaudo
              }

              const porcentajeHonorarios = Number(estadoData.porcentajeHonorarios ?? 15);
              const honorariosRecaudoActual = Number(estadoData.honorariosRecaudo ?? 0);

              // Calcular nuevo honorariosRecaudo con la fórmula correcta
              // Honorarios = Recaudo × (% / (100 + %))
              const nuevoHonorariosRecaudo = Math.round(recaudo * (porcentajeHonorarios / (100 + porcentajeHonorarios)));

              // Solo actualizar si el valor cambió
              if (nuevoHonorariosRecaudo !== honorariosRecaudoActual) {
                const diferencia = nuevoHonorariosRecaudo - honorariosRecaudoActual;
                console.log(`   ✏️  ${deudorNombre} | Mes ${estadoId}: ${honorariosRecaudoActual} → ${nuevoHonorariosRecaudo} (${diferencia > 0 ? '+' : ''}${diferencia})`);

                await estadoDoc.ref.update({
                  honorariosRecaudo: nuevoHonorariosRecaudo,
                });

                totalActualizados++;
                deudoresConCambios++;
              }
            }
          } catch (error) {
            console.error(`   ❌ Error en deudor ${deudorNombre}:`, error.message);
            totalErrores++;
          }
        }

        if (deudoresConCambios > 0) {
          console.log(`   📊 Deudores modificados: ${deudoresConCambios}`);
        }
      } catch (error) {
        console.error(`❌ Error procesando cliente ${clienteNombre}:`, error.message);
        totalErrores++;
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ MIGRACIÓN COMPLETADA');
    console.log('='.repeat(70));
    console.log(`   Total de registros procesados: ${totalProcesados}`);
    console.log(`   Total de registros actualizados: ${totalActualizados}`);
    console.log(`   Total de errores: ${totalErrores}`);
    console.log('='.repeat(70));

  } catch (error) {
    console.error('❌ Error fatal en la migración:', error);
    totalErrores++;
  } finally {
    await admin.app().delete();
    console.log('\n✨ Desconectado de Firebase\n');
    process.exit(totalErrores > 0 ? 1 : 0);
  }
}

// Ejecutar
migrarHonorariosRecaudo().catch((error) => {
  console.error('❌ Error no manejado:', error);
  process.exit(1);
});
