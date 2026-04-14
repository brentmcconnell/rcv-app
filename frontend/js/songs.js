document.addEventListener("DOMContentLoaded", function () {
  if (!checkPasscode()) return;

  var adminGate = document.getElementById("admin-gate");
  var adminPanel = document.getElementById("admin-panel");
  var adminCodeInput = document.getElementById("admin-code");
  var adminLoginBtn = document.getElementById("admin-login-btn");
  var songsList = document.getElementById("songs-list");
  var adminSongsList = document.getElementById("admin-songs-list");
  var artistInput = document.getElementById("song-artist");
  var titleInput = document.getElementById("song-title");
  var urlInput = document.getElementById("song-url");
  var addBtn = document.getElementById("add-song-btn");
  var container = document.querySelector(".container");

  var songs = [];

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

  addBtn.addEventListener("click", addSong);
  titleInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") addSong();
  });

  // Hide vote CTA if voting is closed.
  TableStorage.get("survey", "config", "status").then(function (entity) {
    if (entity && entity.VotingOpen === "false") {
      var cta = document.getElementById("vote-cta");
      if (cta) cta.classList.add("hidden");
    }
  });

  loadSongs();
  loadOnDeck();

  // ---- helpers ----

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  var ondeckData = [];

  function loadOnDeck() {
    var ondeckListEl = document.getElementById("ondeck-list");
    if (!ondeckListEl) return;
    TableStorage.get("songs", "config", "ondeck").then(function (entity) {
      ondeckData = entity ? JSON.parse(entity.Items || "[]") : [];
      // Backward compat: convert plain strings to objects.
      ondeckData = ondeckData.map(function (item) {
        if (typeof item === "string") return { name: item, up: 0, down: 0 };
        return item;
      });
      renderOnDeck(ondeckListEl);
    }).catch(function (err) {
      console.error("loadOnDeck error:", err);
      ondeckData = [];
      renderOnDeck(ondeckListEl);
    });
  }

  function renderOnDeck(el) {
    if (ondeckData.length === 0) {
      el.innerHTML = '<p style="color:#999;">No songs on deck right now.</p>';
      return;
    }
    var voted = JSON.parse(localStorage.getItem("rcv_ondeck_votes") || "{}");
    var html = '<table class="songs-table"><thead><tr><th>#</th><th>Song</th><th>Votes</th></tr></thead><tbody>';
    ondeckData.forEach(function (item, i) {
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
    el.innerHTML = html;

    el.querySelectorAll(".vote-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var idx = parseInt(btn.getAttribute("data-index"));
        var dir = btn.getAttribute("data-dir");
        castOnDeckVote(idx, dir, el);
      });
    });
  }

  function castOnDeckVote(index, dir, el) {
    var item = ondeckData[index];
    var voted = JSON.parse(localStorage.getItem("rcv_ondeck_votes") || "{}");
    var prev = voted[item.name] || null;

    if (prev === dir) return;

    if (prev === "up") item.up = Math.max(0, (item.up || 0) - 1);
    if (prev === "down") item.down = Math.max(0, (item.down || 0) - 1);

    if (dir === "up") item.up = (item.up || 0) + 1;
    if (dir === "down") item.down = (item.down || 0) + 1;

    voted[item.name] = dir;
    localStorage.setItem("rcv_ondeck_votes", JSON.stringify(voted));

    TableStorage.upsert("songs", {
      PartitionKey: "config",
      RowKey: "ondeck",
      Items: JSON.stringify(ondeckData)
    }).then(function () {
      renderOnDeck(el);
    }).catch(function () {
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
      renderOnDeck(el);
    });
  }

  function showAdminPanel() {
    adminGate.classList.add("hidden");
    adminPanel.classList.remove("hidden");
    renderAdminList();
  }

  function loadSongs() {
    TableStorage.get("songs", "config", "items").then(function (entity) {
      songs = entity ? JSON.parse(entity.Items || "[]") : [];
      renderSongs();
      if (!adminPanel.classList.contains("hidden")) {
        renderAdminList();
      }
    }).catch(function () {
      songs = [];
      renderSongs();
    });
  }

  function renderSongs() {
    if (songs.length === 0) {
      songsList.innerHTML = '<p style="color:#999;">No songs yet.</p>';
      return;
    }
    var sorted = songs.slice().sort(function (a, b) {
      var cmp = a.artist.toLowerCase().localeCompare(b.artist.toLowerCase());
      return cmp !== 0 ? cmp : a.title.toLowerCase().localeCompare(b.title.toLowerCase());
    });
    var html = '<table class="songs-table"><thead><tr><th>Artist</th><th>Song</th><th>Chords</th></tr></thead><tbody>';
    sorted.forEach(function (s) {
      html += "<tr>";
      html += "<td>" + escapeHtml(s.artist) + "</td>";
      html += "<td>" + escapeHtml(s.title) + "</td>";
      if (s.url) {
        html += '<td><a href="' + escapeHtml(s.url) + '" target="_blank" rel="noopener noreferrer">View</a></td>';
      } else {
        html += '<td style="color:#999;">—</td>';
      }
      html += "</tr>";
    });
    html += "</tbody></table>";
    songsList.innerHTML = html;
  }

  function renderAdminList() {
    if (songs.length === 0) {
      adminSongsList.innerHTML = '<li style="color:#999;padding:10px;">No songs yet.</li>';
      return;
    }
    adminSongsList.innerHTML = "";
    var indices = songs.map(function (s, i) { return i; });
    indices.sort(function (a, b) {
      var cmp = songs[a].artist.toLowerCase().localeCompare(songs[b].artist.toLowerCase());
      return cmp !== 0 ? cmp : songs[a].title.toLowerCase().localeCompare(songs[b].title.toLowerCase());
    });
    indices.forEach(function (i) {
      var s = songs[i];
      var li = document.createElement("li");
      li.innerHTML =
        "<span>" + escapeHtml(s.artist) + " — " + escapeHtml(s.title) + "</span>" +
        '<button class="btn btn-danger btn-sm" data-index="' + i + '">Remove</button>';
      li.querySelector("button").addEventListener("click", function () { removeSong(i); });
      adminSongsList.appendChild(li);
    });
  }

  function addSong() {
    var artist = artistInput.value.trim();
    var title = titleInput.value.trim();
    var url = urlInput.value.trim();

    if (!artist || !title) {
      showAlert(container, "Artist and Song are required.");
      return;
    }

    // Validate URL if provided
    if (url && !/^https?:\/\//i.test(url)) {
      showAlert(container, "URL must start with http:// or https://");
      return;
    }

    // Check for duplicate artist+title
    var duplicate = songs.some(function (s) {
      return s.artist.toLowerCase() === artist.toLowerCase() &&
             s.title.toLowerCase() === title.toLowerCase();
    });
    if (duplicate) {
      showAlert(container, "That song already exists.");
      return;
    }

    var song = { artist: artist, title: title };
    if (url) song.url = url;

    songs.push(song);
    saveSongs().then(function () {
      artistInput.value = "";
      titleInput.value = "";
      urlInput.value = "";
      renderSongs();
      renderAdminList();
    }).catch(function (err) {
      songs.pop();
      showAlert(container, "Failed to save song: " + err.message);
    });
  }

  function removeSong(index) {
    songs.splice(index, 1);
    saveSongs().then(function () {
      renderSongs();
      renderAdminList();
    });
  }

  function saveSongs() {
    return TableStorage.upsert("songs", {
      PartitionKey: "config",
      RowKey: "items",
      Items: JSON.stringify(songs)
    });
  }
});
