document.addEventListener("DOMContentLoaded", function () {
  if (!checkPasscode()) return;

  var adminGate = document.getElementById("admin-gate");
  var adminPanel = document.getElementById("admin-panel");
  var adminCodeInput = document.getElementById("admin-code");
  var adminLoginBtn = document.getElementById("admin-login-btn");
  var itemInput = document.getElementById("new-item");
  var addBtn = document.getElementById("add-item-btn");
  var itemList = document.getElementById("item-list");
  var container = document.querySelector(".container");

  var items = [];

  // If already unlocked this session, skip the gate.
  if (sessionStorage.getItem("rcv_admin") === CONFIG.adminCode) {
    showAdminPanel();
  }

  adminLoginBtn.addEventListener("click", function () {
    if (adminCodeInput.value === CONFIG.adminCode) {
      sessionStorage.setItem("rcv_admin", CONFIG.adminCode);
      showAdminPanel();
    } else {
      showAlert(adminGate, "Incorrect admin code.");
    }
  });

  adminCodeInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") adminLoginBtn.click();
  });

  addBtn.addEventListener("click", addItem);
  itemInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") addItem();
  });

  // ---- helpers ----

  function showAdminPanel() {
    adminGate.classList.add("hidden");
    adminPanel.classList.remove("hidden");
    loadItems();
  }

  function loadItems() {
    TableStorage.get("survey", "config", "items").then(function (entity) {
      items = entity ? JSON.parse(entity.Items || "[]") : [];
      renderItems();
    }).catch(function () {
      items = [];
      renderItems();
    });
  }

  function renderItems() {
    itemList.innerHTML = "";
    if (items.length === 0) {
      itemList.innerHTML = '<li style="color:#999;padding:10px;">No items yet. Add some above.</li>';
      return;
    }
    items.forEach(function (item, i) {
      var li = document.createElement("li");
      li.innerHTML =
        "<span>" + escapeHtml(item) + "</span>" +
        '<button class="btn btn-danger btn-sm" data-index="' + i + '">Remove</button>';
      li.querySelector("button").addEventListener("click", function () { removeItem(i); });
      itemList.appendChild(li);
    });
  }

  function addItem() {
    var name = itemInput.value.trim();
    if (!name) return;
    if (items.indexOf(name) !== -1) {
      showAlert(container, "Item already exists.");
      return;
    }
    items.push(name);
    saveItems().then(function () {
      itemInput.value = "";
      renderItems();
    });
  }

  function removeItem(index) {
    items.splice(index, 1);
    saveItems().then(function () {
      renderItems();
    });
  }

  function saveItems() {
    return TableStorage.upsert("survey", {
      PartitionKey: "config",
      RowKey: "items",
      Items: JSON.stringify(items)
    }).catch(function (e) {
      showAlert(container, "Failed to save items: " + e.message);
    });
  }

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }
});
