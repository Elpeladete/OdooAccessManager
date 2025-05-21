// Archivo: codigo_permissions.gs - Funciones relacionadas con permisos

// ------ DERECHOS DE ACCESO ------

// Obtener derechos de acceso
function getAccessRights(config, entityType, entityId, moduleId) {
  try {
    // Registrar información de diagnóstico
    Logger.log(`Buscando permisos para: entityType=${entityType}, entityId=${entityId}, moduleId=${moduleId}`);
    
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
    
    // Obtener modelos del módulo
    const moduleModels = getModuleModels(config, moduleId);
    
    if (!moduleModels.success || !moduleModels.data || moduleModels.data.length === 0) {
      Logger.log("No se encontraron modelos para este módulo");
      return { 
        success: true, 
        data: [],
        debug: {
          message: "No existen modelos definidos para este módulo",
          moduleName: moduleName
        }
      };
    }
    
    Logger.log(`Modelos encontrados para el módulo: ${moduleModels.data.length}`);
    
    const modelIds = moduleModels.data.map(model => model.id);
    
    // Obtener todos los permisos para los modelos del módulo
    // Esto es útil para diagnóstico
    const allAccessRights = callOdooAPI(config, 'ir.model.access', 'search_read', 
      [[['model_id', 'in', modelIds]]],
      { fields: ['id', 'name', 'model_id', 'group_id', 'perm_read', 'perm_write', 'perm_create', 'perm_unlink'] }
    );
    
    Logger.log(`Total de permisos para modelos del módulo: ${allAccessRights ? allAccessRights.length : 0}`);
    
    // Construir dominio de búsqueda según el tipo de entidad
    let domain = [['model_id', 'in', modelIds]];
    
    if (entityType === 'user') {
      // Para usuarios, buscamos permisos para sus grupos
      const user = callOdooAPI(config, 'res.users', 'read', 
        [entityId],
        { fields: ['groups_id'] }
      );
      
      if (!user || !user.length || !user[0].groups_id || user[0].groups_id.length === 0) {
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
    
    Logger.log(`Dominio de búsqueda: ${JSON.stringify(domain)}`);
    
    // Obtener derechos de acceso
    const accessRights = callOdooAPI(config, 'ir.model.access', 'search_read', 
      [domain],
      { fields: ['id', 'name', 'model_id', 'group_id', 'perm_read', 'perm_write', 'perm_create', 'perm_unlink'] }
    );
    
    Logger.log(`Permisos encontrados: ${accessRights ? accessRights.length : 0}`);
    
    if (accessRights && accessRights.length > 0) {
      // Formatear datos
      const formattedRights = formatAccessRights(accessRights);
      
      return { 
        success: true, 
        data: formattedRights,
        debug: {
          message: "Se encontraron permisos para esta entidad",
          totalPermisos: allAccessRights ? allAccessRights.length : 0,
          permisosEncontrados: accessRights.length
        }
      };
    }
    
    // Si no se encontraron permisos para la entidad, buscar permisos globales
    if (entityType === 'group') {
      Logger.log("No se encontraron permisos específicos, buscando permisos globales");
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
          message: "No se encontraron permisos para esta entidad ni permisos globales",
          totalPermisos: allAccessRights ? allAccessRights.length : 0
        }
      };
    }
    
    return { 
      success: true, 
      data: [],
      debug: {
        message: "No se encontraron permisos para esta entidad",
        totalPermisos: allAccessRights ? allAccessRights.length : 0
      }
    };
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

// Función para obtener todos los permisos de un módulo sin filtrar por usuario/grupo
function getAllModuleAccessRights(config, moduleId) {
  try {
    // Registrar información de diagnóstico
    Logger.log(`Buscando todos los permisos para el módulo ID: ${moduleId}`);
    
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
    
    // Obtener modelos del módulo
    const moduleModels = getModuleModels(config, moduleId);
    
    if (!moduleModels.success || !moduleModels.data || moduleModels.data.length === 0) {
      Logger.log("No se encontraron modelos para este módulo");
      return { 
        success: true, 
        data: [],
        debug: {
          message: "No existen modelos definidos para este módulo",
          moduleName: moduleName
        }
      };
    }
    
    Logger.log(`Modelos encontrados para el módulo: ${moduleModels.data.length}`);
    // Registrar los modelos para depuración
    moduleModels.data.forEach((model, index) => {
      Logger.log(`Modelo ${index + 1}: ${model.name} (${model.model})`);
    });
    
    const modelIds = moduleModels.data.map(model => model.id);
    
    // Obtener todos los permisos para los modelos del módulo
    const accessRights = callOdooAPI(config, 'ir.model.access', 'search_read', 
      [[['model_id', 'in', modelIds]]],
      { fields: ['id', 'name', 'model_id', 'group_id', 'perm_read', 'perm_write', 'perm_create', 'perm_unlink'] }
    );
    
    Logger.log(`Total de permisos encontrados: ${accessRights ? accessRights.length : 0}`);
    
    if (accessRights && accessRights.length > 0) {
      // Formatear datos
      const formattedRights = formatAccessRights(accessRights);
      
      return { 
        success: true, 
        data: formattedRights
      };
    }
    
    return { 
      success: true, 
      data: [],
      debug: {
        message: "No se encontraron permisos definidos para los modelos de este módulo",
        moduleName: moduleName,
        totalModelos: moduleModels.data.length
      }
    };
  } catch (error) {
    Logger.log(`Error en getAllModuleAccessRights: ${error.toString()}`);
    return { 
      success: false, 
      error: error.toString(),
      debug: {
        message: "Error al obtener permisos del módulo",
        error: error.toString()
      }
    };
  }
}

// ------ REGLAS DE REGISTRO ------

// Obtener reglas de registro
function getRecordRules(config, entityType, entityId, moduleId) {
  try {
    // Registrar información de diagnóstico
    Logger.log(`Buscando reglas para: entityType=${entityType}, entityId=${entityId}, moduleId=${moduleId}`);
    
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
    
    // Obtener modelos del módulo
    const moduleModels = getModuleModels(config, moduleId);
    
    if (!moduleModels.success || !moduleModels.data || moduleModels.data.length === 0) {
      Logger.log("No se encontraron modelos para este módulo");
      return { 
        success: true, 
        data: [],
        debug: {
          message: "No existen modelos definidos para este módulo",
          moduleName: moduleName
        }
      };
    }
    
    Logger.log(`Modelos encontrados para el módulo: ${moduleModels.data.length}`);
    
    const modelNames = moduleModels.data.map(model => model.model);
    
    // Obtener todas las reglas para los modelos del módulo
    // Esto es útil para diagnóstico
    const allRecordRules = callOdooAPI(config, 'ir.rule', 'search_read', 
      [[['model_id.model', 'in', modelNames]]],
      { fields: ['id', 'name', 'model_id', 'domain_force', 'global', 'groups'] }
    );
    
    Logger.log(`Total de reglas para modelos del módulo: ${allRecordRules ? allRecordRules.length : 0}`);
    
    // Construir dominio de búsqueda según el tipo de entidad
    let domain = [['model_id.model', 'in', modelNames]];
    
    if (entityType === 'user') {
      // Para usuarios, buscamos reglas para sus grupos o reglas globales
      const user = callOdooAPI(config, 'res.users', 'read', 
        [entityId],
        { fields: ['groups_id'] }
      );
      
      if (!user || !user.length || !user[0].groups_id || user[0].groups_id.length === 0) {
        Logger.log("Usuario no tiene grupos asignados, buscando solo reglas globales");
        domain.push(['global', '=', true]);
      } else {
        Logger.log(`Grupos del usuario: ${user[0].groups_id.join(', ')}`);
        // Buscar reglas globales o reglas que apliquen a los grupos del usuario
        domain.push('|', ['global', '=', true], ['groups', 'in', user[0].groups_id]);
      }
    } else {
      // Para grupos, buscamos reglas que apliquen al grupo o reglas globales
      domain.push('|', ['global', '=', true], ['groups', 'in', [parseInt(entityId)]]);
    }
    
    Logger.log(`Dominio de búsqueda: ${JSON.stringify(domain)}`);
    
    // Obtener reglas de registro
    const recordRules = callOdooAPI(config, 'ir.rule', 'search_read', 
      [domain],
      { fields: ['id', 'name', 'model_id', 'domain_force', 'global', 'groups'] }
    );
    
    Logger.log(`Reglas encontradas: ${recordRules ? recordRules.length : 0}`);
    
    if (recordRules && recordRules.length > 0) {
      // Formatear datos
      const formattedRules = formatRecordRules(recordRules);
      
      return { 
        success: true, 
        data: formattedRules,
        debug: {
          message: "Se encontraron reglas para esta entidad",
          totalReglas: allRecordRules ? allRecordRules.length : 0,
          reglasEncontradas: recordRules.length
        }
      };
    }
    
    // Si no se encontraron reglas específicas, pero hay reglas globales para diagnóstico
    if (allRecordRules && allRecordRules.length > 0) {
      return { 
        success: true, 
        data: [],
        debug: {
          message: "Existen reglas para los modelos de este módulo, pero ninguna aplica a la selección actual",
          totalReglas: allRecordRules.length
        }
      };
    }
    
    return { 
      success: true, 
      data: [],
      debug: {
        message: "No existen reglas definidas para los modelos de este módulo",
        totalReglas: 0
      }
    };
  } catch (error) {
    Logger.log(`Error en getRecordRules: ${error.toString()}`);
    return { 
      success: false, 
      error: error.toString(),
      debug: {
        message: "Error al obtener reglas",
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
          // Primero verificar si el grupo ya está en la regla
          const currentRule = callOdooAPI(config, 'ir.rule', 'read', 
            [parseInt(rule.id)],
            { fields: ['groups'] }
          );
          
          if (currentRule && currentRule.length && currentRule[0].groups) {
            const hasGroup = currentRule[0].groups.includes(parseInt(entityId));
            
            if (!hasGroup) {
              // Añadir el grupo a la regla
              callOdooAPI(config, 'ir.rule', 'write', [
                parseInt(rule.id),
                { groups: [[4, parseInt(entityId)]] }
              ]);
            }
          }
        }
      }
    }
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// Función para obtener todas las reglas de un módulo sin filtrar por usuario/grupo
function getAllModuleRecordRules(config, moduleId) {
  try {
    // Obtener información del módulo
    const module = callOdooAPI(config, 'ir.module.module', 'read', 
      [moduleId],
      { fields: ['name'] }
    );
    
    if (!module || !module.length) {
      return { 
        success: false, 
        error: 'Módulo no encontrado'
      };
    }
    
    const moduleName = module[0].name;
    
    // Obtener modelos del módulo
    const moduleModels = getModuleModels(config, moduleId);
    
    if (!moduleModels.success || !moduleModels.data || moduleModels.data.length === 0) {
      return { 
        success: true, 
        data: []
      };
    }
    
    const modelNames = moduleModels.data.map(model => model.model);
    
    // Obtener todas las reglas para los modelos del módulo
    const recordRules = callOdooAPI(config, 'ir.rule', 'search_read', 
      [[['model_id.model', 'in', modelNames]]],
      { fields: ['id', 'name', 'model_id', 'domain_force', 'global', 'groups'] }
    );
    
    if (recordRules && recordRules.length > 0) {
      // Formatear datos
      const formattedRules = formatRecordRules(recordRules);
      
      return { 
        success: true, 
        data: formattedRules
      };
    }
    
    return { 
      success: true, 
      data: []
    };
  } catch (error) {
    return { 
      success: false, 
      error: error.toString()
    };
  }
}

// ------ ACCESO A MENÚS ------

// Obtener acceso a menús
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

// Función para obtener todos los menús de un módulo sin filtrar por acceso
function getAllModuleMenus(config, moduleId) {
  try {
    // Obtener información del módulo
    const module = callOdooAPI(config, 'ir.module.module', 'read', 
      [moduleId],
      { fields: ['name'] }
    );
    
    if (!module || !module.length) {
      return { 
        success: false, 
        error: 'Módulo no encontrado'
      };
    }
    
    const moduleName = module[0].name;
    
    // Buscar menús relacionados con el módulo
    const menuIds = callOdooAPI(config, 'ir.model.data', 'search_read', 
      [[['module', '=', moduleName], ['model', '=', 'ir.ui.menu']]],
      { fields: ['res_id'] }
    );
    
    if (!menuIds || !menuIds.length) {
      // Intentar una búsqueda más amplia
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
            // Construir árbol de menús
            const menuTree = buildMenuTree(relatedMenus);
            
            // Formatear datos sin filtrar por acceso
            const formattedMenus = flattenMenuTreeWithoutAccess(menuTree);
            
            return { 
              success: true, 
              data: formattedMenus
            };
          }
        }
      }
      
      return { 
        success: true, 
        data: []
      };
    }
    
    const ids = menuIds.map(item => item.res_id);
    
    // Obtener información de los menús
    const menus = callOdooAPI(config, 'ir.ui.menu', 'read', 
      [ids],
      { fields: ['id', 'name', 'parent_id', 'groups_id'] }
    );
    
    if (!menus || !menus.length) {
      return { 
        success: true, 
        data: []
      };
    }
    
    // Construir árbol de menús
    const menuTree = buildMenuTree(menus);
    
    // Formatear datos sin filtrar por acceso
    const formattedMenus = flattenMenuTreeWithoutAccess(menuTree);
    
    return { 
      success: true, 
      data: formattedMenus
    };
  } catch (error) {
    return { 
      success: false, 
      error: error.toString()
    };
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

// ------ PERMISOS DE GRUPOS ------

// Función para obtener los permisos de acceso de un grupo
function getGroupAccessRights(config, groupId) {
  try {
    // Obtener módulos instalados, pero limitar la cantidad
    const installedModules = callOdooAPI(config, 'ir.module.module', 'search_read', 
      [[['state', '=', 'installed']]],
      { fields: ['id', 'name', 'shortdesc'], limit: 10 } // Limitar a 10 módulos
    );
    
    if (!installedModules || installedModules.length === 0) {
      return { success: true, data: [] };
    }
    
    // Inicializar array para almacenar todos los derechos
    let allRights = [];
    
    // Para cada módulo, obtener sus modelos y luego los permisos asociados
    for (const module of installedModules) {
      try {
        // Obtener modelos del módulo, pero limitar la cantidad
        const moduleModelsResult = callOdooAPI(config, 'ir.model', 'search_read', 
          [[['model', 'like', module.name + '.%']]],
          { fields: ['id', 'name', 'model', 'state'], limit: 10 } // Limitar a 10 modelos por módulo
        );
        
        const moduleModels = moduleModelsResult || [];
        
        if (moduleModels.length > 0) {
          const modelIds = moduleModels.map(model => model.id);
          
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
    
    return { 
      success: true, 
      data: allRights,
      pagination: {
        totalModules: installedModules.length,
        hasMore: false // Indicar si hay más módulos para cargar
      }
    };
  } catch (error) {
    Logger.log(`Error en getGroupAccessRights: ${error.toString()}`);
    return { success: false, error: error.toString() };
  }
}

// Función para obtener las reglas de registro de un grupo
function getGroupRecordRules(config, groupId) {
  try {
    // Obtener módulos instalados, pero limitar la cantidad
    const installedModules = callOdooAPI(config, 'ir.module.module', 'search_read', 
      [[['state', '=', 'installed']]],
      { fields: ['id', 'name', 'shortdesc'], limit: 10 } // Limitar a 10 módulos
    );
    
    if (!installedModules || installedModules.length === 0) {
      return { success: true, data: [] };
    }
    
    // Inicializar array para almacenar todas las reglas
    let allRules = [];
    
    // Para cada módulo, obtener sus modelos y luego las reglas asociadas
    for (const module of installedModules) {
      try {
        // Obtener modelos del módulo, pero limitar la cantidad
        const moduleModelsResult = callOdooAPI(config, 'ir.model', 'search_read', 
          [[['model', 'like', module.name + '.%']]],
          { fields: ['id', 'name', 'model', 'state'], limit: 10 } // Limitar a 10 modelos por módulo
        );
        
        const moduleModels = moduleModelsResult || [];
        
        if (moduleModels.length > 0) {
          const modelNames = moduleModels.map(model => model.model);
          
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
    
    return { 
      success: true, 
      data: allRules,
      pagination: {
        totalModules: installedModules.length,
        hasMore: false // Indicar si hay más módulos para cargar
      }
    };
  } catch (error) {
    Logger.log(`Error en getGroupRecordRules: ${error.toString()}`);
    return { success: false, error: error.toString() };
  }
}

// ------ BÚSQUEDA POR MODELO ------

// Añadir una función para buscar permisos por modelo
function searchPermissionsByModel(config, modelName) {
  try {
    // Buscar modelos que coincidan con el nombre o la etiqueta
    const models = callOdooAPI(config, 'ir.model', 'search_read', 
      [['|', ['model', 'ilike', modelName], ['name', 'ilike', modelName]]],
      { fields: ['id', 'name', 'model', 'state'], limit: 10 }
    );
    
    if (!models || models.length === 0) {
      return { 
        success: true, 
        data: {
          model: null,
          accessRights: [],
          recordRules: []
        },
        message: 'No se encontraron modelos que coincidan con la búsqueda'
      };
    }
    
    // Obtener el primer modelo encontrado
    const model = models[0];
    const modelTechNames = models.map(m => m.model);
    const modelIds = models.map(m => m.id);
    
    // Buscar permisos de acceso para estos modelos
    const accessRights = callOdooAPI(config, 'ir.model.access', 'search_read', 
      [[['model_id', 'in', modelIds]]],
      { fields: ['id', 'name', 'model_id', 'group_id', 'perm_read', 'perm_write', 'perm_create', 'perm_unlink'] }
    );
    
    // Buscar reglas de registro para estos modelos
    const recordRules = callOdooAPI(config, 'ir.rule', 'search_read', 
      [[['model_id.model', 'in', modelTechNames]]],
      { fields: ['id', 'name', 'model_id', 'domain_force', 'global', 'groups'] }
    );
    
    // Formatear los resultados
    const formattedAccessRights = accessRights ? formatAccessRights(accessRights) : [];
    const formattedRecordRules = recordRules ? formatRecordRules(recordRules) : [];
    
    // Obtener información de los grupos para cada permiso
    if (formattedAccessRights.length > 0) {
      const groupIds = [...new Set(formattedAccessRights
        .filter(right => right.group_id)
        .map(right => right.group_id))];
      
      if (groupIds.length > 0) {
        const groups = callOdooAPI(config, 'res.groups', 'read', 
          [groupIds],
          { fields: ['id', 'name', 'category_id'] }
        );
        
        if (groups) {
          const groupMap = {};
          groups.forEach(group => {
            groupMap[group.id] = group;
          });
          
          formattedAccessRights.forEach(right => {
            if (right.group_id && groupMap[right.group_id]) {
              right.group_name = groupMap[right.group_id].name;
              right.group_category = groupMap[right.group_id].category_id ? groupMap[right.group_id].category_id[1] : null;
            }
          });
        }
      }
    }
    
    // Obtener información de los grupos para cada regla
    if (formattedRecordRules.length > 0) {
      const rulesWithGroups = formattedRecordRules.filter(rule => !rule.global && rule.groups && rule.groups.length > 0);
      const allGroupIds = [];
      
      rulesWithGroups.forEach(rule => {
        rule.groups.forEach(groupId => {
          if (!allGroupIds.includes(groupId)) {
            allGroupIds.push(groupId);
          }
        });
      });
      
      if (allGroupIds.length > 0) {
        const groups = callOdooAPI(config, 'res.groups', 'read', 
          [allGroupIds],
          { fields: ['id', 'name', 'category_id'] }
        );
        
        if (groups) {
          const groupMap = {};
          groups.forEach(group => {
            groupMap[group.id] = group;
          });
          
          formattedRecordRules.forEach(rule => {
            if (!rule.global && rule.groups) {
              rule.group_names = rule.groups.map(groupId => 
                groupMap[groupId] ? groupMap[groupId].name : 'Grupo Desconocido'
              );
            }
          });
        }
      }
    }
    
    return { 
      success: true, 
      data: {
        model: model,
        accessRights: formattedAccessRights,
        recordRules: formattedRecordRules
      }
    };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// Añadir función para crear un permiso para un modelo
function addModelPermission(config, permissionData) {
  try {
    // Crear el permiso
    const result = callOdooAPI(config, 'ir.model.access', 'create', [{
      name: `access_${permissionData.model.replace('.', '_')}_${permissionData.group_id ? 'group_' + permissionData.group_id : 'all'}`,
      model_id: permissionData.model_id,
      group_id: permissionData.group_id || false,
      perm_read: permissionData.perm_read,
      perm_write: permissionData.perm_write,
      perm_create: permissionData.perm_create,
      perm_unlink: permissionData.perm_unlink
    }]);
    
    if (result) {
      return { success: true, data: result };
    } else {
      return { success: false, error: 'No se pudo crear el permiso' };
    }
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// Añadir función para crear una regla para un modelo
function addModelRule(config, ruleData) {
  try {
    // Preparar la regla
    const newRule = {
      name: ruleData.name,
      model_id: ruleData.model_id,
      domain_force: ruleData.domain_force,
      global: ruleData.global
    };
    
    // Si no es global, añadir grupos
    if (!ruleData.global && ruleData.groups && ruleData.groups.length > 0) {
      newRule.groups = ruleData.groups.map(groupId => [4, parseInt(groupId)]);
    }
    
    // Crear la regla
    const result = callOdooAPI(config, 'ir.rule', 'create', [newRule]);
    
    if (result) {
      return { success: true, data: result };
    } else {
      return { success: false, error: 'No se pudo crear la regla' };
    }
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}
