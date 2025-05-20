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
  return HtmlService.createTemplateFromFile('index')
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

// Función para probar la conexión con depuración
function testOdooConnectionWithDebug(config) {
  try {
    // Registrar información de la solicitud
    Logger.log('Intentando conectar a: ' + config.url);
    
    // Preparar URL
    let url = config.url;
    if (!url.endsWith('/')) {
      url += '/';
    }
    url += 'xmlrpc/2/common';
    
    // Crear payload XML-RPC para autenticación
    const payload = XmlRpc.createCall('authenticate', [
      config.db,
      config.username,
      config.password,
      {}
    ]);
    
    // Registrar el payload (sin contraseña para seguridad)
    const debugPayload = payload.replace(config.password, '********');
    Logger.log('Payload XML-RPC: ' + debugPayload);
    
    // Realizar la solicitud
    const response = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'text/xml',
      payload: payload,
      muteHttpExceptions: true
    });
    
    // Registrar información de la respuesta
    const statusCode = response.getResponseCode();
    Logger.log('Código de respuesta HTTP: ' + statusCode);
    
    if (statusCode !== 200) {
      return { 
        success: false, 
        error: 'Error HTTP: ' + statusCode,
        details: response.getContentText()
      };
    }
    
    const responseText = response.getContentText();
    Logger.log('Respuesta: ' + responseText.substring(0, 200) + '...');
    
    // Intentar parsear la respuesta
    const uid = XmlRpc.parseResponse(responseText);
    
    if (!uid) {
      return { success: false, error: 'Autenticación fallida: UID nulo' };
    }
    
    return { success: true, uid: uid };
  } catch (error) {
    Logger.log('Error en la conexión: ' + error.toString());
    return { success: false, error: error.toString() };
  }
}

// Modificar la función testOdooConnection para usar la nueva función de depuración
function testOdooConnection(config) {
  const result = testOdooConnectionWithDebug(config);
  
  if (result.success) {
    return { success: true, count: result.uid };
  } else {
    return { success: false, error: result.error };
  }
}

// Obtener usuarios y grupos
function getOdooUsersAndGroups(config) {
  try {
    // Obtener usuarios
    const users = callOdooAPI(config, 'res.users', 'search_read', 
      [[['active', 'in', [true, false]]]],
      { fields: ['id', 'name', 'login', 'email', 'active'] }
    );
    
    // Obtener grupos
    const groups = callOdooAPI(config, 'res.groups', 'search_read', 
      [[]],
      { fields: ['id', 'name', 'category_id'] }
    );
    
    // Formatear datos
    const formattedUsers = users.map(user => ({
      id: user.id,
      name: user.name,
      login: user.login,
      email: user.email,
      active: user.active,
      type: 'user'
    }));
    
    const formattedGroups = groups.map(group => ({
      id: group.id,
      name: group.name,
      category: group.category_id ? group.category_id[1] : null,
      type: 'group'
    }));
    
    return { 
      success: true, 
      data: [...formattedUsers, ...formattedGroups]
    };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// Obtener grupos de un usuario
function getUserGroups(config, userId) {
  try {
    const user = callOdooAPI(config, 'res.users', 'read', 
      [userId],
      { fields: ['groups_id'] }
    );
    
    if (!user || !user.length || !user[0].groups_id || !user[0].groups_id.length) {
      return { success: true, data: [] };
    }
    
    const groupIds = user[0].groups_id;
    const groups = callOdooAPI(config, 'res.groups', 'read', 
      [groupIds],
      { fields: ['id', 'name', 'category_id'] }
    );
    
    const formattedGroups = groups.map(group => ({
      id: group.id,
      name: group.name,
      category: group.category_id ? group.category_id[1] : null
    }));
    
    return { success: true, data: formattedGroups };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// Obtener usuarios de un grupo
function getGroupUsers(config, groupId) {
  try {
    const group = callOdooAPI(config, 'res.groups', 'read', 
      [groupId],
      { fields: ['users'] }
    );
    
    if (!group || !group.length || !group[0].users || !group[0].users.length) {
      return { success: true, data: [] };
    }
    
    const userIds = group[0].users;
    const users = callOdooAPI(config, 'res.users', 'read', 
      [userIds],
      { fields: ['id', 'name', 'login', 'email', 'active'] }
    );
    
    const formattedUsers = users.map(user => ({
      id: user.id,
      name: user.name,
      login: user.login,
      email: user.email,
      active: user.active
    }));
    
    return { success: true, data: formattedUsers };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// Obtener grupos heredados
function getGroupImpliedIds(config, groupId) {
  try {
    const group = callOdooAPI(config, 'res.groups', 'read', 
      [groupId],
      { fields: ['implied_ids'] }
    );
    
    if (!group || !group.length || !group[0].implied_ids || !group[0].implied_ids.length) {
      return { success: true, data: [] };
    }
    
    const impliedIds = group[0].implied_ids;
    const impliedGroups = callOdooAPI(config, 'res.groups', 'read', 
      [impliedIds],
      { fields: ['id', 'name'] }
    );
    
    return { success: true, data: impliedGroups };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// Obtener módulos
function getOdooModules(config) {
  try {
    const modules = callOdooAPI(config, 'ir.module.module', 'search_read', 
      [[]],
      { fields: ['id', 'name', 'shortdesc', 'description', 'state', 'application', 'latest_version'] }
    );
    
    const formattedModules = modules.map(module => ({
      id: module.id,
      technical_name: module.name,
      name: module.shortdesc,
      description: module.description,
      installed: module.state === 'installed',
      application: module.application,
      version: module.latest_version
    }));
    
    return { success: true, data: formattedModules };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// Obtener modelos de un módulo
function getModuleModels(config, moduleId) {
  try {
    // Primero obtenemos el nombre técnico del módulo
    const module = callOdooAPI(config, 'ir.module.module', 'read', 
      [moduleId],
      { fields: ['name'] }
    );
    
    if (!module || !module.length) {
      return { success: false, error: 'Módulo no encontrado' };
    }
    
    const moduleName = module[0].name;
    
    // Obtenemos los modelos que pertenecen a este módulo
    const models = callOdooAPI(config, 'ir.model', 'search_read', 
      [[['model', 'like', moduleName + '.%']]],
      { fields: ['id', 'name', 'model', 'state'] }
    );
    
    // También buscamos modelos que puedan estar en el módulo pero no sigan la convención de nomenclatura
    const moduleInfo = callOdooAPI(config, 'ir.model.data', 'search_read', 
      [[['module', '=', moduleName], ['model', '=', 'ir.model']]],
      { fields: ['res_id'] }
    );
    
    let additionalModels = [];
    if (moduleInfo && moduleInfo.length) {
      const modelIds = moduleInfo.map(item => item.res_id);
      additionalModels = callOdooAPI(config, 'ir.model', 'read', 
        [modelIds],
        { fields: ['id', 'name', 'model', 'state'] }
      );
    }
    
    // Combinar y eliminar duplicados
    const allModels = [...models, ...additionalModels];
    const uniqueModels = [];
    const modelIds = new Set();
    
    allModels.forEach(model => {
      if (!modelIds.has(model.id)) {
        modelIds.add(model.id);
        uniqueModels.push({
          id: model.id,
          name: model.name,
          model: model.model,
          state: model.state
        });
      }
    });
    
    return { success: true, data: uniqueModels };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// Modificar la función getAccessRights para mejorar la búsqueda de permisos
function getAccessRights(config, entityType, entityId, moduleId) {
  try {
    // Registrar información de diagnóstico
    Logger.log(`Buscando derechos de acceso para: entityType=${entityType}, entityId=${entityId}, moduleId=${moduleId}`);
    
    // Obtener modelos del módulo
    const moduleModels = getModuleModels(config, moduleId);
    if (!moduleModels.success || !moduleModels.data.length) {
      Logger.log("No se encontraron modelos para el módulo");
      return { 
        success: true, 
        data: [],
        debug: {
          message: "No se encontraron modelos para este módulo",
          moduleId: moduleId
        }
      };
    }
    
    // Construir dominio para la búsqueda
    let domain = [];
    const modelIds = moduleModels.data.map(model => model.id);
    
    // Primero intentamos buscar por modelo sin filtrar por grupo/usuario
    // para verificar si hay permisos en general
    const allAccessRights = callOdooAPI(config, 'ir.model.access', 'search_read', 
      [[['model_id', 'in', modelIds]]],
      { fields: ['id', 'name', 'model_id', 'group_id', 'perm_read', 'perm_write', 'perm_create', 'perm_unlink'] }
    );
    
    Logger.log(`Total de permisos encontrados para los modelos: ${allAccessRights ? allAccessRights.length : 0}`);
    
    // Ahora aplicamos el filtro por entidad
    if (entityType === 'user') {
      // Para usuarios, necesitamos obtener sus grupos
      const user = callOdooAPI(config, 'res.users', 'read', 
        [entityId],
        { fields: ['groups_id'] }
      );
      
      if (!user || !user.length || !user[0].groups_id || !user[0].groups_id.length) {
        Logger.log("Usuario no tiene grupos asignados");
        // Buscar permisos sin grupo (globales)
        domain.push(['group_id', '=', false]);
      } else {
        Logger.log(`Grupos del usuario: ${user[0].groups_id.join(', ')}`);
        // Buscar permisos para los grupos del usuario o permisos sin grupo
        domain.push('|', ['group_id', '=', false], ['group_id', 'in', user[0].groups_id]);
      }
    } else {
      // Para grupos, buscamos permisos específicos del grupo o permisos sin grupo
      domain.push('|', ['group_id', '=', false], ['group_id', '=', entityId]);
    }
    
    // Añadir filtro por modelo
    domain.push(['model_id', 'in', modelIds]);
    
    Logger.log(`Dominio de búsqueda: ${JSON.stringify(domain)}`);
    
    // Obtener derechos de acceso
    const accessRights = callOdooAPI(config, 'ir.model.access', 'search_read', 
      [domain],
      { fields: ['id', 'name', 'model_id', 'group_id', 'perm_read', 'perm_write', 'perm_create', 'perm_unlink'] }
    );
    
    Logger.log(`Permisos encontrados con filtros: ${accessRights ? accessRights.length : 0}`);
    
    // Si no hay resultados, intentar una búsqueda más amplia
    if (!accessRights || accessRights.length === 0) {
      // Intentar buscar permisos globales (sin grupo asignado)
      const globalRights = callOdooAPI(config, 'ir.model.access', 'search_read', 
        [[['model_id', 'in', modelIds], ['group_id', '=', false]]],
        { fields: ['id', 'name', 'model_id', 'group_id', 'perm_read', 'perm_write', 'perm_create', 'perm_unlink'] }
      );
      
      Logger.log(`Permisos globales encontrados: ${globalRights ? globalRights.length : 0}`);
      
      if (globalRights && globalRights.length > 0) {
        // Formatear datos
        const formattedRights = formatAccessRights(globalRights);
        
        return { 
          success: true, 
          data: formattedRights,
          debug: {
            message: "Se encontraron permisos globales (sin grupo asignado)",
            totalPermisos: allAccessRights ? allAccessRights.length : 0,
            permisosGlobales: globalRights.length
          }
        };
      }
      
      return { 
        success: true, 
        data: [],
        debug: {
          message: "No se encontraron permisos con los filtros aplicados",
          totalPermisos: allAccessRights ? allAccessRights.length : 0,
          domain: domain
        }
      };
    }
    
    // Formatear datos
    const formattedRights = formatAccessRights(accessRights);
    
    return { success: true, data: formattedRights };
  } catch (error) {
    Logger.log(`Error en getAccessRights: ${error.toString()}`);
    return { 
      success: false, 
      error: error.toString(),
      debug: {
        message: "Error al obtener permisos",
        error: error.toString()
      }
    };
  }
}

// Función auxiliar para formatear derechos de acceso
function formatAccessRights(accessRights) {
  return accessRights.map(right => {
    // Asegurarse de que model_id y group_id tengan el formato esperado
    const modelInfo = Array.isArray(right.model_id) ? right.model_id : [0, 'Desconocido (desconocido)'];
    const groupInfo = right.group_id && Array.isArray(right.group_id) ? right.group_id : [0, 'Sin grupo (global)'];
    
    // Extraer nombre del modelo y modelo técnico
    let modelName = 'Desconocido';
    let modelTech = 'desconocido';
    
    if (modelInfo[1]) {
      const parts = modelInfo[1].split(' (');
      if (parts.length > 1) {
        modelName = parts[0];
        modelTech = parts[1].replace(')', '');
      } else {
        modelName = modelInfo[1];
      }
    }
    
    return {
      id: right.id,
      name: right.name,
      model: modelTech,
      model_name: modelName,
      model_id: modelInfo[0],
      group_id: groupInfo[0],
      group_name: groupInfo[1],
      perm_read: right.perm_read,
      perm_write: right.perm_write,
      perm_create: right.perm_create,
      perm_unlink: right.perm_unlink
    };
  });
}

// Guardar derechos de acceso
function saveAccessRights(config, entityType, entityId, moduleId, accessRights) {
  try {
    // Iterar sobre cada derecho y actualizarlo
    for (const right of accessRights) {
      if (right.id.toString().startsWith('new_')) {
        // Crear nuevo derecho
        callOdooAPI(config, 'ir.model.access', 'create', [{
          name: `access_${right.model.replace('.', '_')}_${entityType === 'group' ? 'group_' + entityId : 'user_' + entityId}`,
          model_id: right.model_id,
          group_id: entityType === 'group' ? parseInt(entityId) : right.group_id,
          perm_read: right.perm_read,
          perm_write: right.perm_write,
          perm_create: right.perm_create,
          perm_unlink: right.perm_unlink
        }]);
      } else {
        // Actualizar derecho existente
        callOdooAPI(config, 'ir.model.access', 'write', [
          parseInt(right.id),
          {
            perm_read: right.perm_read,
            perm_write: right.perm_write,
            perm_create: right.perm_create,
            perm_unlink: right.perm_unlink
          }
        ]);
      }
    }
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// Modificar la función getRecordRules para mejorar la búsqueda de reglas
function getRecordRules(config, entityType, entityId, moduleId) {
  try {
    // Registrar información de diagnóstico
    Logger.log(`Buscando reglas de registro para: entityType=${entityType}, entityId=${entityId}, moduleId=${moduleId}`);
    
    // Obtener modelos del módulo
    const moduleModels = getModuleModels(config, moduleId);
    if (!moduleModels.success || !moduleModels.data.length) {
      Logger.log("No se encontraron modelos para el módulo");
      return { 
        success: true, 
        data: [],
        debug: {
          message: "No se encontraron modelos para este módulo",
          moduleId: moduleId
        }
      };
    }
    
    const modelNames = moduleModels.data.map(model => model.model);
    Logger.log(`Modelos encontrados: ${modelNames.join(', ')}`);
    
    // Primero buscar todas las reglas para estos modelos sin filtrar por grupo/usuario
    const allRules = callOdooAPI(config, 'ir.rule', 'search_read', 
      [[['model_id.model', 'in', modelNames]]],
      { fields: ['id', 'name', 'model_id', 'domain_force', 'global', 'groups'] }
    );
    
    Logger.log(`Total de reglas encontradas para los modelos: ${allRules ? allRules.length : 0}`);
    
    // Construir dominio para la búsqueda filtrada
    let domain = [];
    
    // Filtrar por entidad
    if (entityType === 'user') {
      // Para usuarios, necesitamos obtener sus grupos
      const user = callOdooAPI(config, 'res.users', 'read', 
        [entityId],
        { fields: ['groups_id'] }
      );
      
      if (!user || !user.length || !user[0].groups_id || !user[0].groups_id.length) {
        Logger.log("Usuario no tiene grupos asignados");
        // Solo reglas globales
        domain.push(['global', '=', true]);
      } else {
        Logger.log(`Grupos del usuario: ${user[0].groups_id.join(', ')}`);
        // Reglas globales o reglas para los grupos del usuario
        domain.push('|', ['global', '=', true], ['groups', 'in', user[0].groups_id]);
      }
    } else {
      // Para grupos, reglas globales o reglas específicas del grupo
      domain.push('|', ['global', '=', true], ['groups', 'in', [parseInt(entityId)]]);
    }
    
    // Añadir filtro por modelo
    domain.push(['model_id.model', 'in', modelNames]);
    
    Logger.log(`Dominio de búsqueda: ${JSON.stringify(domain)}`);
    
    // Obtener reglas de registro
    const recordRules = callOdooAPI(config, 'ir.rule', 'search_read', 
      [domain],
      { fields: ['id', 'name', 'model_id', 'domain_force', 'global', 'groups'] }
    );
    
    Logger.log(`Reglas encontradas con filtros: ${recordRules ? recordRules.length : 0}`);
    
    // Si no hay resultados, intentar una búsqueda más amplia
    if (!recordRules || recordRules.length === 0) {
      // Intentar buscar reglas globales
      const globalRules = callOdooAPI(config, 'ir.rule', 'search_read', 
        [[['model_id.model', 'in', modelNames], ['global', '=', true]]],
        { fields: ['id', 'name', 'model_id', 'domain_force', 'global', 'groups'] }
      );
      
      Logger.log(`Reglas globales encontradas: ${globalRules ? globalRules.length : 0}`);
      
      if (globalRules && globalRules.length > 0) {
        // Formatear datos
        const formattedRules = formatRecordRules(globalRules);
        
        return { 
          success: true, 
          data: formattedRules,
          debug: {
            message: "Se encontraron reglas globales",
            totalReglas: allRules ? allRules.length : 0,
            reglasGlobales: globalRules.length
          }
        };
      }
      
      return { 
        success: true, 
        data: [],
        debug: {
          message: "No se encontraron reglas con los filtros aplicados",
          totalReglas: allRules ? allRules.length : 0,
          domain: domain
        }
      };
    }
    
    // Formatear datos
    const formattedRules = formatRecordRules(recordRules);
    
    return { success: true, data: formattedRules };
  } catch (error) {
    Logger.log(`Error en getRecordRules: ${error.toString()}`);
    return { 
      success: false, 
      error: error.toString(),
      debug: {
        message: "Error al obtener reglas de registro",
        error: error.toString()
      }
    };
  }
}

// Función auxiliar para formatear reglas de registro
function formatRecordRules(recordRules) {
  return recordRules.map(rule => {
    // Asegurarse de que model_id tenga el formato esperado
    const modelInfo = Array.isArray(rule.model_id) ? rule.model_id : [0, 'Desconocido (desconocido)'];
    
    // Extraer nombre del modelo y modelo técnico
    let modelName = 'Desconocido';
    let modelTech = 'desconocido';
    
    if (modelInfo[1]) {
      const parts = modelInfo[1].split(' (');
      if (parts.length > 1) {
        modelName = parts[0];
        modelTech = parts[1].replace(')', '');
      } else {
        modelName = modelInfo[1];
      }
    }
    
    return {
      id: rule.id,
      name: rule.name,
      model: modelTech,
      model_name: modelName,
      model_id: modelInfo[0],
      domain_force: rule.domain_force,
      global: rule.global,
      groups: rule.groups
    };
  });
}

// Guardar reglas de registro
function saveRecordRules(config, entityType, entityId, moduleId, recordRules) {
  try {
    // Iterar sobre cada regla y actualizarla
    for (const rule of recordRules) {
      if (rule.id.toString().startsWith('new_')) {
        // Crear nueva regla
        const newRule = {
          name: rule.name,
          model_id: rule.model_id,
          domain_force: rule.domain_force,
          global: rule.global
        };
        
        if (!rule.global && entityType === 'group') {
          newRule.groups = [[4, parseInt(entityId)]];
        }
        
        callOdooAPI(config, 'ir.rule', 'create', [newRule]);
      } else {
        // Actualizar regla existente
        const updateData = {
          name: rule.name,
          domain_force: rule.domain_force,
          global: rule.global
        };
        
        callOdooAPI(config, 'ir.rule', 'write', [
          parseInt(rule.id),
          updateData
        ]);
        
        // Actualizar grupos si es necesario
        if (!rule.global && entityType === 'group') {
          // Primero limpiamos los grupos existentes
          const currentRule = callOdooAPI(config, 'ir.rule', 'read', 
            [parseInt(rule.id)],
            { fields: ['groups'] }
          );
          
          if (currentRule && currentRule.length && currentRule[0].groups) {
            for (const groupId of currentRule[0].groups) {
              callOdooAPI(config, 'ir.rule', 'write', [
                parseInt(rule.id),
                { groups: [[3, groupId]] }
              ]);
            }
          }
          
          // Añadimos el grupo actual
          callOdooAPI(config, 'ir.rule', 'write', [
            parseInt(rule.id),
            { groups: [[4, parseInt(entityId)]] }
          ]);
        }
      }
    }
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// Modificar la función getMenuAccess para mejorar la búsqueda de menús
function getMenuAccess(config, entityType, entityId, moduleId) {
  try {
    // Registrar información de diagnóstico
    Logger.log(`Buscando acceso a menús para: entityType=${entityType}, entityId=${entityId}, moduleId=${moduleId}`);
    
    // Obtener información del módulo
    const module = callOdooAPI(config, 'ir.module.module', 'read', 
      [moduleId],
      { fields: ['name'] }
    );
    
    if (!module || !module.length) {
      Logger.log("Módulo no encontrado");
      return { 
        success: false, 
        error: 'Módulo no encontrado',
        debug: {
          message: "No se encontró el módulo especificado",
          moduleId: moduleId
        }
      };
    }
    
    const moduleName = module[0].name;
    Logger.log(`Nombre técnico del módulo: ${moduleName}`);
    
    // Primero buscar todos los menús sin filtrar
    const allMenus = callOdooAPI(config, 'ir.ui.menu', 'search_read', 
      [[]],
      { fields: ['id', 'name', 'parent_id', 'groups_id'] }
    );
    
    Logger.log(`Total de menús en el sistema: ${allMenus ? allMenus.length : 0}`);
    
    // Buscar menús relacionados con el módulo
    const menuIds = callOdooAPI(config, 'ir.model.data', 'search_read', 
      [[['module', '=', moduleName], ['model', '=', 'ir.ui.menu']]],
      { fields: ['res_id'] }
    );
    
    if (!menuIds || !menuIds.length) {
      // Intentar una búsqueda más amplia para módulos que pueden no tener datos ir.model.data
      Logger.log("No se encontraron menús directamente asociados al módulo, intentando búsqueda alternativa");
      
      // Buscar menús que puedan estar relacionados con los modelos del módulo
      const moduleModels = getModuleModels(config, moduleId);
      if (moduleModels.success && moduleModels.data.length > 0) {
        const modelNames = moduleModels.data.map(model => model.model);
        
        // Buscar acciones de ventana para estos modelos
        const actions = callOdooAPI(config, 'ir.actions.act_window', 'search_read', 
          [[['res_model', 'in', modelNames]]],
          { fields: ['id', 'name'] }
        );
        
        if (actions && actions.length > 0) {
          const actionIds = actions.map(action => action.id);
          
          // Buscar menús que usen estas acciones
          const relatedMenus = callOdooAPI(config, 'ir.ui.menu', 'search_read', 
            [[['action', 'in', actionIds]]],
            { fields: ['id', 'name', 'parent_id', 'groups_id'] }
          );
          
          if (relatedMenus && relatedMenus.length > 0) {
            Logger.log(`Se encontraron ${relatedMenus.length} menús relacionados con los modelos del módulo`);
            
            // Construir árbol de menús
            const menuTree = buildMenuTree(relatedMenus);
            
            // Determinar acceso
            let groupIds = [];
            if (entityType === 'user') {
              const user = callOdooAPI(config, 'res.users', 'read', 
                [entityId],
                { fields: ['groups_id'] }
              );
              
              if (user && user.length && user[0].groups_id) {
                groupIds = user[0].groups_id;
              }
            } else {
              groupIds = [parseInt(entityId)];
            }
            
            // Formatear datos con acceso
            const formattedMenus = flattenMenuTree(menuTree, groupIds);
            
            return { 
              success: true, 
              data: formattedMenus,
              debug: {
                message: "Se encontraron menús relacionados con los modelos del módulo",
                totalMenusModulo: relatedMenus.length
              }
            };
          }
        }
      }
      
      Logger.log("No se encontraron menús para este módulo");
      return { 
        success: true, 
        data: [],
        debug: {
          message: "No se encontraron menús para este módulo",
          moduleName: moduleName,
          totalMenus: allMenus ? allMenus.length : 0
        }
      };
    }
    
    const ids = menuIds.map(item => item.res_id);
    Logger.log(`Menús encontrados para el módulo: ${ids.join(', ')}`);
    
    // Obtener información de los menús
    const menus = callOdooAPI(config, 'ir.ui.menu', 'read', 
      [ids],
      { fields: ['id', 'name', 'parent_id', 'groups_id'] }
    );
    
    if (!menus || !menus.length) {
      Logger.log("No se pudieron obtener detalles de los menús");
      return { 
        success: true, 
        data: [],
        debug: {
          message: "No se pudieron obtener detalles de los menús",
          menuIds: ids
        }
      };
    }
    
    // Construir árbol de menús
    const menuTree = buildMenuTree(menus);
    
    // Determinar acceso
    let groupIds = [];
    if (entityType === 'user') {
      const user = callOdooAPI(config, 'res.users', 'read', 
        [entityId],
        { fields: ['groups_id'] }
      );
      
      if (user && user.length && user[0].groups_id) {
        groupIds = user[0].groups_id;
        Logger.log(`Grupos del usuario: ${groupIds.join(', ')}`);
      } else {
        Logger.log("Usuario no tiene grupos asignados");
      }
    } else {
      groupIds = [parseInt(entityId)];
      Logger.log(`Grupo seleccionado: ${entityId}`);
    }
    
    // Formatear datos con acceso
    const formattedMenus = flattenMenuTree(menuTree, groupIds);
    
    Logger.log(`Menús formateados: ${formattedMenus.length}`);
    
    return { 
      success: true, 
      data: formattedMenus,
      debug: {
        message: formattedMenus.length > 0 ? 
          "Se encontraron menús para este módulo" : 
          "No se encontraron menús accesibles para esta entidad",
        totalMenusModulo: menus.length,
        groupIds: groupIds
      }
    };
  } catch (error) {
    Logger.log(`Error en getMenuAccess: ${error.toString()}`);
    return { 
      success: false, 
      error: error.toString(),
      debug: {
        message: "Error al obtener acceso a menús",
        error: error.toString()
      }
    };
  }
}

// Construir árbol de menús
function buildMenuTree(menus) {
  const menuMap = {};
  const rootMenus = [];
  
  // Crear mapa de menús
  menus.forEach(menu => {
    menuMap[menu.id] = {
      ...menu,
      children: []
    };
  });
  
  // Construir árbol
  menus.forEach(menu => {
    if (menu.parent_id && menuMap[menu.parent_id[0]]) {
      menuMap[menu.parent_id[0]].children.push(menuMap[menu.id]);
    } else {
      rootMenus.push(menuMap[menu.id]);
    }
  });
  
  return rootMenus;
}

// Aplanar árbol de menús
function flattenMenuTree(menuTree, groupIds, level = 0, result = []) {
  menuTree.forEach(menu => {
    // Verificar acceso
    const hasAccess = menu.groups_id.length === 0 || 
                      menu.groups_id.some(groupId => groupIds.includes(groupId));
    
    result.push({
      id: menu.id,
      name: menu.name,
      level: level,
      access: hasAccess,
      groups_id: menu.groups_id
    });
    
    if (menu.children && menu.children.length) {
      flattenMenuTree(menu.children, groupIds, level + 1, result);
    }
  });
  
  return result;
}

// Guardar acceso a menús
function saveMenuAccess(config, entityType, entityId, moduleId, menuAccess) {
  try {
    // Solo podemos modificar acceso a nivel de grupo
    if (entityType !== 'group') {
      return { success: false, error: 'Solo se puede modificar acceso a menús para grupos' };
    }
    
    const groupId = parseInt(entityId);
    
    // Iterar sobre cada menú y actualizar su acceso
    for (const menu of menuAccess) {
      const menuId = menu.id;
      
      // Obtener grupos actuales
      const currentMenu = callOdooAPI(config, 'ir.ui.menu', 'read', 
        [menuId],
        { fields: ['groups_id'] }
      );
      
      if (!currentMenu || !currentMenu.length) continue;
      
      const currentGroups = currentMenu[0].groups_id || [];
      
      if (menu.access) {
        // Añadir grupo si no está ya
        if (!currentGroups.includes(groupId)) {
          callOdooAPI(config, 'ir.ui.menu', 'write', [
            menuId,
            { groups_id: [[4, groupId]] }
          ]);
        }
      } else {
        // Quitar grupo si está
        if (currentGroups.includes(groupId)) {
          callOdooAPI(config, 'ir.ui.menu', 'write', [
            menuId,
            { groups_id: [[3, groupId]] }
          ]);
        }
      }
    }
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// Modificar la función callOdooAPI para mejorar el manejo de errores

// Función para llamar a la API de Odoo
function callOdooAPI(config, model, method, args, kwargs = {}) {
  // Validar configuración
  if (!config || !config.url || !config.db || !config.username || !config.password) {
    throw new Error('Configuración de Odoo incompleta');
  }
  
  // Preparar URL
  let url = config.url;
  if (!url.endsWith('/')) {
    url += '/';
  }
  url += 'xmlrpc/2/';
  
  try {
    // Autenticar
    const commonUrl = url + 'common';
    const commonPayload = XmlRpc.createCall('authenticate', [
      config.db,
      config.username,
      config.password,
      {}
    ]);
    
    const commonResponse = UrlFetchApp.fetch(commonUrl, {
      method: 'post',
      contentType: 'text/xml',
      payload: commonPayload,
      muteHttpExceptions: true
    });
    
    const statusCode = commonResponse.getResponseCode();
    if (statusCode !== 200) {
      throw new Error('Error HTTP en autenticación: ' + statusCode + ' - ' + commonResponse.getContentText());
    }
    
    const uid = XmlRpc.parseResponse(commonResponse.getContentText());
    
    if (!uid) {
      throw new Error('Autenticación fallida: UID nulo');
    }
    
    // Llamar al método
    const objectUrl = url + 'object';
    const objectPayload = XmlRpc.createCall('execute_kw', [
      config.db,
      uid,
      config.password,
      model,
      method,
      args,
      kwargs
    ]);
    
    const objectResponse = UrlFetchApp.fetch(objectUrl, {
      method: 'post',
      contentType: 'text/xml',
      payload: objectPayload,
      muteHttpExceptions: true
    });
    
    const objectStatusCode = objectResponse.getResponseCode();
    if (objectStatusCode !== 200) {
      throw new Error('Error HTTP en llamada a método: ' + objectStatusCode + ' - ' + objectResponse.getContentText());
    }
    
    return XmlRpc.parseResponse(objectResponse.getContentText());
  } catch (error) {
    Logger.log('Error en callOdooAPI: ' + error.toString());
    throw error;
  }
}

// Reemplazar completamente el objeto XmlRpc con esta implementación mejorada:

// Objeto para manejar XML-RPC
const XmlRpc = {
  createCall: function(method, params) {
    let xml = '<?xml version="1.0"?>\n';
    xml += '<methodCall>\n';
    xml += '  <methodName>' + method + '</methodName>\n';
    xml += '  <params>\n';
    
    for (const param of params) {
      xml += '    <param>\n';
      xml += this.valueToXml(param, 4);
      xml += '    </param>\n';
    }
    
    xml += '  </params>\n';
    xml += '</methodCall>';
    
    return xml;
  },
  
  valueToXml: function(value, indent) {
    const spaces = ' '.repeat(indent);
    let xml = spaces + '<value>';
    
    if (value === null || value === undefined) {
      xml += '<nil/>';
    } else if (typeof value === 'boolean') {
      xml += '<boolean>' + (value ? '1' : '0') + '</boolean>';
    } else if (typeof value === 'number') {
      if (Number.isInteger(value)) {
        xml += '<int>' + value + '</int>';
      } else {
        xml += '<double>' + value + '</double>';
      }
    } else if (typeof value === 'string') {
      xml += '<string>' + this.escapeXml(value) + '</string>';
    } else if (Array.isArray(value)) {
      xml += '\n' + spaces + '  <array>\n';
      xml += spaces + '    <data>\n';
      
      for (const item of value) {
        xml += this.valueToXml(item, indent + 6) + '\n';
      }
      
      xml += spaces + '    </data>\n';
      xml += spaces + '  </array>\n';
      xml += spaces;
    } else if (typeof value === 'object') {
      xml += '\n' + spaces + '  <struct>\n';
      
      for (const key in value) {
        if (Object.prototype.hasOwnProperty.call(value, key)) {
          xml += spaces + '    <member>\n';
          xml += spaces + '      <name>' + this.escapeXml(key) + '</name>\n';
          xml += this.valueToXml(value[key], indent + 6) + '\n';
          xml += spaces + '    </member>\n';
        }
      }
      
      xml += spaces + '  </struct>\n';
      xml += spaces;
    }
    
    xml += '</value>';
    return xml;
  },
  
  escapeXml: function(text) {
    if (text === null || text === undefined) {
      return '';
    }
    return text.toString()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  },
  
  parseResponse: function(xml) {
    try {
      // Parsear respuesta XML-RPC
      const document = XmlService.parse(xml);
      const root = document.getRootElement();
      
      // Verificar si hay un error
      const fault = root.getChild('fault');
      if (fault) {
        const value = fault.getChild('value');
        const struct = value.getChild('struct');
        const members = struct.getChildren('member');
        
        let faultString = '';
        for (const member of members) {
          if (member.getChild('name').getText() === 'faultString') {
            faultString = member.getChild('value').getChild('string').getText();
            break;
          }
        }
        
        throw new Error(faultString);
      }
      
      // Obtener valor de respuesta
      const params = root.getChild('params');
      if (!params) return null;
      
      const param = params.getChild('param');
      if (!param) return null;
      
      const value = param.getChild('value');
      if (!value) return null;
      
      return this.parseValue(value);
    } catch (e) {
      Logger.log('Error al parsear respuesta XML: ' + e.toString());
      Logger.log('XML recibido: ' + xml);
      throw new Error('Error al procesar la respuesta de Odoo: ' + e.toString());
    }
  },
  
  parseValue: function(valueElement) {
    // Parsear diferentes tipos de valores
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

// Añadir nuevas funciones para obtener todos los permisos, reglas y menús de un módulo

// Función para obtener todos los permisos de un módulo sin filtrar por usuario/grupo
function getAllModuleAccessRights(config, moduleId) {
  try {
    // Obtener modelos del módulo
    const moduleModels = getModuleModels(config, moduleId);
    if (!moduleModels.success || !moduleModels.data.length) {
      return { success: true, data: [] };
    }
    
    const modelIds = moduleModels.data.map(model => model.id);
    
    // Buscar todos los permisos para estos modelos
    const accessRights = callOdooAPI(config, 'ir.model.access', 'search_read', 
      [[['model_id', 'in', modelIds]]],
      { fields: ['id', 'name', 'model_id', 'group_id', 'perm_read', 'perm_write', 'perm_create', 'perm_unlink'] }
    );
    
    // Formatear datos
    const formattedRights = accessRights.map(right => {
      // Asegurarse de que model_id y group_id tengan el formato esperado
      const modelInfo = Array.isArray(right.model_id) ? right.model_id : [0, 'Desconocido (desconocido)'];
      const groupInfo = right.group_id && Array.isArray(right.group_id) ? right.group_id : [0, 'Sin grupo (global)'];
      
      // Extraer nombre del modelo y modelo técnico
      let modelName = 'Desconocido';
      let modelTech = 'desconocido';
      
      if (modelInfo[1]) {
        const parts = modelInfo[1].split(' (');
        if (parts.length > 1) {
          modelName = parts[0];
          modelTech = parts[1].replace(')', '');
        } else {
          modelName = modelInfo[1];
        }
      }
      
      return {
        id: right.id,
        name: right.name,
        model: modelTech,
        model_name: modelName,
        model_id: modelInfo[0],
        group_id: groupInfo[0],
        group_name: groupInfo[1],
        perm_read: right.perm_read,
        perm_write: right.perm_write,
        perm_create: right.perm_create,
        perm_unlink: right.perm_unlink
      };
    });
    
    return { success: true, data: formattedRights };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// Función para obtener todas las reglas de un módulo sin filtrar por usuario/grupo
function getAllModuleRecordRules(config, moduleId) {
  try {
    // Obtener modelos del módulo
    const moduleModels = getModuleModels(config, moduleId);
    if (!moduleModels.success || !moduleModels.data.length) {
      return { success: true, data: [] };
    }
    
    const modelNames = moduleModels.data.map(model => model.model);
    
    // Buscar todas las reglas para estos modelos
    const recordRules = callOdooAPI(config, 'ir.rule', 'search_read', 
      [[['model_id.model', 'in', modelNames]]],
      { fields: ['id', 'name', 'model_id', 'domain_force', 'global', 'groups'] }
    );
    
    // Formatear datos
    const formattedRules = recordRules.map(rule => {
      // Asegurarse de que model_id tenga el formato esperado
      const modelInfo = Array.isArray(rule.model_id) ? rule.model_id : [0, 'Desconocido (desconocido)'];
      
      // Extraer nombre del modelo y modelo técnico
      let modelName = 'Desconocido';
      let modelTech = 'desconocido';
      
      if (modelInfo[1]) {
        const parts = modelInfo[1].split(' (');
        if (parts.length > 1) {
          modelName = parts[0];
          modelTech = parts[1].replace(')', '');
        } else {
          modelName = modelInfo[1];
        }
      }
      
      return {
        id: rule.id,
        name: rule.name,
        model: modelTech,
        model_name: modelName,
        model_id: modelInfo[0],
        domain_force: rule.domain_force,
        global: rule.global,
        groups: rule.groups
      };
    });
    
    return { success: true, data: formattedRules };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// Función para obtener todos los menús de un módulo sin filtrar por acceso
function getAllModuleMenus(config, moduleId) {
  try {
    // Obtener información del módulo
    const module = callOdooAPI(config, 'ir.module.module', 'read', 
      [moduleId],
      { fields: ['name'] }
    );
    
    if (!module || !module.length) {
      return { success: false, error: 'Módulo no encontrado' };
    }
    
    const moduleName = module[0].name;
    
    // Buscar menús relacionados con el módulo
    const menuIds = callOdooAPI(config, 'ir.model.data', 'search_read', 
      [[['module', '=', moduleName], ['model', '=', 'ir.ui.menu']]],
      { fields: ['res_id'] }
    );
    
    if (!menuIds || !menuIds.length) {
      return { success: true, data: [] };
    }
    
    const ids = menuIds.map(item => item.res_id);
    
    // Obtener información de los menús
    const menus = callOdooAPI(config, 'ir.ui.menu', 'read', 
      [ids],
      { fields: ['id', 'name', 'parent_id', 'groups_id'] }
    );
    
    if (!menus || !menus.length) {
      return { success: true, data: [] };
    }
    
    // Construir árbol de menús
    const menuTree = buildMenuTree(menus);
    
    // Formatear datos sin filtrar por acceso
    const formattedMenus = flattenMenuTreeWithoutAccess(menuTree);
    
    return { success: true, data: formattedMenus };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// Función para aplanar árbol de menús sin filtrar por acceso
function flattenMenuTreeWithoutAccess(menuTree, level = 0, result = []) {
  menuTree.forEach(menu => {
    result.push({
      id: menu.id,
      name: menu.name,
      level: level,
      groups_id: menu.groups_id
    });
    
    if (menu.children && menu.children.length) {
      flattenMenuTreeWithoutAccess(menu.children, level + 1, result);
    }
  });
  
  return result;
}

// Añadir nuevas funciones para obtener permisos y reglas de un grupo específico

// Función para obtener los permisos de acceso de un grupo
function getGroupAccessRights(config, groupId) {
  try {
    // Obtener todos los módulos instalados
    const installedModules = callOdooAPI(config, 'ir.module.module', 'search_read', 
      [[['state', '=', 'installed']]],
      { fields: ['id', 'name', 'shortdesc'] }
    );
    
    if (!installedModules || installedModules.length === 0) {
      return { success: true, data: [] };
    }
    
    // Inicializar array para almacenar todos los derechos
    let allRights = [];
    
    // Para cada módulo, obtener sus modelos y luego los permisos asociados
    for (const module of installedModules) {
      try {
        // Obtener modelos del módulo
        const moduleModels = getModuleModels(config, module.id);
        
        if (moduleModels.success && moduleModels.data && moduleModels.data.length > 0) {
          const modelIds = moduleModels.data.map(model => model.id);
          
          // Buscar permisos para estos modelos y este grupo
          const accessRights = callOdooAPI(config, 'ir.model.access', 'search_read', 
            [[['model_id', 'in', modelIds], ['group_id', '=', parseInt(groupId)]]],
            { fields: ['id', 'name', 'model_id', 'perm_read', 'perm_write', 'perm_create', 'perm_unlink'] }
          );
          
          if (accessRights && accessRights.length > 0) {
            // Formatear y añadir el nombre del módulo
            const formattedRights = formatAccessRights(accessRights).map(right => ({
              ...right,
              module_name: module.shortdesc
            }));
            
            allRights = [...allRights, ...formattedRights];
          }
        }
      } catch (moduleError) {
        // Ignorar errores en módulos individuales para no interrumpir todo el proceso
        Logger.log(`Error al procesar módulo ${module.name}: ${moduleError.toString()}`);
      }
    }
    
    // Ordenar por nombre de módulo y luego por nombre de modelo
    allRights.sort((a, b) => {
      if (a.module_name !== b.module_name) {
        return a.module_name.localeCompare(b.module_name);
      }
      return a.model_name.localeCompare(b.model_name);
    });
    
    return { success: true, data: allRights };
  } catch (error) {
    Logger.log(`Error en getGroupAccessRights: ${error.toString()}`);
    return { success: false, error: error.toString() };
  }
}

// Función para obtener las reglas de registro de un grupo
function getGroupRecordRules(config, groupId) {
  try {
    // Obtener todos los módulos instalados
    const installedModules = callOdooAPI(config, 'ir.module.module', 'search_read', 
      [[['state', '=', 'installed']]],
      { fields: ['id', 'name', 'shortdesc'] }
    );
    
    if (!installedModules || installedModules.length === 0) {
      return { success: true, data: [] };
    }
    
    // Inicializar array para almacenar todas las reglas
    let allRules = [];
    
    // Para cada módulo, obtener sus modelos y luego las reglas asociadas
    for (const module of installedModules) {
      try {
        // Obtener modelos del módulo
        const moduleModels = getModuleModels(config, module.id);
        
        if (moduleModels.success && moduleModels.data && moduleModels.data.length > 0) {
          const modelNames = moduleModels.data.map(model => model.model);
          
          // Buscar reglas para estos modelos y este grupo
          const recordRules = callOdooAPI(config, 'ir.rule', 'search_read', 
            [[['model_id.model', 'in', modelNames], ['groups', 'in', [parseInt(groupId)]]]],
            { fields: ['id', 'name', 'model_id', 'domain_force', 'global'] }
          );
          
          if (recordRules && recordRules.length > 0) {
            // Formatear y añadir el nombre del módulo
            const formattedRules = formatRecordRules(recordRules).map(rule => ({
              ...rule,
              module_name: module.shortdesc
            }));
            
            allRules = [...allRules, ...formattedRules];
          }
        }
      } catch (moduleError) {
        // Ignorar errores en módulos individuales para no interrumpir todo el proceso
        Logger.log(`Error al procesar módulo ${module.name}: ${moduleError.toString()}`);
      }
    }
    
    // Ordenar por nombre de módulo y luego por nombre de modelo
    allRules.sort((a, b) => {
      if (a.module_name !== b.module_name) {
        return a.module_name.localeCompare(b.module_name);
      }
      return a.model_name.localeCompare(b.model_name);
    });
    
    return { success: true, data: allRules };
  } catch (error) {
    Logger.log(`Error en getGroupRecordRules: ${error.toString()}`);
    return { success: false, error: error.toString() };
  }
}
