class OdooService {
  constructor(url, db, username, password) {
    this.url = url;
    this.db = db;
    this.username = username;
    this.password = password;
    this.sessionId = null;
  }

  authenticate() {
    const response = UrlFetchApp.fetch(this.url + '/web/session/authenticate', {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({
        jsonrpc: "2.0",
        params: {
          db: this.db,
          login: this.username,
          password: this.password
        }
      })
    });
    
    const result = JSON.parse(response.getContentText());
    if (result.error) {
      throw new Error(result.error.message);
    }
    
    this.sessionId = result.result.session_id;
    return this.sessionId;
  }

  callMethod(model, method, args) {
    const response = UrlFetchApp.fetch(this.url + '/web/dataset/call_kw', {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({
        jsonrpc: "2.0",
        method: "call",
        params: {
          model: model,
          method: method,
          args: args,
          kwargs: {},
          session_id: this.sessionId
        }
      })
    });
    
    const result = JSON.parse(response.getContentText());
    if (result.error) {
      throw new Error(result.error.message);
    }
    
    return result.result;
  }
}