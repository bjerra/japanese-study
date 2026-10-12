(function (root) {
  var KEY = "japanese-study-vocab-scores";
  var memory = null;

  function keyFor(word, reading) {
    return String(word || "") + "\n" + String(reading || "");
  }

  function read() {
    if (memory) return copy(memory);
    var data = {};
    try {
      var raw = localStorage.getItem(KEY);
      var parsed = raw ? JSON.parse(raw) : {};
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        Object.keys(parsed).forEach(function (id) {
          var row = parsed[id];
          if (!row || typeof row !== "object") return;
          var attempts = Number(row.attempts);
          var firstTry = Number(row.firstTry);
          if (!isFinite(attempts) || attempts < 0) attempts = 0;
          if (!isFinite(firstTry) || firstTry < 0) firstTry = 0;
          var last = row.last === "first" || row.last === "later" ? row.last : "";
          if (!attempts && !last) return;
          data[id] = { attempts: attempts, firstTry: firstTry, last: last };
        });
      }
    } catch (e) {}
    memory = data;
    return copy(data);
  }

  function copy(data) {
    var out = {};
    Object.keys(data).forEach(function (id) {
      var row = data[id];
      out[id] = { attempts: row.attempts, firstTry: row.firstTry, last: row.last };
    });
    return out;
  }

  function write(data) {
    memory = data;
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (e) {}
  }

  function notify() {
    root.dispatchEvent(new CustomEvent("japanese-study-vocab-scores"));
  }

  function stats(word, reading) {
    return read()[keyFor(word, reading)] || null;
  }

  function isMastered(word, reading) {
    var row = stats(word, reading);
    return !!(row && row.last === "first");
  }

  function record(word, reading, firstTry) {
    if (!word) return;
    var data = read();
    var id = keyFor(word, reading);
    var row = data[id] || { attempts: 0, firstTry: 0, last: "" };
    row.attempts += 1;
    if (firstTry) row.firstTry += 1;
    row.last = firstTry ? "first" : "later";
    data[id] = row;
    write(data);
    notify();
  }

  function reset() {
    memory = {};
    try {
      localStorage.removeItem(KEY);
    } catch (e) {}
    notify();
  }

  root.JapaneseStudyScores = {
    stats: stats,
    isMastered: isMastered,
    record: record,
    reset: reset
  };
})(globalThis);
