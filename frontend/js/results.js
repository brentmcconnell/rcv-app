document.addEventListener("DOMContentLoaded", function () {
  if (!checkPasscode()) return;

  var resultsContainer = document.getElementById("results-container");
  var voterCount = document.getElementById("voter-count");
  var voterList = document.getElementById("voter-list");
  var refreshBtn = document.getElementById("refresh-btn");
  var container = document.querySelector(".container");

  refreshBtn.addEventListener("click", loadResults);
  loadResults();

  function loadResults() {
    refreshBtn.disabled = true;
    refreshBtn.textContent = "Loading...";

    Promise.all([
      TableStorage.get("survey", "config", "items"),
      TableStorage.query("votes")
    ]).then(function (results) {
      var itemEntity = results[0];
      var votes = results[1];

      var items = itemEntity ? JSON.parse(itemEntity.Items || "[]") : [];

      if (items.length === 0) {
        resultsContainer.innerHTML = "<p>No survey items configured yet.</p>";
        voterCount.textContent = "";
        voterList.innerHTML = "";
        return;
      }

      if (votes.length === 0) {
        resultsContainer.innerHTML = "<p>No votes have been cast yet.</p>";
        voterCount.textContent = "0 votes";
        voterList.innerHTML = "";
        return;
      }

      voterCount.textContent = votes.length + " vote" + (votes.length !== 1 ? "s" : "") + " cast";

      // ---- Borda count ----
      // 1st place = N points, 2nd = N-1, ... unranked = 0
      var totalItems = items.length;
      var scores = {};
      items.forEach(function (item) { scores[item] = 0; });

      votes.forEach(function (vote) {
        var rankings = JSON.parse(vote.Rankings || "[]");
        rankings.forEach(function (item, index) {
          if (scores.hasOwnProperty(item)) {
            scores[item] += (totalItems - index);
          }
        });
      });

      // Sort descending by score
      var sorted = Object.keys(scores).map(function (item) {
        return { name: item, score: scores[item] };
      }).sort(function (a, b) { return b.score - a.score; });

      var maxScore = sorted[0].score || 1;

      // Render bar chart
      resultsContainer.innerHTML = "";
      sorted.forEach(function (entry, i) {
        var pct = (entry.score / maxScore) * 100;
        var div = document.createElement("div");
        div.className = "result-bar";
        div.innerHTML =
          '<span class="rank">' + (i + 1) + ".</span>" +
          '<span class="name">' + escapeHtml(entry.name) + "</span>" +
          '<span class="bar-container"><div class="bar" style="width:' + pct + '%"></div></span>' +
          '<span class="score">' + entry.score + " pts</span>";
        resultsContainer.appendChild(div);
      });

      // Voter list
      voterList.innerHTML = "<h3>Voters</h3>" +
        votes.map(function (v) {
          return '<span class="voter-tag">' + escapeHtml(v.DisplayName || v.RowKey) + "</span>";
        }).join(" ");

    }).catch(function (e) {
      showAlert(container, "Failed to load results: " + e.message);
    }).then(function () {
      refreshBtn.disabled = false;
      refreshBtn.textContent = "Refresh";
    });
  }

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }
});
