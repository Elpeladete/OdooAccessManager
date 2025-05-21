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

// Función para incluir archivos HTML
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// Añadir una función de depuración para ayudar a diagnosticar problemas de conexión
function testOdooConnectionWithDebug(config) {
  try {
    const response = callOdooAPI(config, 'res.users', 'search_read', [[['id', '=', 1]]], { fields: ['name'] });
    
    if (response && response.length > 0) {
      return { 
        success: true, 
        data: response[0],
        debug: {
          url: config.url,
          database: config.db,
          username: config.username,
          response: JSON.stringify(response)
        }
      };
    } else {
      return { 
        success: false, 
        error: 'No se recibió respuesta válida',
        debug: {
          url: config.url,
          database: config.db,
          username: config.username,
          response: JSON.stringify(response)
        }
      };
    }
  } catch (error) {
    return { 
      success: false, 
      error: error.toString(),
      debug: {
        url: config.url,
        database: config.db,
        username: config.username,
        errorDetails: error.stack || 'No hay detalles del error'
      }
    };
  }
}

// Función para probar la conexión
function testOdooConnection(config) {
  return testOdooConnectionWithDebug(config);
}
