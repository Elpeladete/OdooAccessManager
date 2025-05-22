// Archivo: codigo_logs.gs - Funciones para el logging y depuración

// Función para guardar logs en GAS
function logToGas(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const formattedMessage = `[${timestamp}] [${level}] ${message}`;
  
  // Log a console de GAS
  Logger.log(formattedMessage);
  
  try {
    // También podemos guardar los últimos X logs en las propiedades para revisarlos después
    const userProperties = PropertiesService.getUserProperties();
    const logs = JSON.parse(userProperties.getProperty('appLogs') || '[]');
    logs.push({
      timestamp: timestamp,
      level: level,
      message: message
    });
    
    // Mantener solo los últimos 100 logs
    if (logs.length > 100) {
      logs.shift();
    }
    
    userProperties.setProperty('appLogs', JSON.stringify(logs));
  } catch (e) {
    Logger.log('Error al guardar el log: ' + e);
  }
}

// Función para obtener los logs guardados
function getApplicationLogs() {
  try {
    const userProperties = PropertiesService.getUserProperties();
    return JSON.parse(userProperties.getProperty('appLogs') || '[]');
  } catch (e) {
    return [{
      timestamp: new Date().toISOString(),
      message: 'Error al recuperar logs: ' + e
    }];
  }
}

// Función para limpiar los logs
function clearApplicationLogs() {
  const userProperties = PropertiesService.getUserProperties();
  userProperties.deleteProperty('appLogs');
  return true;
}

// Funciones específicas por nivel de log
function logInfo(message) {
  return logToGas(message, 'INFO');
}

function logWarning(message) {
  return logToGas(message, 'WARNING');
}

function logError(message) {
  return logToGas(message, 'ERROR');
}

function logDebugServer(message, data) {
  let formattedMessage = message;
  if (data) {
    try {
      if (typeof data === 'object') {
        formattedMessage += " " + JSON.stringify(data);
      } else {
        formattedMessage += " " + data;
      }
    } catch (e) {
      formattedMessage += " [Error al serializar datos: " + e + "]";
    }
  }
  return logToGas(formattedMessage, 'DEBUG');
}

// Función para inspeccionar el tipo y estructura de un objeto
function inspectObject(obj, name = "object") {
  try {
    let result = `[INSPECT ${name}] `;
    
    if (obj === null) {
      result += "NULL";
    } else if (obj === undefined) {
      result += "UNDEFINED";
    } else if (Array.isArray(obj)) {
      result += `ARRAY con ${obj.length} elementos`;
      if (obj.length > 0) {
        result += ` [Primer elemento: ${typeof obj[0]}]`;
      }
    } else if (typeof obj === 'object') {
      const keys = Object.keys(obj);
      result += `OBJECT con ${keys.length} propiedades: ${keys.join(', ')}`;
    } else {
      result += `${typeof obj}: ${obj}`;
    }
    
    logToGas(result, 'DEBUG');
    return result;
  } catch (e) {
    logToGas(`Error al inspeccionar objeto: ${e}`, 'ERROR');
    return `Error al inspeccionar objeto: ${e}`;
  }
}
