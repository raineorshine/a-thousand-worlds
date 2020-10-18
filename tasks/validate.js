var fs = require("fs");
var asyncFS = fs.promises;
var chalk = require("chalk");
var crypto = require("crypto");

var checksum = function(filename, callback) {
  return new Promise(function(ok) {
    var input = fs.createReadStream(filename);
    var hash = crypto.createHash("md5");
    hash.on("data", function(digest) {
      ok(digest.toString("hex"));
    });
    input.pipe(hash);
  });
}

var error = function(message) {
  console.log(chalk.red(message))
}

var success = function(message) {
  console.log(chalk.green(message))
}

module.exports = function(grunt) {

  var header = function(title) {
    console.log(`\n======== ${title} ========\n`);
  }

  var tags = async function() {

    // count tag usage and note items with only a few items
    var counts = {};
    for (var book of grunt.data.shelf) {
      for (var t of book.tags) {
        if (!counts[t]) counts[t] = [];
        counts[t].push(book.year);
      }
    }
    var rareTags = Object.keys(counts).filter(t => counts[t].length < 20);
    if (!rareTags.length) return true;
    for (t of rareTags) {
      console.log(`Tag "${t}" has very few books (used: ${counts[t].join(", ")})`);
    }
  };

  var integrity = async function() {
    var yearIDs = {};
    var passed = true;
    for (var book of grunt.data.shelf) {
      if (!book.isbn) {
        passed = false;
        error(`"${book.title}" (${book.year}) is missing an ISBN`);
        continue;
      }
      if (!book.id) {
        passed = false;
        error(`"${book.title}" (${book.year}) lacks an ID`);
        continue;
      }
      if (!yearIDs[book.year]) yearIDs[book.year] = new Set();
      if (yearIDs[book.year].has(book.id)) {
        passed = false;
        error(`Book #${book.id} in ${book.year} ("${book.title}") has a duplicate ID`);
      }
      yearIDs[book.year].add(book.id);
      "title text reviewer tags isbn".split(" ").forEach(function(p) {
        if (!book[p]) {
          passed = false;
          error(`Book ${book.id}: ${book.title} (${book.year}) is missing property "${p}"`);
        }
      })
    }
    return passed;
  };

  var badCovers = async function() {
    // Check for book images that read as "NO IMAGE AVAILABLE"
    var coverFiles = await asyncFS.readdir("src/assets/covers");
    var passed = true;
    for (var f of coverFiles) {
      var file = `src/assets/covers/${f}`
      var stat = await asyncFS.stat(file);
      if (stat.size < 4000) {
        // var digest = await checksum(file);
        passed = false;
        error(`Cover ${f} is probably broken`);
      }
    }
    return passed;
  };

  var missingCovers = async function() {
    // Check which books are missing a cover image
    var passed = true;
    for (var book of grunt.data.shelf) {
      var { isbn, title, year } = book;
      var coverPathBase = `src/assets/covers/${isbn}.`;
      const webpExists = fs.existsSync(coverPathBase + 'webp');
      const jpgExists = webpExists ? undefined : fs.existsSync(coverPathBase + 'jpg');

      if (!webpExists && !jpgExists) {
        passed = false;
        error(`"${title}" (${year}) is missing its cover file.`);
      }
    }
    return passed;
  };

  var reviewers = async function() {
    // Are all reviewers used somewhere?
    var passed = true;
    Object.keys(grunt.data.json.reviewers).forEach(function(reviewer) {
      var matched = grunt.data.shelf.some(book => book.reviewer == reviewer);
      if (!matched) {
        console.log(`Reviewer ${reviewer} has no reviewed books.`);
        passed = false;
      }
    });
    return passed;
  };

  var reviewed = async function() {
    // Do all books have a valid reviewer?
    var noReviewer = grunt.data.shelf.filter(b => !(b.reviewer in grunt.data.json.reviewers));
    noReviewer.forEach(b => error(`Book "${b.title}" (${b.year}) doesn't have a valid reviewer (${b.reviewer}).`));
    return !noReviewer.length;
  };

  var links = async function() {
    return grunt.data.json.links.every(function(link) {
      var linked = grunt.data.shelf.some(b => b.id == link.id && b.year == link.year);
      if (!linked) console.log(`Unreferenced link: ${link.source} on ${link.book} (${link.year}).`);
      return linked;
    });
  };

  var validate = async function(tasks = null) {

    var validation = { integrity, tags, badCovers, missingCovers, reviewers, reviewed, links };

    for (var k in validation) {
      if (!tasks || tasks.indexOf(k) > -1) {
        header(k);
        var pass = await validation[k]();
        if (pass) success(`Tests passed for ${k}`);
      }
    }

  };

  grunt.registerTask("validate", "Checks book data for issues", function() {

    grunt.task.requires("shelve");

    var done = this.async();
    validate(grunt.option("check")).then(done);

  });

}
