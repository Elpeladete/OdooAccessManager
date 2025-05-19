function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
      .setTitle('Odoo Access Manager')
      .setFaviconUrl('https://example.com/favicon.ico');
}

function getUserPermissions(userId) {
  // Lógica para obtener permisos de usuario desde Odoo
}

function addUserPermission(userId, permission) {
  // Lógica para agregar un permiso a un usuario en Odoo
}

function removeUserPermission(userId, permission) {
  // Lógica para eliminar un permiso de un usuario en Odoo
}

function listUsers() {
  // Lógica para listar usuarios desde Odoo
}