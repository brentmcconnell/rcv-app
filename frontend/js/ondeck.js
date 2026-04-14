document.addEventListener("DOMContentLoaded", function () {
  if (!checkPasscode()) return;

  var adminGate = document.getElementById("admin-gate");
  var adminPanel = document.getElementById("admin-panel");
  var adminCodeInput = document.getElementById("admin-code");
  var adminLoginBtn = document.getElementById("admin-login-btn");
  var ondeckList = document.getElementById("ondeck-list");
  var adminOndeckList = document.getElementById("admin-ondeck-list");
  var container = document.querySelector(".container");

  var ondeckItems = [];

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

  loadOnDeck();

  // ---- helpers ----

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  function showAdminPanel() {
    adminGate.classList.add("hidden");
    adminPanel.classList.remove("hidden");
    renderAdminList();
  }

  function loadOnDeck() {
    TableStorage.get("songs", "config", "ondeck").then(function (entity) {
      ondeckItems = entity ? JSON.parse(entity.Items || "[]") : [];
      renderOnDeck();
      if (!adminPanel.classList.contains("hidden")) {
        renderAdminList();
      }
    }).catch(function () {
      ondeckItems = [];
      renderOnDeck();
    });
  }

  function renderOnDeck() {
    if (ondeckItems.length === 0) {
      ondeckList.innerHTML = '<p style="color:#999;">No songs on deck right now.</p>';
      return;
    }
    var html = '<table class="songs-table"><thead><tr><th>#</th><th>Song</th></tr></thead><tbody>';
    ondeckItems.forEach(function (name, i) {
      html += "<tr>";
      html += "<td>" + (i + 1) + "</td>";
      html += "<td>" + escapeHtml(name) + "</td>";
      html += "</tr>";
    });
    html += "</tbody></table>";
    ondeckList.innerHTML = html;
  }

  function renderAdminList() {
    if (ondeckItems.length === 0) {
      adminOndeckList.innerHTML = '<li style="color:#999;padding:10px;">No songs on deck.</li>';
      return;
    }
    adminOndeckList.innerHTML = "";
    ondeckItems.forEach(function (name, i) {
      var li = document.createElement("li");
      li.innerHTML =
        "<span>" + escapeHtml(name) + "</span>" +
        '<div style="display:flex;gap:4px;">' +
        '<button class="btn btn-primary btn-sm move-btn">Move to Songs</button>' +
        '<button class="btn btn-danger btn-sm remove-btn">Remove</button>' +
        "</div>";
      li.querySelector(".move-btn").addEventListener("click", function () { moveToSongs(i); });
      li.querySelector(".remove-btn").addEventListener("click", function () { removeFromDeck(i); });
      adminOndeckList.appendChild(li);
    });
  }

  function moveToSongs(index) {
    var name = ondeckItems[index];
    if (!confirm('Move "' + name + '" to Current Songs?\nYou\'ll be prompted for artist name.')) return;

    var artist = prompt("Enter the artist for \"" + name + "\":");
    if (!artist || !artist.trim()) {
      showAlert(container, "Artist is required to move to Songs.");
      return;
    }

    var url = prompt("Enter a chords URL (leave blank to skip):");
    var song = { artist: artist.trim(), title: name };
    if (url && url.trim()) {
      if (!/^https?:\/\//i.test(url.trim())) {
        showAlert(container, "URL must start with http:// or https://");
        return;
      }
      song.url = url.trim();
    }

    // Load current songs, add the new one, save both lists.
    TableStorage.get("songs", "config", "items").then(function (entity) {
      var songs = entity ? JSON.parse(entity.Items || "[]") : [];

      // Check for duplicate
      var duplicate = songs.some(function (s) {
        return s.artist.toLowerCase() === song.artist.toLowerCase() &&
               s.title.toLowerCase() === song.title.toLowerCase();
      });
      if (duplicate) {
        showAlert(container, "That song already exists in Current Songs.");
        return Promise.reject("duplicate");
      }

      songs.push(song);

      // Save songs
      return TableStorage.upsert("songs", {
        PartitionKey: "config",
        RowKey: "items",
        Items: JSON.stringify(songs)
      });
    }).then(function () {
      // Remove from on deck
      ondeckItems.splice(index, 1);
      return saveOnDeck();
    }).then(function () {
      renderOnDeck();
      renderAdminList();
      showAlert(container, '"' + name + '" moved to Current Songs!', "success");
    }).catch(function (e) {
      if (e === "duplicate") return;
      showAlert(container, "Failed to move song: " + (e.message || e));
    });
  }

  function removeFromDeck(index) {
    var name = ondeckItems[index];
    if (!confirm('Remove "' + name + '" from On Deck?')) return;
    ondeckItems.splice(index, 1);
    saveOnDeck().then(function () {
      renderOnDeck();
      renderAdminList();
    }).catch(function (e) {
      showAlert(container, "Failed to remove: " + e.message);
    });
  }

  function saveOnDeck() {
    return TableStorage.upsert("songs", {
      PartitionKey: "config",
      RowKey: "ondeck",
      Items: JSON.stringify(ondeckItems)
    });
  }
});
