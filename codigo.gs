/**
 * Gestor de Permisos Odoo
 * Aplicación web para administrar permisos de usuarios en Odoo 17 mediante APIs
 * @author: Desarrollado con GitHub Copilot
 * @date: Mayo 2025
 */

// Configuración global
const CONFIG = {
  ODOO_URL: 'https://test-dye.quilsoft.com/',  // Reemplazar con tu URL de Odoo
  API_KEY: PropertiesService.getScriptProperties().getProperty('ODOO_API_KEY'),
  DATABASE: PropertiesService.getScriptProperties().getProperty('ODOO_DATABASE'),
  USERNAME: PropertiesService.getScriptProperties().getProperty('ODOO_USERNAME'),
  PASSWORD: PropertiesService.getScriptProperties().getProperty('ODOO_PASSWORD')
};

/**
 * Función que se ejecuta al abrir la aplicación web
 * @returns {HtmlOutput} Página HTML renderizada
 */
function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Gestor de Permisos Odoo')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Incluye archivos HTML externos
 * @param {string} filename - Nombre del archivo a incluir
 * @returns {string} Contenido del archivo HTML
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Autenticación con Odoo y obtención de ID de sesión
 * @returns {Object} Objeto con resultado de autenticación e ID de sesión
 */
function authenticateWithOdoo() {
  try {
    const url = `${CONFIG.ODOO_URL}/web/session/authenticate`;
    const payload = {
      jsonrpc: '2.0',
      method: 'call',
      params: {
        db: CONFIG.DATABASE,
        login: CONFIG.USERNAME,
        password: CONFIG.PASSWORD
      },
      id: new Date().getTime()
    };
    
    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
      const response = UrlFetchApp.fetch(url, options);
    const result = JSON.parse(response.getContentText());
    
    if (result.error) {
      return { success: false, error: result.error.message };
    }
    
    // Extraer el ID de sesión de las cookies de respuesta
    let sessionId = null;
    const headers = response.getAllHeaders();
    if (headers && headers['Set-Cookie']) {
      const cookies = headers['Set-Cookie'];
      if (Array.isArray(cookies)) {
        // Si hay múltiples cookies
        for (const cookie of cookies) {
          if (cookie.includes('session_id=')) {
            sessionId = cookie.split('session_id=')[1].split(';')[0];
            break;
          }
        }
      } else if (typeof cookies === 'string') {
        // Si es una sola cadena de cookies
        if (cookies.includes('session_id=')) {
          sessionId = cookies.split('session_id=')[1].split(';')[0];
        }
      }
    }
    
    // Si no se pudo obtener el ID de sesión de las cookies, intentar obtenerlo del resultado
    if (!sessionId && result.result && result.result.session_id) {
      sessionId = result.result.session_id;
    }
    
    if (!sessionId) {
      console.error('No se pudo obtener el ID de sesión');
      return { success: false, error: 'No se pudo obtener el ID de sesión' };
    }
    
    return { 
      success: true, 
      sessionId: sessionId,
      userId: result.result.uid
    };
  } catch (error) {
    console.error('Error de autenticación:', error);
    return { success: false, error: error.toString() };
  }
}

/**
 * Realiza una llamada RPC a Odoo
 * @param {string} endpoint - Endpoint de la API de Odoo
 * @param {string} model - Modelo de Odoo
 * @param {string} method - Método a llamar
 * @param {Array} args - Argumentos para el método
 * @param {Object} kwargs - Argumentos con nombre
 * @param {string} sessionId - ID de sesión de Odoo
 * @returns {Object} Respuesta de Odoo
 */
function callOdooRPC(endpoint, model, method, args = [], kwargs = {}, sessionId) {
  try {
    const url = `${CONFIG.ODOO_URL}${endpoint}`;
    const payload = {
      jsonrpc: '2.0',
      method: 'call',
      params: {
        model: model,
        method: method,
        args: args,
        kwargs: kwargs
      },
      id: new Date().getTime()
    };
    
    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
      headers: {
        'Cookie': `session_id=${sessionId}`
      }
    };
    
    const response = UrlFetchApp.fetch(url, options);
    return JSON.parse(response.getContentText());
  } catch (error) {
    console.error('Error en llamada RPC:', error);
    return { error: error.toString() };
  }
}

/**
 * Obtiene todos los usuarios de Odoo
 * @param {string} sessionId - ID de sesión de Odoo
 * @returns {Array} Lista de usuarios
 */
function getUsers(sessionId) {
  // Primero obtenemos los usuarios del sistema excluyendo los usuarios portal y públicos
  const result = callOdooRPC(
    '/web/dataset/call_kw',
    'res.users',
    'search_read',
    [],
    {
      domain: [
        ['active', '=', true],
        ['share', '=', false], // Excluye usuarios portal y públicos
        ['login', 'not in', ['public', 'portal']], // Excluye usuarios especiales
        ['login', 'not like', 'customer_%'], // Excluye logins que comienzan con customer_
        ['login', 'not like', 'client_%'], // Excluye logins que comienzan con client_
        ['login', 'not like', 'partner_%'] // Excluye logins que comienzan con partner_
      ],
      fields: ['id', 'name', 'login', 'groups_id', 'image_128', 'email', 'partner_id', 'create_date'],
      context: { 'bin_size': true }
    },
    sessionId
  );
  
  // Filtramos cualquier posible cliente que se haya colado
  let users = result.result || [];
  console.log(`Usuarios iniciales desde Odoo: ${users.length}`);
  
  // Registro para auditoría de filtrado
  let filterStats = {
    initial: users.length,
    portalGroupsFiltered: 0,
    emailFiltered: 0,
    groupCountFiltered: 0,
    createDateFiltered: 0,
    namePatternFiltered: 0,
    adminUsers: 0,
    final: 0
  };
  
  // Obtenemos los IDs de los grupos de portal y público para asegurarnos de excluir usuarios con esos permisos
  const groupsResult = callOdooRPC(
    '/web/dataset/call_kw',
    'res.groups',
    'search_read',
    [],
    {
      domain: [['name', 'in', ['Portal', 'Public', 'Customer', 'Partner', 'Client']]],
      fields: ['id', 'name'],
      context: {}
    },
    sessionId
  );
    if (groupsResult.result && groupsResult.result.length > 0) {
    const portalGroupIds = groupsResult.result.map(group => group.id);
    
    // Filtramos los usuarios que pertenecen a grupos de portal o público
    const beforePortalFilter = users.length;
    users = users.filter(user => {
      // Verificar si el usuario tiene algún grupo que no sea de portal o público
      const hasInternalGroups = user.groups_id.some(groupId => !portalGroupIds.includes(groupId));
      return hasInternalGroups;
    });
    filterStats.portalGroupsFiltered = beforePortalFilter - users.length;
  }
  
  // Como verificación final, aseguramos que solo se incluyan usuarios con nomenclatura de email corporativo
  // o con grupos específicos que indicarían que son usuarios internos
  const beforeEmailFilter = users.length;
  users = users.filter(user => {
    // Si no tiene email, pero tiene grupos, lo consideramos usuario del sistema
    if (!user.email && user.groups_id.length > 0) return true;
    
    // Si tiene email con nomenclatura corporativa (no @gmail, @hotmail, etc.)
    if (user.email && (
      !user.email.includes('@gmail.com') && 
      !user.email.includes('@hotmail.com') && 
      !user.email.includes('@outlook.com') &&
      !user.email.includes('@yahoo.com')
    )) return true;
    
    // Verificar si tiene un mínimo de grupos que indicaría un usuario del sistema
    if (user.groups_id.length >= 2) return true; // Usuarios reales suelen tener al menos un par de grupos
    
    return false;
  });
  filterStats.emailFiltered = beforeEmailFilter - users.length;
  
  // Filtrar por número de grupos (menos de 2 grupos podría indicar un cliente)
  const beforeGroupFilter = users.length;
  users = users.filter(user => {
    if (user.groups_id.length < 2) return false;
    return true;
  });
  filterStats.groupCountFiltered = beforeGroupFilter - users.length;
  
  // Verificar fecha de creación
  const beforeDateFilter = users.length;
  users = users.filter(user => {
    // Si no hay fecha de creación, no podemos filtrar por este criterio
    if (!user.create_date) return true;
    
    const createDate = new Date(user.create_date);
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    
    // Si el usuario fue creado hace más de 3 meses y tiene pocos grupos, posiblemente es un cliente
    if (createDate < threeMonthsAgo && user.groups_id.length < 3) return false;
    
    return true;
  });
  filterStats.createDateFiltered = beforeDateFilter - users.length;
  
  // Verificar patrones en el nombre
  const beforeNameFilter = users.length;
  users = users.filter(user => {
    // Verificar si el nombre del usuario tiene indicaciones de ser un cliente
    const clientNamePatterns = ['cliente', 'customer', 'proveedor', 'vendor', 'partner', 'clt_', 'cli_', 'company'];
    if (user.name && clientNamePatterns.some(pattern => user.name.toLowerCase().includes(pattern))) {
      return false;
    }
    
    return true;
  });
  filterStats.namePatternFiltered = beforeNameFilter - users.length;
    // Obtenemos información adicional sobre grupos importantes para verificación
  const adminGroupsResult = callOdooRPC(
    '/web/dataset/call_kw',
    'res.groups',
    'search_read',
    [],
    {
      domain: [['name', 'like', 'Admin']],
      fields: ['id', 'name', 'users'],
      context: {}
    },
    sessionId
  );
  
  if (adminGroupsResult.result && adminGroupsResult.result.length > 0) {
    const adminGroupIds = adminGroupsResult.result.map(group => group.id);
    
    // Marcar usuarios con permisos administrativos para destacarlos en la UI
    users.forEach(user => {
      user.is_admin = user.groups_id.some(groupId => adminGroupIds.includes(groupId));
      if (user.is_admin) {
        filterStats.adminUsers++;
      }
    });
  }
    filterStats.final = users.length;
  
  // Registrar estadísticas de filtrado para auditoría
  console.log("===== ESTADÍSTICAS DE FILTRADO DE USUARIOS =====");
  console.log(`- Usuarios iniciales: ${filterStats.initial}`);
  console.log(`- Filtrados por grupos de portal: ${filterStats.portalGroupsFiltered}`);
  console.log(`- Filtrados por email: ${filterStats.emailFiltered}`);
  console.log(`- Filtrados por número de grupos: ${filterStats.groupCountFiltered}`);
  console.log(`- Filtrados por fecha de creación: ${filterStats.createDateFiltered}`);
  console.log(`- Filtrados por patrón de nombre: ${filterStats.namePatternFiltered}`);
  console.log(`- Usuarios administrativos: ${filterStats.adminUsers}`);
  console.log(`- Usuarios finales: ${filterStats.final}`);
  console.log("=============================================");
  
  // Analizamos si todavía podría haber clientes en la lista final
  let potentialClients = [];
  users.forEach(user => {
    let reasons = [];
    
    // Verificar patrones en nombres
    const clientNamePatterns = ['cliente', 'customer', 'proveedor', 'vendor', 'partner', 'empresa', 'company'];
    if (user.name && clientNamePatterns.some(pattern => user.name.toLowerCase().includes(pattern))) {
      reasons.push('Nombre con patrón de cliente');
    }
    
    // Email personal
    if (user.email && (
      user.email.includes('@gmail.com') || 
      user.email.includes('@hotmail.com') || 
      user.email.includes('@outlook.com') ||
      user.email.includes('@yahoo.com')
    )) {
      reasons.push('Email personal');
    }
    
    // Pocos grupos
    if (user.groups_id.length < 2) {
      reasons.push('Pocos grupos asignados');
    }
    
    // Partner ID alto
    if (user.partner_id && typeof user.partner_id[0] === 'number' && user.partner_id[0] > 100) {
      reasons.push('Partner ID alto');
    }
    
    if (reasons.length > 0) {
      potentialClients.push({
        id: user.id,
        name: user.name,
        login: user.login,
        reasons: reasons
      });
    }
  });
  
  // Registrar los posibles clientes que aún podrían estar en la lista
  if (potentialClients.length > 0) {
    console.log("POSIBLES CLIENTES DETECTADOS EN LA LISTA FINAL:");
    potentialClients.forEach(client => {
      console.log(`- ${client.name} (${client.login}): ${client.reasons.join(', ')}`);
    });
    console.log("=============================================");
  }
  
  return users;
}

/**
 * Obtiene todos los grupos de Odoo
 * @param {string} sessionId - ID de sesión de Odoo
 * @returns {Array} Lista de grupos con información de herencia
 */
function getGroups(sessionId) {
  const result = callOdooRPC(
    '/web/dataset/call_kw',
    'res.groups',
    'search_read',
    [],
    {
      fields: ['id', 'name', 'category_id', 'implied_ids', 'users', 'comment', 'model_access'],
      context: {}
    },
    sessionId
  );
  
  return result.result || [];
}

/**
 * Obtiene información detallada de permisos de modelo
 * @param {string} sessionId - ID de sesión de Odoo
 * @returns {Array} Lista de permisos de modelo
 */
function getModelAccess(sessionId) {
  const result = callOdooRPC(
    '/web/dataset/call_kw',
    'ir.model.access',
    'search_read',
    [],
    {
      fields: ['id', 'name', 'model_id', 'group_id', 'perm_read', 'perm_write', 'perm_create', 'perm_unlink'],
      context: {}
    },
    sessionId
  );
  
  return result.result || [];
}

/**
 * Obtiene información de módulos instalados con datos ampliados
 * @param {string} sessionId - ID de sesión de Odoo
 * @returns {Array} Lista de módulos instalados con información ampliada
 */
function getModules(sessionId) {
  const result = callOdooRPC(
    '/web/dataset/call_kw',
    'ir.module.module',
    'search_read',
    [],
    {
      domain: [['state', '=', 'installed']],
      fields: ['id', 'name', 'shortdesc', 'category_id', 'state', 'application', 'icon', 'summary', 'latest_version'],
      context: {}
    },
    sessionId
  );
  
  // Añadimos una consulta para obtener los objetos (modelos) de cada módulo
  if (result.result && result.result.length > 0) {
    const moduleIds = result.result.map(mod => mod.id);
    
    // Obtener modelos asociados a estos módulos
    const modelsResult = callOdooRPC(
      '/web/dataset/call_kw',
      'ir.model',
      'search_read',
      [],
      {
        domain: [['modules', 'like', result.result.map(mod => mod.name).join('|')]],
        fields: ['id', 'name', 'model', 'modules'],
        context: {}
      },
      sessionId
    );
    
    // Agrupar modelos por módulo
    if (modelsResult.result && modelsResult.result.length > 0) {
      const moduleModels = {};
      
      modelsResult.result.forEach(model => {
        const moduleNames = model.modules.split(',').map(m => m.trim());
        moduleNames.forEach(moduleName => {
          if (!moduleModels[moduleName]) {
            moduleModels[moduleName] = [];
          }
          moduleModels[moduleName].push({
            id: model.id,
            name: model.name,
            model: model.model
          });
        });
      });
      
      // Añadir la información de modelos a cada módulo
      result.result.forEach(module => {
        module.models = moduleModels[module.name] || [];
        module.model_count = module.models.length;
      });
    }
  }
  
  return result.result || [];
}

/**
 * Asigna un grupo a un usuario
 * @param {string} sessionId - ID de sesión de Odoo
 * @param {number} userId - ID del usuario
 * @param {number} groupId - ID del grupo a asignar
 * @returns {Object} Resultado de la operación
 */
function assignGroupToUser(sessionId, userId, groupId) {
  try {
    // Primero obtenemos los grupos actuales del usuario
    const userInfo = callOdooRPC(
      '/web/dataset/call_kw',
      'res.users',
      'read',
      [[userId]],
      { fields: ['groups_id'] },
      sessionId
    );
    
    if (userInfo.error) {
      return { success: false, error: userInfo.error };
    }
    
    const currentGroups = userInfo.result[0].groups_id;
    
    // Verificamos si el grupo ya está asignado
    if (currentGroups.includes(groupId)) {
      return { success: true, message: 'El grupo ya estaba asignado al usuario' };
    }
    
    // Añadimos el nuevo grupo
    const newGroups = [...currentGroups, groupId];
    
    // Actualizamos el usuario con los nuevos grupos
    const result = callOdooRPC(
      '/web/dataset/call_kw',
      'res.users',
      'write',
      [[userId], { groups_id: [[6, 0, newGroups]] }],
      {},
      sessionId
    );
    
    return { 
      success: !result.error, 
      message: result.error ? result.error.data.message : 'Grupo asignado correctamente' 
    };
  } catch (error) {
    console.error('Error al asignar grupo:', error);
    return { success: false, error: error.toString() };
  }
}

/**
 * Revoca un grupo de un usuario
 * @param {string} sessionId - ID de sesión de Odoo
 * @param {number} userId - ID del usuario
 * @param {number} groupId - ID del grupo a revocar
 * @returns {Object} Resultado de la operación
 */
function revokeGroupFromUser(sessionId, userId, groupId) {
  try {
    // Primero obtenemos los grupos actuales del usuario
    const userInfo = callOdooRPC(
      '/web/dataset/call_kw',
      'res.users',
      'read',
      [[userId]],
      { fields: ['groups_id'] },
      sessionId
    );
    
    if (userInfo.error) {
      return { success: false, error: userInfo.error };
    }
    
    const currentGroups = userInfo.result[0].groups_id;
    
    // Verificamos si el grupo está asignado
    if (!currentGroups.includes(groupId)) {
      return { success: true, message: 'El usuario no tenía este grupo asignado' };
    }
    
    // Removemos el grupo
    const newGroups = currentGroups.filter(id => id !== groupId);
    
    // Actualizamos el usuario con los nuevos grupos
    const result = callOdooRPC(
      '/web/dataset/call_kw',
      'res.users',
      'write',
      [[userId], { groups_id: [[6, 0, newGroups]] }],
      {},
      sessionId
    );
    
    return { 
      success: !result.error, 
      message: result.error ? result.error.data.message : 'Grupo revocado correctamente' 
    };
  } catch (error) {
    console.error('Error al revocar grupo:', error);
    return { success: false, error: error.toString() };
  }
}

/**
 * Registra un evento de auditoría de cambios
 * @param {string} sessionId - ID de sesión de Odoo
 * @param {string} action - Acción realizada (ej: "assign", "revoke")
 * @param {number} userId - ID del usuario afectado
 * @param {number} groupId - ID del grupo afectado
 * @param {string} performedBy - ID o nombre del usuario que realizó la acción
 * @returns {Object} Resultado del registro de auditoría
 */
function logAuditEvent(sessionId, action, userId, groupId, performedBy) {
  try {
    // Creamos un registro de nota en Odoo
    const result = callOdooRPC(
      '/web/dataset/call_kw',
      'mail.message',
      'create',
      [{
        model: 'res.users',
        res_id: userId,
        body: `Cambio de permisos: ${action === 'assign' ? 'Asignación' : 'Revocación'} del grupo #${groupId} por ${performedBy}`,
        message_type: 'comment',
        subtype_id: 1  // 'Nota' subtype
      }],
      {},
      sessionId
    );
    
    return { success: !result.error };
  } catch (error) {
    console.error('Error al registrar auditoría:', error);
    return { success: false, error: error.toString() };
  }
}

/**
 * Actualiza los permisos de un modelo para un usuario o grupo específico
 * @param {Object} data - Datos para la actualización de permisos
 * @returns {Object} Resultado de la operación
 */
function updateModelPermissions(data) {
  try {
    // Verificar que tenemos toda la información necesaria
    if (!data.sessionId || !data.modelName || !data.permissions) {
      return { success: false, error: 'Faltan datos necesarios para actualizar los permisos' };
    }
    
    if (!data.userId && !data.groupId) {
      return { success: false, error: 'Se requiere especificar un usuario o un grupo' };
    }
    
    const { sessionId, modelName, permissions, userId, groupId } = data;
    
    // Buscar el ID interno de la tabla ir.model.access para este modelo y grupo/usuario
    const searchDomain = [['model_id.model', '=', modelName]];
    
    if (groupId) {
      // Si es un grupo, actualizamos directamente el registro de ir.model.access
      searchDomain.push(['group_id', '=', parseInt(groupId)]);
      
      const accessResult = callOdooRPC(
        '/web/dataset/call_kw',
        'ir.model.access',
        'search_read',
        [],
        {
          domain: searchDomain,
          fields: ['id', 'perm_read', 'perm_write', 'perm_create', 'perm_unlink'],
          context: {}
        },
        sessionId
      );
      
      if (!accessResult.result || accessResult.result.length === 0) {
        // Si no existe un registro para este modelo y grupo, debemos crearlo
        return createModelAccess(sessionId, modelName, groupId, permissions);
      }
      
      // Actualizar permisos en los registros encontrados
      const updatePromises = accessResult.result.map(access => {
        return callOdooRPC(
          '/web/dataset/call_kw',
          'ir.model.access',
          'write',
          [[access.id], {
            perm_read: permissions.perm_read,
            perm_write: permissions.perm_write,
            perm_create: permissions.perm_create,
            perm_unlink: permissions.perm_unlink
          }],
          { context: {} },
          sessionId
        );
      });
      
      // Verificar que todas las actualizaciones fueron exitosas
      const updateResults = updatePromises;
      const allSuccessful = updateResults.every(result => result.result);
      
      if (!allSuccessful) {
        return { success: false, error: 'No se pudieron actualizar todos los permisos' };
      }
      
      return { success: true };
    } else if (userId) {
      // Si es un usuario, necesitamos un enfoque diferente
      // Primero verificamos si el usuario ya tiene una entrada de acceso personalizada
      // Si no, podríamos necesitar crear una regla de acceso específica para el usuario
      
      // Obtener los grupos del usuario
      const userResult = callOdooRPC(
        '/web/dataset/call_kw',
        'res.users',
        'read',
        [[parseInt(userId)]],
        { fields: ['groups_id'], context: {} },
        sessionId
      );
      
      if (!userResult.result || userResult.result.length === 0) {
        return { success: false, error: 'No se pudo encontrar el usuario' };
      }
      
      const userGroups = userResult.result[0].groups_id;
      
      // Verificar si alguno de los grupos del usuario ya tiene permisos para este modelo
      const groupSearchDomain = [
        ['model_id.model', '=', modelName],
        ['group_id', 'in', userGroups]
      ];
      
      const groupAccessResult = callOdooRPC(
        '/web/dataset/call_kw',
        'ir.model.access',
        'search_read',
        [],
        {
          domain: groupSearchDomain,
          fields: ['id', 'group_id', 'perm_read', 'perm_write', 'perm_create', 'perm_unlink'],
          context: {}
        },
        sessionId
      );
      
      if (!groupAccessResult.result || groupAccessResult.result.length === 0) {
        // No hay permisos existentes, necesitaríamos crear uno para el grupo principal del usuario
        // Esto requiere lógica adicional para determinar el grupo adecuado
        return { success: false, error: 'No se encontraron permisos existentes para modificar' };
      }
      
      // Actualizar los permisos en los grupos del usuario
      // Por simplicidad, actualizamos todos los registros de acceso relacionados
      const updatePromises = groupAccessResult.result.map(access => {
        return callOdooRPC(
          '/web/dataset/call_kw',
          'ir.model.access',
          'write',
          [[access.id], {
            perm_read: permissions.perm_read,
            perm_write: permissions.perm_write,
            perm_create: permissions.perm_create,
            perm_unlink: permissions.perm_unlink
          }],
          { context: {} },
          sessionId
        );
      });
      
      // Verificar que todas las actualizaciones fueron exitosas
      const updateResults = updatePromises;
      const allSuccessful = updateResults.every(result => result.result);
      
      if (!allSuccessful) {
        return { success: false, error: 'No se pudieron actualizar todos los permisos' };
      }
      
      return { success: true };
    }
    
    return { success: false, error: 'Configuración de permisos no soportada' };
  } catch (error) {
    console.error('Error en updateModelPermissions:', error);
    return { success: false, error: error.toString() };
  }
}

/**
 * Crea un nuevo registro de permiso de acceso a modelo
 * @param {string} sessionId - ID de sesión de Odoo
 * @param {string} modelName - Nombre del modelo
 * @param {number} groupId - ID del grupo
 * @param {Object} permissions - Permisos a asignar
 * @returns {Object} Resultado de la operación
 */
function createModelAccess(sessionId, modelName, groupId, permissions) {
  try {
    // Primero necesitamos obtener el ID del modelo
    const modelResult = callOdooRPC(
      '/web/dataset/call_kw',
      'ir.model',
      'search_read',
      [],
      {
        domain: [['model', '=', modelName]],
        fields: ['id', 'name'],
        context: {}
      },
      sessionId
    );
    
    if (!modelResult.result || modelResult.result.length === 0) {
      return { success: false, error: 'No se pudo encontrar el modelo especificado' };
    }
    
    const modelId = modelResult.result[0].id;
    
    // Crear nombre único para el registro de acceso
    const groupResult = callOdooRPC(
      '/web/dataset/call_kw',
      'res.groups',
      'read',
      [[parseInt(groupId)]],
      { fields: ['name'], context: {} },
      sessionId
    );
    
    if (!groupResult.result || groupResult.result.length === 0) {
      return { success: false, error: 'No se pudo encontrar el grupo especificado' };
    }
    
    const groupName = groupResult.result[0].name;
    const accessName = `${modelName}_${groupName.replace(/\s+/g, '_').toLowerCase()}`;
    
    // Crear el nuevo registro de acceso
    const createResult = callOdooRPC(
      '/web/dataset/call_kw',
      'ir.model.access',
      'create',
      [{
        name: accessName,
        model_id: modelId,
        group_id: parseInt(groupId),
        perm_read: permissions.perm_read,
        perm_write: permissions.perm_write,
        perm_create: permissions.perm_create,
        perm_unlink: permissions.perm_unlink
      }],
      { context: {} },
      sessionId
    );
    
    if (!createResult.result) {
      return { success: false, error: 'No se pudo crear el registro de acceso' };
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error en createModelAccess:', error);
    return { success: false, error: error.toString() };
  }
}

/**
 * Compara los permisos entre dos usuarios y devuelve las diferencias
 * @param {string} sessionId - ID de sesión de Odoo
 * @param {number} user1Id - ID del primer usuario
 * @param {number} user2Id - ID del segundo usuario
 * @returns {Object} Objeto con las diferencias, permisos comunes y todos los permisos
 */
function compareUserPermissions(sessionId, user1Id, user2Id) {
  try {
    // Obtenemos los datos de los usuarios
    const allGroups = getGroups(sessionId);
    const allModelAccess = getModelAccess(sessionId);
    const allModules = getModules(sessionId);
    
    // Obtenemos los usuarios individuales con sus datos detallados
    const user1Data = getSingleUser(sessionId, user1Id);
    const user2Data = getSingleUser(sessionId, user2Id);
    
    if (!user1Data || !user2Data) {
      throw new Error('No se pudieron obtener los datos de los usuarios');
    }
    
    // Calculamos los permisos efectivos para cada usuario
    const user1Perms = getUserEffectivePermissions(user1Data, allGroups, allModelAccess, allModules);
    const user2Perms = getUserEffectivePermissions(user2Data, allGroups, allModelAccess, allModules);
    
    // Realizamos la comparación
    const comparison = comparePermissions(user1Perms, user2Perms);
    
    return {
      success: true,
      user1: { id: user1Id, name: user1Data.name, login: user1Data.login },
      user2: { id: user2Id, name: user2Data.name, login: user2Data.login },
      comparison: comparison
    };
  } catch (error) {
    console.error('Error al comparar permisos:', error);
    return {
      success: false,
      error: error.message || 'Error desconocido al comparar permisos'
    };
  }
}

/**
 * Obtiene los datos de un usuario específico con todos sus detalles
 * @param {string} sessionId - ID de sesión de Odoo
 * @param {number} userId - ID del usuario
 * @returns {Object} Datos del usuario
 */
function getSingleUser(sessionId, userId) {
  const result = callOdooRPC(
    '/web/dataset/call_kw',
    'res.users',
    'search_read',
    [],
    {
      domain: [['id', '=', userId]],
      fields: ['id', 'name', 'login', 'groups_id', 'image_128', 'email', 'partner_id', 'create_date'],
      context: { 'bin_size': true }
    },
    sessionId
  );
  
  if (result.result && result.result.length > 0) {
    return result.result[0];
  }
  return null;
}

/**
 * Calcula los permisos efectivos de un usuario considerando todos sus grupos
 * @param {Object} user - Datos del usuario
 * @param {Array} allGroups - Todos los grupos disponibles
 * @param {Array} allModelAccess - Todos los permisos de acceso a modelos
 * @param {Array} allModules - Todos los módulos disponibles
 * @returns {Object} Permisos efectivos del usuario organizados por modelo
 */
function getUserEffectivePermissions(user, allGroups, allModelAccess, allModules) {
  // Recopilamos todos los grupos del usuario, incluidos los heredados
  const effectiveGroupIds = new Set(user.groups_id);
  
  // Añadimos los grupos heredados
  user.groups_id.forEach(gId => {
    collectInheritedGroups(gId, effectiveGroupIds, allGroups);
  });
  
  // Obtenemos los permisos relevantes para el usuario
  const userPermissions = {};
  
  allModelAccess.forEach(access => {
    if (!access.group_id || !effectiveGroupIds.has(access.group_id[0])) return;
    
    const modelName = access.model_id ? access.model_id[1] : null;
    if (!modelName) return;
    
    // Determinamos el módulo
    const moduleName = getModuleFromModel(modelName, allModules);
    
    if (!userPermissions[modelName]) {
      userPermissions[modelName] = {
        module: moduleName,
        read: false,
        write: false,
        create: false,
        unlink: false
      };
    }
    
    // Acumulamos permisos (OR lógico)
    if (access.perm_read) userPermissions[modelName].read = true;
    if (access.perm_write) userPermissions[modelName].write = true;
    if (access.perm_create) userPermissions[modelName].create = true;
    if (access.perm_unlink) userPermissions[modelName].unlink = true;
  });
  
  return userPermissions;
}

/**
 * Función auxiliar para recopilar grupos heredados
 * @param {number} groupId - ID del grupo
 * @param {Set} collectedGroups - Conjunto de grupos ya recopilados
 * @param {Array} allGroups - Todos los grupos disponibles
 * @returns {Set} Conjunto actualizado de grupos
 */
function collectInheritedGroups(groupId, collectedGroups, allGroups) {
  const group = allGroups.find(g => g.id === groupId);
  if (!group || !group.implied_ids) return collectedGroups;
  
  // Añadimos los grupos implícitos directos
  group.implied_ids.forEach(impliedId => {
    if (!collectedGroups.has(impliedId)) {
      collectedGroups.add(impliedId);
      // Recursivamente añadimos los grupos heredados de este grupo implícito
      collectInheritedGroups(impliedId, collectedGroups, allGroups);
    }
  });
  
  return collectedGroups;
}

/**
 * Determina el módulo al que pertenece un modelo
 * @param {string} modelName - Nombre del modelo
 * @param {Array} allModules - Todos los módulos disponibles
 * @returns {string} Nombre del módulo
 */
function getModuleFromModel(modelName, allModules) {
  // Extraemos el nombre del módulo del nombre del modelo
  // Por ejemplo, "res.users" pertenece al módulo "base"
  const parts = modelName.split('.');
  if (parts.length > 0) {
    // Buscamos si existe un módulo con este nombre
    const matchingModule = allModules.find(m => 
      m.name === parts[0] || 
      m.name.replace('_', '.') === parts[0]
    );
    
    if (matchingModule) {
      return matchingModule.shortdesc || matchingModule.name;
    }
  }
  
  return 'Otros'; // Módulo por defecto si no se puede determinar
}

/**
 * Compara los permisos entre dos usuarios
 * @param {Object} user1Perms - Permisos del primer usuario
 * @param {Object} user2Perms - Permisos del segundo usuario
 * @returns {Object} Resultado de la comparación
 */
function comparePermissions(user1Perms, user2Perms) {
  const differences = [];
  const commonPerms = {};
  const allPerms = {};
  
  // Unimos todos los modelos de ambos usuarios
  const allModels = new Set([
    ...Object.keys(user1Perms),
    ...Object.keys(user2Perms)
  ]);
  
  // Revisamos cada modelo
  allModels.forEach(modelName => {
    const perms1 = user1Perms[modelName] || {
      module: user2Perms[modelName] ? user2Perms[modelName].module : 'Desconocido',
      read: false,
      write: false,
      create: false,
      unlink: false
    };
    
    const perms2 = user2Perms[modelName] || {
      module: user1Perms[modelName] ? user1Perms[modelName].module : 'Desconocido',
      read: false,
      write: false,
      create: false,
      unlink: false
    };
    
    // Guardamos todos los permisos
    allPerms[modelName] = {
      module: perms1.module,
      user1: {
        read: perms1.read,
        write: perms1.write,
        create: perms1.create,
        unlink: perms1.unlink
      },
      user2: {
        read: perms2.read,
        write: perms2.write,
        create: perms2.create,
        unlink: perms2.unlink
      }
    };
    
    // Comprobamos diferencias en cada tipo de permiso
    ['read', 'write', 'create', 'unlink'].forEach(permType => {
      if (perms1[permType] !== perms2[permType]) {
        differences.push({
          module: perms1.module || perms2.module,
          model: modelName,
          permType: permType,
          user1Value: perms1[permType],
          user2Value: perms2[permType]
        });
      } else if (perms1[permType] === true && perms2[permType] === true) {
        // Guardamos permisos comunes (solo los que ambos usuarios tienen)
        if (!commonPerms[modelName]) {
          commonPerms[modelName] = {
            module: perms1.module,
            permissions: []
          };
        }
        commonPerms[modelName].permissions.push(permType);
      }
    });
  });
  
  return {
    differences,
    commonPerms,
    allPerms
  };
}
