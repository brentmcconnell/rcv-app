// Shared utilities used across all pages (except index.html).

// Redirect to index.html if the user hasn't entered the passcode.
function checkPasscode() {
  if (sessionStorage.getItem("rcv_passcode") !== CONFIG.passcode) {
    window.location.href = "index.html";
    return false;
  }
  return true;
}

// ---- Name helpers ----

// Trim and collapse whitespace.
function normalizeName(name) {
  return name.trim().replace(/\s+/g, " ");
}

// Create a Table Storage–safe RowKey from a name (lowercase, alphanumeric + hyphens).
function normalizeNameKey(name) {
  return normalizeName(name)
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, "-");
}

// Convert a string to Title Case.
function titleCase(name) {
  return name.replace(/\b\w/g, function (c) { return c.toUpperCase(); });
}

// Levenshtein distance between two strings.
function levenshtein(a, b) {
  var m = a.length, n = b.length;
  var dp = [];
  for (var i = 0; i <= m; i++) {
    dp[i] = [i];
    for (var j = 1; j <= n; j++) {
      dp[i][j] = 0;
    }
  }
  for (var j = 0; j <= n; j++) dp[0][j] = j;
  for (var i = 1; i <= m; i++) {
    for (var j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

// Compare a new name against a list of existing display names.
// Returns { exact: true, name } if the name already exists, or
//         { exact: false, similar: [...] } with close matches.
function findSimilarNames(name, existingNames) {
  var normalized = normalizeName(name).toLowerCase();
  var similar = [];

  for (var i = 0; i < existingNames.length; i++) {
    var existing = existingNames[i];
    var existingLower = existing.toLowerCase();

    // Exact match (case-insensitive)
    if (normalized === existingLower) {
      return { exact: true, name: existing };
    }
    // Levenshtein distance ≤ 2
    if (levenshtein(normalized, existingLower) <= 2) {
      similar.push(existing);
      continue;
    }
    // One name contains the other
    if (normalized.includes(existingLower) || existingLower.includes(normalized)) {
      similar.push(existing);
    }
  }

  return { exact: false, similar: similar };
}

// Show a temporary alert banner inside a container element.
function showAlert(container, message, type) {
  type = type || "error";
  var div = document.createElement("div");
  div.className = "alert alert-" + type;
  div.textContent = message;
  container.prepend(div);
  setTimeout(function () { div.remove(); }, 5000);
}
