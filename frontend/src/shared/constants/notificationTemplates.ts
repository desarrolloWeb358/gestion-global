// src/shared/constants/notificationTemplates.ts

/**
 * Mantén aquí TODOS los template IDs y switches por caso de negocio.
 * Edita sólo este archivo cuando cambien SIDs/IDs.
 */
export const NotificationTemplates = {
  COBRO: {
    // Twilio WhatsApp Content SID (o template name, según tu backend)
    WHATSAPP_TEMPLATE_ID: 'HX9e26f25fa5239893cb69b2fa3d245ed9', // <-- tu ejemplo
    // SendGrid Dynamic Template
    EMAIL_TEMPLATE_ID: 'd-2ca889256a79400b811dcb7de031c67b',   // <-- tu ejemplo
    SMS_ENABLED: true, // si quieres apagar/encender SMS globalmente para cobro
  },

  VALOR_AGREGADO: {
    
    // 🔧 prende/apaga canales aquí
    WHATSAPP_ENABLED: true,
    EMAIL_ENABLED:    true,
    SMS_ENABLED:      true, 
    
    // Reemplaza por tus reales cuando los tengas
    WHATSAPP_TEMPLATE_ID: 'HX1970d026dad891970a082d4528827989',
    EMAIL_TEMPLATE_ID:    'd-784ef28a9bc4482ab7154504026fb5a5',

  },
} as const;
