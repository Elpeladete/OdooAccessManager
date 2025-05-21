# Gestor de Permisos Odoo

Aplicación de Google Apps Script para gestionar permisos, usuarios, grupos y módulos en instancias de Odoo.

## Estructura del Proyecto

El proyecto está organizado en múltiples archivos para facilitar el mantenimiento:

### Archivos de Backend (GS)

- **codigo_main.gs**: Funciones principales y de configuración.
- **codigo_users.gs**: Funciones relacionadas con usuarios y grupos.
- **codigo_modules.gs**: Funciones relacionadas con módulos y aplicaciones.
- **codigo_permissions.gs**: Funciones relacionadas con permisos (derechos de acceso, reglas de registro, acceso a menús).
- **codigo_utils.gs**: Funciones utilitarias y conexión XML-RPC.

### Archivos de Frontend (HTML/JavaScript)

- **Index.html**: Archivo principal HTML con la estructura de la aplicación.
- **script_main.html**: Funciones de JavaScript principales e inicialización.
- **script_ui.html**: Funciones relacionadas con la interfaz de usuario (modales, toasts, etc.).
- **script_users.html**: Funciones relacionadas con la gestión de usuarios y grupos.
- **script_modules.html**: Funciones relacionadas con la gestión de módulos.
- **script_permissions.html**: Funciones comunes relacionadas con permisos.
- **script_accessRights.html**: Funciones específicas para derechos de acceso.
- **script_recordRules.html**: Funciones específicas para reglas de registro.
- **script_menuAccess.html**: Funciones específicas para acceso a menús.

### Archivos de Estilos (CSS)

- **styles/variables.html**: Variables CSS para colores, fuentes, etc.
- **styles/base.html**: Estilos básicos y reset CSS.
- **styles/layout.html**: Estilos para la estructura general de la aplicación.
- **styles/components.html**: Estilos para componentes reutilizables (modales, toasts, etc.).
- **styles/users.html**: Estilos específicos para la sección de usuarios y grupos.
- **styles/modules.html**: Estilos específicos para la sección de módulos.
- **styles/permissions.html**: Estilos específicos para la sección de permisos.

## Desarrollo

Este proyecto ha sido reestructurado para mejorar el mantenimiento y la legibilidad del código. La estructura anterior tenía archivos muy grandes que dificultaban el mantenimiento.

### Notas sobre Google Apps Script

Google Apps Script tiene algunas limitaciones:

1. No soporta subdirectorios reales para organizar los archivos.
2. Los archivos HTML y GS deben estar en el nivel raíz.
3. Para simular subdirectorios, utilizamos una convención de nombres con barras bajas y nombres descriptivos.

## Uso

1. Abre la aplicación.
2. Configura la conexión a tu instancia de Odoo.
3. Explora y gestiona usuarios, grupos, módulos y permisos.

## Licencia

© D&E AG TECH. Todos los derechos reservados.
