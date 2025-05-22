// Archivo: codigo_utils.gs - Funciones utilitarias y XML-RPC

// Función para llamar a la API de Odoo
function callOdooAPI(config, model, method, args, kwargs = {}) {
  try {
    Logger.log(`Llamando a API Odoo: modelo=${model}, método=${method}`);
    
    // Validar config
    if (!config || !config.url || !config.db || !config.username || !config.password) {
      Logger.log('Error: Configuración incompleta');
      Logger.log(JSON.stringify({
        hasConfig: !!config,
        hasUrl: config ? !!config.url : false,
        hasDb: config ? !!config.db : false,
        hasUsername: config ? !!config.username : false,
        hasPassword: config ? !!config.password : false
      }));
      throw new Error('Configuración incompleta para conexión a API');
    }
    
    // Obtener UID
    let uid;
    try {
      Logger.log('Obteniendo UID para autenticación');
      uid = getOdooUID(config);
      if (!uid) {
        Logger.log('Error: No se pudo obtener UID');
        throw new Error('No se pudo autenticar con Odoo');
      }
      Logger.log(`UID obtenido: ${uid}`);
    } catch (error) {
      Logger.log(`Error de autenticación: ${error.message}`);
      throw new Error('Error de autenticación: ' + error.message);
    }
    
    // Preparar URL
    if (typeof config.url !== 'string') {
      Logger.log('Error: URL no es un string: ' + typeof config.url);
      throw new Error('URL no es un string válido');
    }
    
    // Validación adicional para URL
    if (!config.url) {
      Logger.log('Error: URL es vacía');
      throw new Error('URL es vacía');
    }
    
    const url = config.url.endsWith('/') ? config.url : config.url + '/';
    const xmlrpcUrl = url + 'xmlrpc/2/object';
    Logger.log(`URL para API Odoo: ${xmlrpcUrl}`);
    
    // Preparar payload XML-RPC
    const payload = XmlRpc.createCall('execute_kw', [
      config.db,
      uid,
      config.password,
      model,
      method,
      args,
      kwargs
    ]);
    
    // Realizar la solicitud
    Logger.log('Enviando solicitud a API Odoo');
    const options = {
      method: 'post',
      contentType: 'text/xml',
      payload: payload,
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(xmlrpcUrl, options);
    const responseText = response.getContentText();
    
    if (response.getResponseCode() !== 200) {
      Logger.log(`Error HTTP ${response.getResponseCode()}: ${responseText.substring(0, 200)}...`);
      throw new Error(`Error HTTP ${response.getResponseCode()}: ${responseText}`);
    }
    
    Logger.log('Respuesta recibida correctamente de API Odoo');
    return XmlRpc.parseResponse(responseText);
  } catch (error) {
    Logger.log(`Error en callOdooAPI: ${error.toString()}`);
    throw error;
  }
}

// Obtener UID para autenticación
function getOdooUID(config) {
  try {
    // Validar que la configuración es completa
    if (!config || !config.url || !config.db || !config.username || !config.password) {
      Logger.log('Error: Configuración incompleta para getOdooUID');
      Logger.log(JSON.stringify({
        hasConfig: !!config,
        hasUrl: config ? !!config.url : false,
        hasDb: config ? !!config.db : false,
        hasUsername: config ? !!config.username : false,
        hasPassword: config ? !!config.password : false
      }));
      throw new Error('Configuración incompleta para autenticación');
    }
    
    Logger.log('Obteniendo UID para ' + config.username + ' en ' + config.db);
    
    // Validar que config.url existe y es un string
    if (typeof config.url !== 'string') {
      Logger.log('Error: URL no es un string: ' + typeof config.url);
      throw new Error('URL no es un string válido');
    }
    
    // Validación adicional para URL
    if (!config.url) {
      Logger.log('Error: URL es vacía');
      throw new Error('URL es vacía');
    }
    
    const url = config.url.endsWith('/') ? config.url : config.url + '/';
    const xmlrpcUrl = url + 'xmlrpc/2/common';
    Logger.log('URL para autenticación: ' + xmlrpcUrl);
    
    const payload = XmlRpc.createCall('authenticate', [
      config.db,
      config.username,
      config.password,
      {}
    ]);
    
    // Realizar la solicitud
    const options = {
      method: 'post',
      contentType: 'text/xml',
      payload: payload,
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(xmlrpcUrl, options);
    const responseText = response.getContentText();
    
    if (response.getResponseCode() !== 200) {
      Logger.log(`Error HTTP al obtener UID: ${response.getResponseCode()}`);
      throw new Error(`Error HTTP ${response.getResponseCode()}: ${responseText}`);
    }
    
    const uid = XmlRpc.parseResponse(responseText);
    
    if (!uid || (typeof uid !== 'number' && typeof uid !== 'string')) {
      Logger.log('UID inválido recibido: ' + JSON.stringify(uid));
      throw new Error('Autenticación fallida: UID inválido');
    }
    
    Logger.log('UID obtenido correctamente: ' + uid);
    return uid;
  } catch (error) {
    Logger.log(`Error en getOdooUID: ${error.toString()}`);
    
    // Añadir diagnóstico detallado
    Logger.log('Diagnóstico detallado para error de autenticación:');
    try {
      Logger.log(`Tipo de config: ${typeof config}`);
      Logger.log(`Config tiene URL: ${config && !!config.url}`);
      if (config && config.url) {
        Logger.log(`URL: ${config.url.substring(0, 30)}...`);
        Logger.log(`Tipo de URL: ${typeof config.url}`);
      }
      Logger.log(`Config tiene DB: ${config && !!config.db}`);
      Logger.log(`Config tiene username: ${config && !!config.username}`);
      Logger.log(`Config tiene password: ${config && !!config.password}`);
    } catch (e) {
      Logger.log('Error durante diagnóstico: ' + e.toString());
    }
    
    throw error;
  }
}

// Objeto para manejar XML-RPC
const XmlRpc = {
  createCall: function(method, params) {
    let xml = '<?xml version="1.0"?>\n';
    xml += '<methodCall>\n';
    xml += `  <methodName>${method}</methodName>\n`;
    xml += '  <params>\n';
    
    params.forEach(param => {
      xml += '    <param>\n';
      xml += this.createValue(param);
      xml += '    </param>\n';
    });
    
    xml += '  </params>\n';
    xml += '</methodCall>';
    return xml;
  },
  
  createValue: function(value) {
    let xml = '      <value>\n';
    
    if (value === null || value === undefined) {
      xml += '        <nil/>\n';
    } else if (typeof value === 'boolean') {
      xml += `        <boolean>${value ? 1 : 0}</boolean>\n`;
    } else if (typeof value === 'number') {
      if (Number.isInteger(value)) {
        xml += `        <int>${value}</int>\n`;
      } else {
        xml += `        <double>${value}</double>\n`;
      }
    } else if (typeof value === 'string') {
      // Escapar caracteres especiales XML
      value = value.replace(/&/g, '&amp;')
                   .replace(/</g, '&lt;')
                   .replace(/>/g, '&gt;')
                   .replace(/"/g, '&quot;')
                   .replace(/'/g, '&apos;');
      xml += `        <string>${value}</string>\n`;
    } else if (Array.isArray(value)) {
      xml += '        <array>\n';
      xml += '          <data>\n';
      
      value.forEach(item => {
        xml += '            <value>\n';
        xml += this.createValue(item).trim().split('\n').map(line => '              ' + line).join('\n') + '\n';
        xml += '            </value>\n';
      });
      
      xml += '          </data>\n';
      xml += '        </array>\n';
    } else if (typeof value === 'object') {
      xml += '        <struct>\n';
      
      Object.keys(value).forEach(key => {
        xml += '          <member>\n';
        xml += `            <name>${key}</name>\n`;
        xml += '            <value>\n';
        xml += this.createValue(value[key]).trim().split('\n').map(line => '              ' + line).join('\n') + '\n';
        xml += '            </value>\n';
        xml += '          </member>\n';
      });
      
      xml += '        </struct>\n';
    }
    
    xml += '      </value>\n';
    return xml;
  },
  
  parseResponse: function(xml) {
    try {
      Logger.log('Analizando respuesta XML-RPC');
      const document = XmlService.parse(xml);
      const root = document.getRootElement();
      
      // Verificar si hay un error
      const fault = root.getChild('fault');
      if (fault) {
        const value = fault.getChild('value');
        const errorStruct = this.parseValue(value);
        Logger.log(`Error XML-RPC: ${errorStruct.faultCode} - ${errorStruct.faultString}`);
        throw new Error(`XML-RPC Fault: ${errorStruct.faultCode} - ${errorStruct.faultString}`);
      }
      
      // Obtener el valor de respuesta
      const params = root.getChild('params');
      if (!params) {
        Logger.log('No se encontró elemento params en la respuesta');
        return null;
      }
      
      const param = params.getChild('param');
      if (!param) {
        Logger.log('No se encontró elemento param en la respuesta');
        return null;
      }
      
      const value = param.getChild('value');
      if (!value) {
        Logger.log('No se encontró elemento value en la respuesta');
        return null;
      }
      
      const result = this.parseValue(value);
      Logger.log('Respuesta XML-RPC analizada correctamente');
      return result;
    } catch (e) {
      Logger.log(`Error al analizar respuesta XML-RPC: ${e.message}`);
      throw new Error(`Error al analizar respuesta XML-RPC: ${e.message}`);
    }
  },
  
  parseValue: function(valueElement) {
    if (!valueElement) return null;
    
    const children = valueElement.getChildren();
    if (children.length === 0) {
      return valueElement.getText();
    }
    
    const type = children[0].getName();
    
    switch (type) {
      case 'nil':
        return null;
      case 'boolean':
        return children[0].getText() === '1';
      case 'int':
      case 'i4':
        return parseInt(children[0].getText());
      case 'double':
        return parseFloat(children[0].getText());
      case 'string':
        return children[0].getText();
      case 'array':
        const data = children[0].getChild('data');
        const values = data.getChildren('value');
        return values.map(value => this.parseValue(value));
      case 'struct':
        const members = children[0].getChildren('member');
        const result = {};
        
        for (const member of members) {
          const name = member.getChild('name').getText();
          const value = this.parseValue(member.getChild('value'));
          result[name] = value;
        }
        
        return result;
      default:
        return valueElement.getText();
    }
  }
};
