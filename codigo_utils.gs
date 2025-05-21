// Archivo: codigo_utils.gs - Funciones utilitarias y XML-RPC

// Función para llamar a la API de Odoo
function callOdooAPI(config, model, method, args, kwargs = {}) {
  // Validar config
  if (!config || !config.url || !config.db || !config.username || !config.password) {
    throw new Error('Configuración incompleta');
  }
  
  // Obtener UID
  let uid;
  try {
    uid = getOdooUID(config);
    if (!uid) {
      throw new Error('No se pudo autenticar con Odoo');
    }
  } catch (error) {
    throw new Error('Error de autenticación: ' + error.message);
  }
  
  // Preparar URL
  const url = config.url.endsWith('/') ? config.url : config.url + '/';
  const xmlrpcUrl = url + 'xmlrpc/2/object';
  
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
  
  try {
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
      throw new Error(`Error HTTP ${response.getResponseCode()}: ${responseText}`);
    }
    
    return XmlRpc.parseResponse(responseText);
  } catch (error) {
    Logger.log(`Error en callOdooAPI: ${error.toString()}`);
    throw error;
  }
}

// Obtener UID para autenticación
function getOdooUID(config) {
  const url = config.url.endsWith('/') ? config.url : config.url + '/';
  const xmlrpcUrl = url + 'xmlrpc/2/common';
  
  const payload = XmlRpc.createCall('authenticate', [
    config.db,
    config.username,
    config.password,
    {}
  ]);
  
  try {
    const options = {
      method: 'post',
      contentType: 'text/xml',
      payload: payload,
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(xmlrpcUrl, options);
    const responseText = response.getContentText();
    
    if (response.getResponseCode() !== 200) {
      throw new Error(`Error HTTP ${response.getResponseCode()}: ${responseText}`);
    }
    
    const uid = XmlRpc.parseResponse(responseText);
    return uid;
  } catch (error) {
    Logger.log(`Error en getOdooUID: ${error.toString()}`);
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
    const document = XmlService.parse(xml);
    const root = document.getRootElement();
    
    // Verificar si hay un error
    const fault = root.getChild('fault');
    if (fault) {
      const value = fault.getChild('value');
      const errorStruct = this.parseValue(value);
      throw new Error(`XML-RPC Fault: ${errorStruct.faultCode} - ${errorStruct.faultString}`);
    }
    
    // Obtener el valor de respuesta
    const params = root.getChild('params');
    if (!params) {
      return null;
    }
    
    const param = params.getChild('param');
    if (!param) {
      return null;
    }
    
    const value = param.getChild('value');
    if (!value) {
      return null;
    }
    
    return this.parseValue(value);
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
