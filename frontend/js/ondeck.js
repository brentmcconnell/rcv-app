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
      // Backward compat: convert plain strings to objects.
      ondeckItems = ondeckItems.map(function (item) {
        if (typeof item === "string") return { name: item, up: 0, down: 0 };
        return item;
      });
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
    var voted = JSON.parse(localStorage.getItem("rcv_ondeck_votes") || "{}");
    var html = '<table class="songs-table"><thead><tr><th>#</th><th>Song</th><th>Promote to Set List</th></tr></thead><tbody>';
    ondeckItems.forEach(function (item, i) {
      var userVote = voted[item.name] || null;
      html += "<tr>";
      html += "<td>" + (i + 1) + "</td>";
      html += "<td>" + escapeHtml(item.name) + "</td>";
      html += '<td class="ondeck-votes">';
      html += '<button class="vote-btn vote-up' + (userVote === "up" ? " voted" : "") + '" data-index="' + i + '" data-dir="up">&#128077; ' + (item.up || 0) + "</button>";
      html += '<button class="vote-btn vote-down' + (userVote === "down" ? " voted" : "") + '" data-index="' + i + '" data-dir="down">&#128078; ' + (item.down || 0) + "</button>";
      html += "</td>";
      html += "</tr>";
    });
    html += "</tbody></table>";
    ondeckList.innerHTML = html;

    // Attach vote handlers
    ondeckList.querySelectorAll(".vote-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var idx = parseInt(btn.getAttribute("data-index"));
        var dir = btn.getAttribute("data-dir");
        castOnDeckVote(idx, dir);
      });
    });
  }

  function castOnDeckVote(index, dir) {
    var item = ondeckItems[index];
    var voted = JSON.parse(localStorage.getItem("rcv_ondeck_votes") || "{}");
    var prev = voted[item.name] || null;

    // If already voted same direction, undo the vote.
    if (prev === dir) {
      if (dir === "up") item.up = Math.max(0, (item.up || 0) - 1);
      if (dir === "down") item.down = Math.max(0, (item.down || 0) - 1);
      delete voted[item.name];
      localStorage.setItem("rcv_ondeck_votes", JSON.stringify(voted));
      saveOnDeck().then(function () { renderOnDeck(); });
      return;
    }

    // Undo previous vote if switching.
    if (prev === "up") item.up = Math.max(0, (item.up || 0) - 1);
    if (prev === "down") item.down = Math.max(0, (item.down || 0) - 1);

    // Apply new vote.
    if (dir === "up") item.up = (item.up || 0) + 1;
    if (dir === "down") item.down = (item.down || 0) + 1;

    voted[item.name] = dir;
    localStorage.setItem("rcv_ondeck_votes", JSON.stringify(voted));

    saveOnDeck().then(function () {
      renderOnDeck();
    }).catch(function (e) {
      // Revert on failure.
      if (dir === "up") item.up = Math.max(0, (item.up || 0) - 1);
      if (dir === "down") item.down = Math.max(0, (item.down || 0) - 1);
      if (prev) {
        if (prev === "up") item.up = (item.up || 0) + 1;
        if (prev === "down") item.down = (item.down || 0) + 1;
        voted[item.name] = prev;
      } else {
        delete voted[item.name];
      }
      localStorage.setItem("rcv_ondeck_votes", JSON.stringify(voted));
      renderOnDeck();
    });
  }

  function renderAdminList() {
    if (ondeckItems.length === 0) {
      adminOndeckList.innerHTML = '<li style="color:#999;padding:10px;">No songs on deck.</li>';
      return;
    }
    adminOndeckList.innerHTML = "";
    ondeckItems.forEach(function (item, i) {
      var li = document.createElement("li");
      li.innerHTML =
        "<span>" + escapeHtml(item.name) + ' <small style="color:#999;">(' + (item.up || 0) + " up / " + (item.down || 0) + " down)</small></span>" +
        '<div style="display:flex;gap:4px;">' +
        '<button class="btn btn-primary btn-sm move-btn">Move to Set List</button>' +
        '<button class="btn btn-danger btn-sm remove-btn">Remove</button>' +
        "</div>";
      li.querySelector(".move-btn").addEventListener("click", function () { moveToSongs(i); });
      li.querySelector(".remove-btn").addEventListener("click", function () { removeFromDeck(i); });
      adminOndeckList.appendChild(li);
    });
  }

  function moveToSongs(index) {
    var name = ondeckItems[index].name;
    if (!confirm('Move "' + name + '" to Current Set List?\nYou\'ll be prompted for artist name.')) return;

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
        showAlert(container, "That song already exists in Current Set List.");
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
      showAlert(container, '"' + name + '" moved to Current Set List!', "success");
    }).catch(function (e) {
      if (e === "duplicate") return;
      showAlert(container, "Failed to move song: " + (e.message || e));
    });
  }

  function removeFromDeck(index) {
    var name = ondeckItems[index].name;
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
