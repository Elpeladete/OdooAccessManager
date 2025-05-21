// Archivo: codigo_users.gs - Funciones relacionadas con usuarios y grupos

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
    
    const impliedGroupIds = group[0].implied_ids;
    const impliedGroups = callOdooAPI(config, 'res.groups', 'read', 
      [impliedGroupIds],
      { fields: ['id', 'name', 'category_id'] }
    );
    
    const formattedGroups = impliedGroups.map(group => ({
      id: group.id,
      name: group.name,
      category: group.category_id ? group.category_id[1] : null
    }));
    
    return { success: true, data: formattedGroups };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}
