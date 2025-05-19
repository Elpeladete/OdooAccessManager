# Odoo Access Manager

## Descripción
Odoo Access Manager es una aplicación web diseñada para gestionar de manera gráfica los permisos de las cuentas de Odoo. Permite a los administradores agregar, eliminar y modificar permisos de usuarios de forma sencilla y eficiente.

## Estructura del Proyecto
El proyecto está organizado en las siguientes carpetas y archivos:

- **Code.gs**: Punto de entrada del script de Google Apps. Define funciones que se ejecutan en el servidor.
- **appsscript.json**: Configuración del proyecto de Google Apps Script, incluyendo propiedades y permisos necesarios.
- **server/**: Contiene los servicios que manejan la lógica de negocio.
  - **OdooService.gs**: Clase que maneja la conexión y operaciones relacionadas con la API de Odoo.
  - **PermissionService.gs**: Clase que gestiona los permisos de los usuarios en Odoo.
  - **UserService.gs**: Clase que se encarga de la gestión de usuarios en Odoo.
- **client/**: Contiene los archivos de la interfaz de usuario.
  - **index.html**: Página principal de la aplicación.
  - **css/**: Contiene los estilos CSS de la aplicación.
    - **style.html**: Estilos para la apariencia visual de los componentes.
  - **js/**: Contiene los scripts de la aplicación.
    - **main.html**: Script principal que inicializa la interfaz de usuario.
    - **utilities.html**: Funciones utilitarias para tareas comunes.
  - **components/**: Contiene los componentes reutilizables de la interfaz.
    - **sidebar.html**: Componente de la barra lateral para la navegación.
    - **userTable.html**: Componente que muestra la lista de usuarios y sus permisos.
    - **permissionForm.html**: Componente para gestionar permisos.

## Instalación
1. Clona este repositorio en tu máquina local.
2. Abre el proyecto en Google Apps Script.
3. Configura las credenciales necesarias para la API de Odoo en `OdooService.gs`.
4. Publica la aplicación como una aplicación web.

## Uso
Una vez que la aplicación esté configurada y publicada, accede a la URL proporcionada para comenzar a gestionar los permisos de los usuarios de Odoo de manera gráfica.