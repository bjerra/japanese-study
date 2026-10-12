/* Rebuild data/jlpt-kanji.json from the OpenJLPT kanji lists.
   Adding a lesson does not need this script. Run it only to refresh
   the JLPT reference data:

     node tools/build-jlpt-kanji.js
*/
var fs = require("fs");
var https = require("https");
var path = require("path");

var LEVELS = ["n5", "n4", "n3", "n2", "n1"];
var ROOT = "https://raw.githubusercontent.com/evanclan/OpenJLPT/main/data/json/kanji/";

function get(url) {
  return new Promise(function (resolve, reject) {
    https.get(url, function (res) {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        get(res.headers.location).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(url + " returned " + res.statusCode));
        return;
      }
      var chunks = [];
      res.on("data", function (chunk) { chunks.push(chunk); });
      res.on("end", function () { resolve(Buffer.concat(chunks).toString("utf8")); });
    }).on("error", reject);
  });
}

function main() {
  var kanji = {};
  var counts = {};
  var chain = Promise.resolve();
  LEVELS.forEach(function (name) {
    chain = chain.then(function () {
      return get(ROOT + name + ".json").then(function (text) {
        var list = JSON.parse(text);
        counts[name] = list.length;
        list.forEach(function (item) {
          var ch = item && item.character;
          if (!ch || kanji[ch]) return;
          kanji[ch] = [
            item.level || name.toUpperCase(),
            (item.meanings || []).join(", "),
            (item.onyomi || []).join("、"),
            (item.kunyomi || []).join("、")
          ];
        });
      });
    });
  });
  return chain.then(function () {
    var out = {
      license: "CC BY-SA 4.0",
      source: "OpenJLPT kanji lists (https://github.com/evanclan/OpenJLPT). Levels: Jonathan Waller, https://www.tanos.co.uk/jlpt/ (CC BY). Readings and meanings: KANJIDIC2, EDRDG (CC BY-SA 4.0).",
      note: "There is no official JLPT kanji list for the N5–N1 system used since 2010. These levels are approximate. Each kanji value is [level, meanings, on readings, kun readings].",
      kanji: kanji
    };
    var file = path.join(__dirname, "..", "data", "jlpt-kanji.json");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(out));
    console.log("wrote", file, "kanji", Object.keys(kanji).length, "counts", JSON.stringify(counts));
  });
}

main().catch(function (error) {
  console.error(error);
  process.exit(1);
});
