(function () {
  var ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

  document.addEventListener("DOMContentLoaded", function () {
    var list = document.getElementById("lesson-list");
    var status = document.getElementById("status");

    fetch("lessons/index.json")
      .then(function (response) {
        if (!response.ok) throw new Error("Could not load lessons/index.json (" + response.status + ").");
        return response.text();
      })
      .then(function (text) {
        var index = JSON.parse(text.replace(/^\uFEFF/, ""));
        var ids = index && Array.isArray(index.lessons) ? index.lessons : null;
        if (!ids) throw new Error('lessons/index.json must be an object with a "lessons" array of id strings.');
        if (!ids.length) {
          status.hidden = false;
          status.textContent = "No lessons yet.";
          return;
        }
        return Promise.all(ids.map(function (id) {
          return loadLesson(id);
        }));
      })
      .then(function (cards) {
        if (!cards) return;
        status.hidden = true;
        cards.forEach(function (card) {
          list.append(card);
        });
      })
      .catch(function (error) {
        var hint = location.protocol === "file:"
          ? " Open the site through a local web server, not as a file."
          : "";
        status.hidden = false;
        status.classList.add("error");
        status.textContent = error.message + hint;
      });
  });

  function loadLesson(id) {
    if (!ID_RE.test(id)) {
      return Promise.resolve(messageCard("Index id “" + id + "” is not a lowercase id. Use letters, numbers, and hyphens."));
    }
    return fetch("lessons/" + id + ".json")
      .then(function (response) {
        if (!response.ok) throw new Error("Could not load lessons/" + id + ".json (" + response.status + ").");
        return response.json();
      })
      .then(function (lesson) {
        return lessonCard(id, lesson);
      })
      .catch(function (error) {
        return messageCard(error.message);
      });
  }

  function lessonCard(id, lesson) {
    var item = document.createElement("li");
    var link = document.createElement("a");
    link.className = "lesson-card";
    link.href = "lesson.html?id=" + encodeURIComponent(id);

    if (lesson.level) {
      var level = document.createElement("p");
      level.className = "level";
      level.textContent = lesson.level;
      link.append(level);
    }

    var title = document.createElement("h2");
    title.lang = "ja";
    title.setAttribute("translate", "no");
    title.textContent = lesson.title || id;
    link.append(title);

    if (lesson.titleReading) {
      var reading = document.createElement("p");
      reading.className = "card-reading";
      reading.lang = "ja";
      reading.setAttribute("translate", "no");
      reading.textContent = lesson.titleReading;
      link.append(reading);
    }

    if (lesson.summary) {
      var summary = document.createElement("p");
      summary.className = "card-summary";
      summary.textContent = lesson.summary;
      link.append(summary);
    }

    item.append(link);
    return item;
  }

  function messageCard(text) {
    var item = document.createElement("li");
    var box = document.createElement("p");
    box.className = "panel error";
    box.textContent = text;
    item.append(box);
    return item;
  }
})();
