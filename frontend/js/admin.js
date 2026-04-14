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

  document.getElementById("clear-votes-btn").addEventListener("click", function () {
    if (!confirm("This will delete ALL votes. Are you sure?")) return;
    clearVotes(false);
  });

  document.getElementById("clear-all-btn").addEventListener("click", function () {
    if (!confirm("This will delete ALL votes AND survey items. Are you sure?")) return;
    clearVotes(true);
  });

  // ---- helpers ----

  function showAdminPanel() {
    adminGate.classList.add("hidden");
    adminPanel.classList.remove("hidden");
    loadItems();
    loadVotes();
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

  function loadVotes() {
    var voteList = document.getElementById("vote-list");
    TableStorage.query("votes").then(function (votes) {
      voteList.innerHTML = "";
      if (votes.length === 0) {
        voteList.innerHTML = '<li style="color:#999;padding:10px;">No votes yet.</li>';
        return;
      }
      votes.forEach(function (v) {
        var li = document.createElement("li");
        li.innerHTML =
          "<span>" + escapeHtml(v.DisplayName || v.RowKey) + "</span>" +
          '<button class="btn btn-danger btn-sm">Remove</button>';
        li.querySelector("button").addEventListener("click", function () {
          if (!confirm('Remove vote from "' + (v.DisplayName || v.RowKey) + '"?')) return;
          TableStorage.del("votes", v.PartitionKey, v.RowKey).then(function () {
            loadVotes();
          }).catch(function (e) {
            showAlert(container, "Failed to remove vote: " + e.message);
          });
        });
        voteList.appendChild(li);
      });
    }).catch(function () {
      voteList.innerHTML = '<li style="color:#999;padding:10px;">Failed to load votes.</li>';
    });
  }

  function clearVotes(clearItems) {
    var status = document.getElementById("reset-status");
    status.style.display = "block";
    status.textContent = "Deleting votes...";

    TableStorage.query("votes").then(function (votes) {
      var deletes = votes.map(function (v) {
        return TableStorage.del("votes", v.PartitionKey, v.RowKey);
      });
      return Promise.all(deletes);
    }).then(function () {
      if (clearItems) {
        items = [];
        return saveItems();
      }
    }).then(function () {
      status.textContent = clearItems
        ? "All votes and items cleared!"
        : "All votes cleared!";
      status.style.color = "#155724";
      if (clearItems) renderItems();
      loadVotes();
      setTimeout(function () { status.style.display = "none"; }, 4000);
    }).catch(function (e) {
      status.textContent = "Error: " + e.message;
      status.style.color = "#721c24";
    });
  }

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }
});
