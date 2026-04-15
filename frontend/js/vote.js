document.addEventListener("DOMContentLoaded", function () {
  if (!checkPasscode()) return;

  var nameSection = document.getElementById("name-section");
  var voteSection = document.getElementById("vote-section");
  var successSection = document.getElementById("success-section");
  var nameInput = document.getElementById("voter-name");
  var nameBtn = document.getElementById("name-btn");
  var similarWarning = document.getElementById("similar-warning");
  var similarList = document.getElementById("similar-list");
  var proceedBtn = document.getElementById("proceed-btn");
  var cancelBtn = document.getElementById("cancel-btn");
  var availableList = document.getElementById("available-items");
  var rankedList = document.getElementById("ranked-items");
  var submitBtn = document.getElementById("submit-btn");
  var rankCount = document.getElementById("rank-count");
  var container = document.querySelector(".container");

  var closedSection = document.getElementById("closed-section");
  var voterName = "";
  var voterKey = "";
  var items = [];
  var ranked = [];
  var available = [];
  var previousRankings = null;

  // Check if voting is open before showing the name form.
  TableStorage.get("survey", "config", "status").then(function (entity) {
    if (entity && entity.VotingOpen === "false") {
      closedSection.classList.remove("hidden");
      nameSection.classList.add("hidden");
      initSuggestions();
    } else {
      nameSection.classList.remove("hidden");
    }
  }).catch(function () {
    nameSection.classList.remove("hidden");
  });

  nameBtn.addEventListener("click", checkName);
  nameInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") checkName();
  });

  submitBtn.addEventListener("click", submitVote);

  // ---- Step 1: name validation ----

  function checkName() {
    var raw = nameInput.value.trim();
    if (!raw) {
      showAlert(nameSection, "Please enter your name.");
      return;
    }

    // Auto-capitalize first letter
    raw = raw.charAt(0).toUpperCase() + raw.slice(1);
    nameInput.value = raw;

    voterName = normalizeName(raw);
    voterKey = normalizeNameKey(voterName);

    if (!voterKey) {
      showAlert(nameSection, "Please enter a valid name.");
      return;
    }

    nameBtn.disabled = true;
    nameBtn.textContent = "Checking...";

    TableStorage.query("votes").then(function (votes) {
      var existingNames = votes.map(function (v) { return v.DisplayName || v.RowKey; });
      var result = findSimilarNames(voterName, existingNames);

      if (result.exact) {
        showAlert(nameSection, '"' + result.name + '" has already voted. You can update your rankings.', "warning");
        // Fetch previous vote to pre-populate rankings
        var matchedVote = votes.find(function (v) {
          return (v.DisplayName || v.RowKey).toLowerCase() === normalizeName(voterName).toLowerCase();
        });
        if (matchedVote && matchedVote.Rankings) {
          previousRankings = JSON.parse(matchedVote.Rankings);
        }
      }

      if (result.similar && result.similar.length > 0) {
        similarList.innerHTML = result.similar.map(function (n) {
          return "<li><strong>" + escapeHtml(n) + "</strong></li>";
        }).join("");
        similarWarning.classList.remove("hidden");

        proceedBtn.onclick = function () {
          similarWarning.classList.add("hidden");
          showVoteInterface();
        };
        cancelBtn.onclick = function () {
          similarWarning.classList.add("hidden");
          nameInput.value = "";
          nameInput.focus();
          nameBtn.disabled = false;
          nameBtn.textContent = "Continue";
        };
        return;
      }

      showVoteInterface();
    }).catch(function (e) {
      showAlert(nameSection, "Error checking name: " + e.message);
      nameBtn.disabled = false;
      nameBtn.textContent = "Continue";
    });
  }

  // ---- Step 2: ranking interface ----

  function showVoteInterface() {
    nameBtn.disabled = false;
    nameBtn.textContent = "Continue";

    TableStorage.get("survey", "config", "items").then(function (entity) {
      items = entity ? JSON.parse(entity.Items || "[]") : [];
      if (items.length === 0) {
        showAlert(nameSection, "No survey items have been configured yet. Ask the admin to set up the survey.");
        return;
      }

      nameSection.classList.add("hidden");
      voteSection.classList.remove("hidden");
      document.getElementById("greeting").textContent = "Voting as: " + voterName;

      if (previousRankings && previousRankings.length > 0) {
        // Pre-populate with previous vote, filtering out any items no longer in the survey
        ranked = previousRankings.filter(function (r) { return items.indexOf(r) !== -1; });
        available = items.filter(function (item) { return ranked.indexOf(item) === -1; });
        previousRankings = null;
      } else {
        ranked = [];
        available = items.slice();
      }
      renderPanels();
    }).catch(function (e) {
      showAlert(nameSection, "Failed to load survey items: " + e.message);
    });
  }

  function renderPanels() {
    // ---- Available items ----
    availableList.innerHTML = "";
    if (available.length === 0) {
      availableList.innerHTML = '<p style="color:#999;padding:10px;">All items ranked!</p>';
    } else {
      available.forEach(function (item, i) {
        var div = document.createElement("div");
        div.className = "panel-item";
        div.innerHTML = '<span class="item-name">' + escapeHtml(item) + "</span>";
        div.addEventListener("click", function () {
          ranked.push(item);
          available.splice(i, 1);
          renderPanels();
        });
        availableList.appendChild(div);
      });
    }

    // ---- Ranked items ----
    rankedList.innerHTML = "";
    if (ranked.length === 0) {
      rankedList.innerHTML = '<p style="color:#999;padding:10px;">Click items on the left to rank them.</p>';
    } else {
      ranked.forEach(function (item, i) {
        var div = document.createElement("div");
        div.className = "panel-item";
        div.innerHTML =
          '<span class="rank">#' + (i + 1) + "</span>" +
          '<span class="item-name">' + escapeHtml(item) + "</span>" +
          '<span class="move-btns">' +
            "<button title='Move up'" + (i === 0 ? " disabled" : "") + ">&#8593;</button>" +
            "<button title='Move down'" + (i === ranked.length - 1 ? " disabled" : "") + ">&#8595;</button>" +
            "<button title='Remove'>&times;</button>" +
          "</span>";

        var btns = div.querySelectorAll("button");
        btns[0].addEventListener("click", makeHandler("up", i));
        btns[1].addEventListener("click", makeHandler("down", i));
        btns[2].addEventListener("click", makeHandler("remove", i));
        rankedList.appendChild(div);
      });
    }

    // ---- Status ----
    rankCount.textContent = ranked.length + " of " + items.length + " ranked";
    submitBtn.disabled = ranked.length < 1;
  }

  function makeHandler(action, i) {
    return function (e) {
      e.stopPropagation();
      if (action === "up" && i > 0) {
        var tmp = ranked[i]; ranked[i] = ranked[i - 1]; ranked[i - 1] = tmp;
      } else if (action === "down" && i < ranked.length - 1) {
        var tmp = ranked[i]; ranked[i] = ranked[i + 1]; ranked[i + 1] = tmp;
      } else if (action === "remove") {
        available.push(ranked[i]);
        ranked.splice(i, 1);
      }
      renderPanels();
    };
  }

  // ---- Step 3: submit ----

  function submitVote() {
    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting...";

    TableStorage.upsert("votes", {
      PartitionKey: "votes",
      RowKey: voterKey,
      DisplayName: voterName,
      Rankings: JSON.stringify(ranked)
    }).then(function () {
      voteSection.classList.add("hidden");
      successSection.classList.remove("hidden");
    }).catch(function (e) {
      showAlert(container, "Failed to submit vote: " + e.message);
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit Vote";
    });
  }

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  // ---- Song Suggestions (when voting is closed) ----

  function initSuggestions() {
    var suggestBtn = document.getElementById("suggest-btn");
    var artistInput = document.getElementById("suggest-artist");
    var titleInput = document.getElementById("suggest-title");
    var urlInput = document.getElementById("suggest-url");

    suggestBtn.addEventListener("click", submitSuggestion);
    titleInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") submitSuggestion();
    });

    // Get or create a token to identify this browser's suggestions.
    var myToken = localStorage.getItem("rcv_suggest_token");
    if (!myToken) {
      myToken = Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem("rcv_suggest_token", myToken);
    }

    var allSuggestions = [];

    loadSuggestions();

    function submitSuggestion() {
      var artist = artistInput.value.trim();
      var title = titleInput.value.trim();
      var url = urlInput.value.trim();

      if (!artist || !title) {
        showAlert(closedSection, "Please enter both artist and song name.");
        return;
      }

      if (url && !/^https?:\/\//i.test(url)) {
        showAlert(closedSection, "URL must start with http:// or https://");
        return;
      }

      suggestBtn.disabled = true;
      suggestBtn.textContent = "Submitting...";

      TableStorage.get("survey", "config", "suggestions").then(function (entity) {
        allSuggestions = entity ? JSON.parse(entity.Items || "[]") : [];

        // Check for duplicate
        var duplicate = allSuggestions.some(function (s) {
          return s.artist.toLowerCase() === artist.toLowerCase() &&
                 s.title.toLowerCase() === title.toLowerCase();
        });
        if (duplicate) {
          showAlert(closedSection, "That song has already been suggested.");
          suggestBtn.disabled = false;
          suggestBtn.textContent = "Submit Suggestion";
          return;
        }

        var suggestion = { artist: artist, title: title, token: myToken };
        if (url) suggestion.url = url;

        allSuggestions.push(suggestion);

        return TableStorage.upsert("survey", {
          PartitionKey: "config",
          RowKey: "suggestions",
          Items: JSON.stringify(allSuggestions)
        }).then(function () {
          artistInput.value = "";
          titleInput.value = "";
          urlInput.value = "";
          showAlert(closedSection, "Suggestion submitted! Thanks!", "success");
          loadSuggestions();
        });
      }).catch(function (e) {
        showAlert(closedSection, "Failed to submit suggestion: " + e.message);
      }).then(function () {
        suggestBtn.disabled = false;
        suggestBtn.textContent = "Submit Suggestion";
      });
    }

    function loadSuggestions() {
      var listEl = document.getElementById("suggestions-list");
      TableStorage.get("survey", "config", "suggestions").then(function (entity) {
        allSuggestions = entity ? JSON.parse(entity.Items || "[]") : [];
        if (allSuggestions.length === 0) {
          listEl.innerHTML = '<p style="color:#999;">No suggestions yet. Be the first!</p>';
          return;
        }
        renderSuggestionsList(listEl);
      }).catch(function () {
        listEl.innerHTML = '<p style="color:#999;">Could not load suggestions.</p>';
      });
    }

    function renderSuggestionsList(listEl) {
      var html = '<table class="songs-table"><thead><tr><th>Artist</th><th>Song</th><th>Chords</th><th></th></tr></thead><tbody>';
      allSuggestions.forEach(function (s, i) {
        html += "<tr><td>" + escapeHtml(s.artist) + "</td><td>" + escapeHtml(s.title) + "</td>";
        if (s.url) {
          html += '<td><a href="' + escapeHtml(s.url) + '" target="_blank" rel="noopener noreferrer">View</a></td>';
        } else {
          html += '<td style="color:#999;">—</td>';
        }
        if (s.token === myToken) {
          html += '<td style="white-space:nowrap;">' +
            '<button class="btn btn-primary btn-sm edit-suggest-btn" data-index="' + i + '">Edit</button> ' +
            '<button class="btn btn-danger btn-sm del-suggest-btn" data-index="' + i + '">Delete</button>' +
            '</td>';
        } else {
          html += "<td></td>";
        }
        html += "</tr>";
      });
      html += "</tbody></table>";
      listEl.innerHTML = html;

      listEl.querySelectorAll(".edit-suggest-btn").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var idx = parseInt(btn.getAttribute("data-index"));
          editSuggestion(idx, listEl);
        });
      });

      listEl.querySelectorAll(".del-suggest-btn").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var idx = parseInt(btn.getAttribute("data-index"));
          if (!confirm('Delete "' + allSuggestions[idx].artist + ' — ' + allSuggestions[idx].title + '"?')) return;
          allSuggestions.splice(idx, 1);
          TableStorage.upsert("survey", {
            PartitionKey: "config",
            RowKey: "suggestions",
            Items: JSON.stringify(allSuggestions)
          }).then(function () {
            renderSuggestionsList(listEl);
          }).catch(function (e) {
            showAlert(closedSection, "Failed to delete: " + e.message);
          });
        });
      });
    }

    function editSuggestion(index, listEl) {
      var s = allSuggestions[index];
      listEl.innerHTML =
        '<div class="card">' +
        '<h3>Edit Suggestion</h3>' +
        '<div class="form-group"><label>Artist</label><input type="text" id="edit-sug-artist" value="' + escapeHtml(s.artist) + '"></div>' +
        '<div class="form-group"><label>Song</label><input type="text" id="edit-sug-title" value="' + escapeHtml(s.title) + '"></div>' +
        '<div class="form-group"><label>Chords URL <span style="color:#999;font-weight:normal;">(optional)</span></label><input type="text" id="edit-sug-url" value="' + escapeHtml(s.url || "") + '" placeholder="https://..."></div>' +
        '<div style="display:flex;gap:8px;">' +
        '<button class="btn btn-primary" id="save-sug-btn">Save</button>' +
        '<button class="btn btn-danger" id="cancel-sug-btn">Cancel</button>' +
        '</div></div>';

      document.getElementById("save-sug-btn").addEventListener("click", function () {
        var newArtist = document.getElementById("edit-sug-artist").value.trim();
        var newTitle = document.getElementById("edit-sug-title").value.trim();
        var newUrl = document.getElementById("edit-sug-url").value.trim();

        if (!newArtist || !newTitle) {
          showAlert(closedSection, "Artist and Song are required.");
          return;
        }
        if (newUrl && !/^https?:\/\//i.test(newUrl)) {
          showAlert(closedSection, "URL must start with http:// or https://");
          return;
        }

        s.artist = newArtist;
        s.title = newTitle;
        s.url = newUrl || undefined;

        TableStorage.upsert("survey", {
          PartitionKey: "config",
          RowKey: "suggestions",
          Items: JSON.stringify(allSuggestions)
        }).then(function () {
          showAlert(closedSection, "Suggestion updated!", "success");
          renderSuggestionsList(listEl);
        }).catch(function (e) {
          showAlert(closedSection, "Failed to save: " + e.message);
        });
      });

      document.getElementById("cancel-sug-btn").addEventListener("click", function () {
        renderSuggestionsList(listEl);
      });
    }
  }
});
