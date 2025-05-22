// Archivo: codigo_main.gs - Funciones principales y de configuración

// Configuración
function getOdooConfig() {
  const userProperties = PropertiesService.getUserProperties();
  const config = userProperties.getProperty('odooConfig');
  
  if (config) {
    return JSON.parse(config);
  }
  
  return {};
}

function saveOdooConfig(config) {
  const userProperties = PropertiesService.getUserProperties();
  userProperties.setProperty('odooConfig', JSON.stringify(config));
  return true;
}

// Función para crear la interfaz web
function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Gestor de Permisos Odoo')
    .setFaviconUrl('https://i.ibb.co/zhBxGWLt/SP-Icon.png')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// Función para validar la configuración de conexión
function validateOdooConfig(config) {
  if (!config) {
    return {
      valid: false,
      error: 'La configuración es nula'
    };
  }
  
  const requiredFields = ['url', 'db', 'username', 'password'];
  const missingFields = requiredFields.filter(field => !config[field]);
  
  if (missingFields.length > 0) {
    return {
      valid: false,
      error: `Campos requeridos faltantes: ${missingFields.join(', ')}`,
      missingFields: missingFields
    };
  }
  
  // Validar formato de URL
  if (typeof config.url !== 'string') {
    return {
      valid: false,
      error: 'La URL no es un string válido'
    };
  }
  
  if (!config.url.startsWith('http://') && !config.url.startsWith('https://')) {
    return {
      valid: false,
      error: 'La URL debe comenzar con http:// o https://'
    };
  }
  
  return {
    valid: true
  };
}

// Función para incluir archivos HTML
function include(filename) {
  Logger.log('Incluyendo archivo: ' + filename);
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// Añadir una función de depuración para ayudar a diagnosticar problemas de conexión
function testOdooConnectionWithDebug(config) {
  logInfo('Probando conexión a Odoo con: ' + JSON.stringify({
    url: config ? config.url : 'undefined',
    db: config ? config.db : 'undefined',
    username: config ? config.username : 'undefined'
  }));
  
  try {
    // Validar la configuración
    const validation = validateOdooConfig(config);
    if (!validation.valid) {
      logWarning('Error de validación: ' + validation.error);
      return { 
        success: false, 
        error: validation.error,
        debug: 'Validación de configuración fallida: ' + validation.error
      };
    }
    
    // Crear un nuevo objeto de configuración para asegurar que tenga el formato correcto
    const configForAuth = {
      url: config.url.endsWith('/') ? config.url : config.url + '/',
      db: config.db,
      username: config.username,
      password: config.password
    };
    
    // Intentar obtener el UID como prueba de conexión
    const uid = getOdooUID(configForAuth);
    
    if (!uid) {
      logError('Error: No se pudo obtener UID');
      return {
        success: false,
        error: 'No se pudo autenticar con las credenciales proporcionadas.',
        debug: 'UID es null o undefined'
      };
    }
    
    logInfo('Conexión exitosa, UID: ' + uid);
    return {
      success: true,
      uid: uid
    };
  } catch (e) {
    logError('Error en testOdooConnectionWithDebug: ' + e.message);
    logDebugServer('Detalles del error:', { 
      message: e.message,
      stack: e.stack,
      config: {
        url: config.url,
        db: config.db,
        username: config.username
      }
    });
    
    // Analizar el mensaje de error para dar respuestas más específicas
    let errorMsg = e.message;
    let detailedError = 'Error interno: ' + e.message;
    
    if (errorMsg.includes('Failed to connect')) {
      detailedError = 'No se pudo conectar al servidor. Verifique la URL y que el servidor esté en línea.';
    } else if (errorMsg.includes('database') || errorMsg.includes('Database')) {
      detailedError = 'Error de base de datos. Verifique el nombre de la base de datos.';
    } else if (errorMsg.includes('auth') || errorMsg.includes('Authentication')) {
      detailedError = 'Error de autenticación. Verifique el nombre de usuario y contraseña.';
    } else if (errorMsg.includes('timeout') || errorMsg.includes('Timeout')) {
      detailedError = 'Tiempo de espera agotado. El servidor tardó demasiado en responder.';
    } else if (errorMsg.includes('XML-RPC') || errorMsg.includes('xmlrpc')) {
      detailedError = 'Error en la comunicación XML-RPC. Verifique la configuración del servidor.';
    }
    
    return {
      success: false,
      error: detailedError,
      debug: errorMsg
    };
  }
}

// Función para probar la conexión
function testOdooConnection(config) {
  return testOdooConnectionWithDebug(config);
}
