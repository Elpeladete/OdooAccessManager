// Archivo: codigo_modules.gs - Funciones relacionadas con módulos y aplicaciones

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
    // Obtener información del módulo
    const module = callOdooAPI(config, 'ir.module.module', 'read', 
      [moduleId],
      { fields: ['name'] }
    );
    
    if (!module || !module.length) {
      return { success: false, error: 'Módulo no encontrado' };
    }
    
    const moduleName = module[0].name;
    
    // Buscar modelos que pertenecen al módulo por nombre
    const models = callOdooAPI(config, 'ir.model', 'search_read', 
      [[['model', 'like', moduleName + '.%']]],
      { fields: ['id', 'name', 'model', 'state'] }
    );
    
    // Buscar también modelos que pueden estar registrados con ir.model.data
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

// Añadir función para obtener un modelo por su nombre técnico
function getModelByTechName(config, modelTechName) {
  try {
    const models = callOdooAPI(config, 'ir.model', 'search_read', 
      [[['model', '=', modelTechName]]],
      { fields: ['id', 'name', 'model', 'state'] }
    );
    
    if (!models || models.length === 0) {
      return { success: false, error: 'Modelo no encontrado' };
    }
    
    return { 
      success: true, 
      data: {
        id: models[0].id,
        name: models[0].name,
        model: models[0].model,
        state: models[0].state
      } 
    };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}
