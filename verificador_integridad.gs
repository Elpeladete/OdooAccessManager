
/**
 * Verificador de integridad para el proyecto OdooAccessManager
 * Este script verifica que todas las funciones necesarias estén disponibles
 * y que no haya conflictos entre los archivos.
 */

function ejecutarVerificacionIntegridad() {
  const errores = [];
  const advertencias = [];
  
  // Verificar disponibilidad de funciones principales en backend
  const funcionesBackend = [
    'getOdooConfig',
    'saveOdooConfig',
    'testOdooConnection',
    'callOdooAPI',
    'getOdooUsersAndGroups',
    'getOdooModules',
    'getAccessRights',
    'getRecordRules',
    'getMenuAccess',
    'updateAccessRight',
    'doGet',
    'include'
  ];
  
  verificarFuncionesExistentes(funcionesBackend, errores);
  
  // Verificar que todos los archivos HTML existan
  const archivosHTML = [
    'Index.html',
    'script_main.html',
    'script_ui.html',
    'script_users.html',
    'script_modules.html',
    'script_permissions.html',
    'script_accessRights.html',
    'script_recordRules.html',
    'script_menuAccess.html',
    'styles.html'
  ];
  
  verificarArchivosExistentes(archivosHTML, errores);
  
  // Verificar que los archivos originales no se incluyan en Index.html
  const archivoIndex = HtmlService.createHtmlOutputFromFile('Index.html').getContent();
  if (archivoIndex.includes('include(\'script\')') || archivoIndex.includes('include("script")')) {
    errores.push('El archivo Index.html todavía incluye el script.html original');
  }
  
  if (archivoIndex.includes('include(\'styles\')') || archivoIndex.includes('include("styles")')) {
    errores.push('El archivo Index.html todavía incluye el styles.html original');
  }
  
  // Generar informe
  if (errores.length === 0 && advertencias.length === 0) {
    return {
      success: true,
      message: 'Verificación de integridad completada. No se encontraron problemas.'
    };
  } else {
    return {
      success: false,
      errors: errores,
      warnings: advertencias
    };
  }
}

/**
 * Verifica que las funciones especificadas existan
 */
function verificarFuncionesExistentes(funciones, errores) {
  funciones.forEach(nombre => {
    try {
      eval(nombre);
    } catch (e) {
      if (e instanceof ReferenceError) {
        errores.push(`Función ${nombre} no está definida`);
      }
    }
  });
}

/**
 * Verifica que los archivos existan
 */
function verificarArchivosExistentes(archivos, errores) {
  archivos.forEach(archivo => {
    try {
      HtmlService.createHtmlOutputFromFile(archivo);
    } catch (e) {
      errores.push(`Archivo ${archivo} no existe o no es accesible`);
    }
  });
}
