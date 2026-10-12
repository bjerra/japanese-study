(function (root) {
  var KEY = "japanese-study-cleared";
  var memory = null;

  function read() {
    if (memory) return copy(memory);
    var set = {};
    try {
      var raw = localStorage.getItem(KEY);
      var list = raw ? JSON.parse(raw) : [];
      if (Array.isArray(list)) {
        list.forEach(function (id) {
          if (typeof id === "string" && id) set[id] = true;
        });
      }
    } catch (e) {}
    memory = set;
    return copy(set);
  }

  function write(set) {
    memory = set;
    var list = [];
    Object.keys(set).forEach(function (id) {
      if (set[id]) list.push(id);
    });
    try {
      localStorage.setItem(KEY, JSON.stringify(list));
    } catch (e) {}
  }

  function copy(set) {
    var out = {};
    Object.keys(set).forEach(function (id) {
      if (set[id]) out[id] = true;
    });
    return out;
  }

  function isCleared(id) {
    return !!read()[id];
  }

  function setCleared(id, cleared) {
    if (!id) return;
    var set = read();
    if (cleared) set[id] = true;
    else delete set[id];
    write(set);
    root.dispatchEvent(new CustomEvent("japanese-study-cleared", {
      detail: { id: id, cleared: !!cleared }
    }));
  }

  function countCleared(ids) {
    var set = read();
    var n = 0;
    (ids || []).forEach(function (id) {
      if (set[id]) n += 1;
    });
    return n;
  }

  root.JapaneseStudyProgress = {
    isCleared: isCleared,
    setCleared: setCleared,
    clearedMap: read,
    countCleared: countCleared
  };
})(globalThis);
