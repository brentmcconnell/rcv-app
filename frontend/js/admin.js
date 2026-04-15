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

  var toggleVotingBtn = document.getElementById("toggle-voting-btn");
  var votingOpen = true;

  toggleVotingBtn.addEventListener("click", function () {
    var wasOpen = votingOpen;
    votingOpen = !votingOpen;
    TableStorage.upsert("survey", {
      PartitionKey: "config",
      RowKey: "status",
      VotingOpen: votingOpen ? "true" : "false"
    }).then(function () {
      renderVotingStatus();
      // When closing voting, auto-promote top 5 to On Deck.
      if (wasOpen && !votingOpen) {
        promoteTopFive();
      }
    }).catch(function (e) {
      votingOpen = !votingOpen;
      showAlert(container, "Failed to update voting status: " + e.message);
    });
  });

  function promoteTopFive() {
    Promise.all([
      TableStorage.get("survey", "config", "items"),
      TableStorage.query("votes")
    ]).then(function (results) {
      var itemEntity = results[0];
      var votes = results[1];
      var surveyItems = itemEntity ? JSON.parse(itemEntity.Items || "[]") : [];

      if (surveyItems.length === 0 || votes.length === 0) return;

      // Borda count (same as results.js)
      var totalItems = surveyItems.length;
      var scores = {};
      surveyItems.forEach(function (item) { scores[item] = 0; });
      votes.forEach(function (vote) {
        var rankings = JSON.parse(vote.Rankings || "[]");
        rankings.forEach(function (item, index) {
          if (scores.hasOwnProperty(item)) {
            scores[item] += (totalItems - index);
          }
        });
      });

      var sorted = Object.keys(scores).map(function (item) {
        return { name: item, score: scores[item] };
      }).sort(function (a, b) { return b.score - a.score; });

      var top5 = sorted.slice(0, 5).map(function (entry) { return { name: entry.name, up: 0, down: 0 }; });

      return TableStorage.upsert("songs", {
        PartitionKey: "config",
        RowKey: "ondeck",
        Items: JSON.stringify(top5)
      });
    }).then(function () {
      showAlert(container, "Top 5 songs promoted to On Deck!", "success");
    }).catch(function (e) {
      showAlert(container, "Voting closed but failed to promote songs: " + e.message);
    });
  }

  function loadVotingStatus() {
    TableStorage.get("survey", "config", "status").then(function (entity) {
      votingOpen = !entity || entity.VotingOpen !== "false";
      renderVotingStatus();
    });
  }

  function renderVotingStatus() {
    if (votingOpen) {
      toggleVotingBtn.textContent = "Close Voting";
      toggleVotingBtn.className = "btn btn-danger";
    } else {
      toggleVotingBtn.textContent = "Open Voting";
      toggleVotingBtn.className = "btn btn-primary";
    }
  }

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
    loadVotingStatus();
    loadSuggestions();
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

  // ---- Song Suggestions ----

  var suggestions = [];

  function loadSuggestions() {
    var sugList = document.getElementById("suggestions-list");
    TableStorage.get("survey", "config", "suggestions").then(function (entity) {
      suggestions = entity ? JSON.parse(entity.Items || "[]") : [];
      renderSuggestions(sugList);
    }).catch(function () {
      suggestions = [];
      renderSuggestions(sugList);
    });
  }

  function renderSuggestions(el) {
    if (suggestions.length === 0) {
      el.innerHTML = '<li style="color:#999;padding:10px;">No suggestions yet.</li>';
      return;
    }
    el.innerHTML = "";
    suggestions.forEach(function (s, i) {
      var li = document.createElement("li");
      li.innerHTML =
        "<span>" + escapeHtml(s.artist) + " — " + escapeHtml(s.title) +
        (s.url ? ' <a href="' + escapeHtml(s.url) + '" target="_blank" style="font-size:12px;color:#3498db;">chords</a>' : '') +
        "</span>" +
        '<div style="display:flex;gap:4px;">' +
        '<button class="btn btn-primary btn-sm add-btn">Add to Vote</button>' +
        '<button class="btn btn-primary btn-sm edit-btn">Edit</button>' +
        '<button class="btn btn-danger btn-sm del-btn">Dismiss</button>' +
        "</div>";
      li.querySelector(".add-btn").addEventListener("click", function () {
        var itemName = s.artist + " - " + s.title;
        if (items.indexOf(itemName) !== -1) {
          showAlert(container, "Already in the survey items list.");
          return;
        }
        items.push(itemName);
        saveItems().then(function () {
          renderItems();
          // Remove from suggestions
          suggestions.splice(i, 1);
          return saveSuggestions();
        }).then(function () {
          renderSuggestions(el);
          showAlert(container, '"' + itemName + '" added to survey items!', "success");
        });
      });
      li.querySelector(".edit-btn").addEventListener("click", function () {
        editSuggestion(i, el);
      });
      li.querySelector(".del-btn").addEventListener("click", function () {
        suggestions.splice(i, 1);
        saveSuggestions().then(function () {
          renderSuggestions(el);
        });
      });
      el.appendChild(li);
    });
  }

  function editSuggestion(index, el) {
    var s = suggestions[index];
    el.innerHTML = "";
    var form = document.createElement("div");
    form.className = "card";
    form.innerHTML =
      '<h3>Edit Suggestion</h3>' +
      '<div class="form-group"><label>Artist</label><input type="text" id="edit-sug-artist" value="' + escapeHtml(s.artist) + '"></div>' +
      '<div class="form-group"><label>Song</label><input type="text" id="edit-sug-title" value="' + escapeHtml(s.title) + '"></div>' +
      '<div class="form-group"><label>Chords URL <span style="color:#999;font-weight:normal;">(optional)</span></label><input type="text" id="edit-sug-url" value="' + escapeHtml(s.url || "") + '" placeholder="https://..."></div>' +
      '<div style="display:flex;gap:8px;">' +
      '<button class="btn btn-primary" id="save-sug-btn">Save</button>' +
      '<button class="btn btn-danger" id="cancel-sug-btn">Cancel</button>' +
      '</div>';
    el.appendChild(form);

    document.getElementById("save-sug-btn").addEventListener("click", function () {
      var newArtist = document.getElementById("edit-sug-artist").value.trim();
      var newTitle = document.getElementById("edit-sug-title").value.trim();
      var newUrl = document.getElementById("edit-sug-url").value.trim();

      if (!newArtist || !newTitle) {
        showAlert(container, "Artist and Song are required.");
        return;
      }
      if (newUrl && !/^https?:\/\//i.test(newUrl)) {
        showAlert(container, "URL must start with http:// or https://");
        return;
      }

      s.artist = newArtist;
      s.title = newTitle;
      s.url = newUrl || undefined;

      saveSuggestions().then(function () {
        renderSuggestions(el);
        showAlert(container, "Suggestion updated!", "success");
      }).catch(function (e) {
        showAlert(container, "Failed to save: " + e.message);
      });
    });

    document.getElementById("cancel-sug-btn").addEventListener("click", function () {
      renderSuggestions(el);
    });
  }

  function saveSuggestions() {
    return TableStorage.upsert("survey", {
      PartitionKey: "config",
      RowKey: "suggestions",
      Items: JSON.stringify(suggestions)
    });
  }
});
