// Thin wrapper around the Azure Table Storage REST API.
// All calls authenticate with the SAS token from config.js.
var TableStorage = {
  baseUrl: function () {
    return "https://" + CONFIG.storageAccount + ".table.core.windows.net";
  },

  _headers: function (method) {
    var h = {
      Accept: "application/json;odata=nometadata",
      "x-ms-version": "2023-11-03"
    };
    if (method === "POST" || method === "PUT" || method === "MERGE") {
      h["Content-Type"] = "application/json";
    }
    if (method === "POST") {
      h["Prefer"] = "return-no-content";
    }
    return h;
  },

  // Query all entities in a table, with an optional OData $filter.
  query: function (table, filter) {
    var url = this.baseUrl() + "/" + table + "()" + CONFIG.sasToken;
    if (filter) {
      url += "&$filter=" + encodeURIComponent(filter);
    }
    return fetch(url, { headers: this._headers("GET") }).then(function (resp) {
      if (!resp.ok) return resp.text().then(function (t) { throw new Error("Query failed: " + resp.status + " " + t); });
      return resp.json().then(function (data) { return data.value || []; });
    });
  },

  // Get a single entity by PartitionKey + RowKey. Returns null on 404.
  get: function (table, pk, rk) {
    var url = this.baseUrl() + "/" + table +
      "(PartitionKey='" + encodeURIComponent(pk) + "',RowKey='" + encodeURIComponent(rk) + "')" +
      CONFIG.sasToken;
    return fetch(url, { headers: this._headers("GET") }).then(function (resp) {
      if (resp.status === 404) return null;
      if (!resp.ok) return resp.text().then(function (t) { throw new Error("Get failed: " + resp.status + " " + t); });
      return resp.json();
    });
  },

  // Insert-or-replace (upsert) an entity.
  upsert: function (table, entity) {
    var url = this.baseUrl() + "/" + table +
      "(PartitionKey='" + encodeURIComponent(entity.PartitionKey) + "',RowKey='" + encodeURIComponent(entity.RowKey) + "')" +
      CONFIG.sasToken;
    return fetch(url, {
      method: "PUT",
      headers: this._headers("PUT"),
      body: JSON.stringify(entity)
    }).then(function (resp) {
      if (!resp.ok) return resp.text().then(function (t) { throw new Error("Upsert failed: " + resp.status + " " + t); });
    });
  },

  // Insert a new entity. Throws "DUPLICATE" on 409 Conflict.
  insert: function (table, entity) {
    var url = this.baseUrl() + "/" + table + CONFIG.sasToken;
    return fetch(url, {
      method: "POST",
      headers: this._headers("POST"),
      body: JSON.stringify(entity)
    }).then(function (resp) {
      if (resp.status === 409) throw new Error("DUPLICATE");
      if (!resp.ok) return resp.text().then(function (t) { throw new Error("Insert failed: " + resp.status + " " + t); });
    });
  },

  // Delete an entity by PartitionKey + RowKey.
  del: function (table, pk, rk) {
    var url = this.baseUrl() + "/" + table +
      "(PartitionKey='" + encodeURIComponent(pk) + "',RowKey='" + encodeURIComponent(rk) + "')" +
      CONFIG.sasToken;
    var h = this._headers("DELETE");
    h["If-Match"] = "*";
    return fetch(url, { method: "DELETE", headers: h }).then(function (resp) {
      if (!resp.ok) return resp.text().then(function (t) { throw new Error("Delete failed: " + resp.status + " " + t); });
    });
  }
};
