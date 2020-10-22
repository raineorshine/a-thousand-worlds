var { promisify } = require("util");
var imageSize = promisify(require("image-size"));
var { typogrify } = require("typogr");
const ISBN = require('isbn3');

var normalizeTags = function(tagString) {
  return (tagString || '')
    .replace(/['’]/g, "’")
    .split(/\s*[|,]\s*/)
    .map(t => t.trim())
    .filter(s => s);
};

var shelve = async function(grunt) {
  var shelf = [];

  var oneYear = grunt.option("year");

  for (var row of grunt.data.json.years) {
    var { year, sheet } = row;
    if (oneYear && year != oneYear) continue;
    console.log("Shelving " + year);
    var collection = grunt.data.json[sheet];
    var index = [];
    var lookup = {};
    var links = grunt.data.json.links.filter(l => l.year == year);
    for (var book of collection) {

      book.year = year;

      const tags = Array.isArray(book.tags) ? book.tags.join('|') : book.tags
      book.tags = normalizeTags(tags);

      book.text = grunt.template.renderMarkdown(book.text || "");

      "title author reviewer text".split(" ").forEach(p => book[p] = (book[p] || '').toString().trim());

      if (book.isbn) {
        var isbn = String(book.isbn).trim();
        if (isbn.length == 9) isbn = "0" + isbn;
        book.isbn = ISBN.asIsbn10(isbn)
        book.isbn13 = ISBN.asIsbn13(isbn)
      }

      // join against links, reviewers
      book.links = links.filter(l => l.id == book.id);

      // add smart quotes to the link text
      book.links.forEach(l => l.text = typogrify(l.text));

      // default to JPG. WebP may be used in the future.
      book.coverType = 'jpg'

      var indexEntry = {
        title: book.title,
        author: book.author,
        dimensions: {},
        isbn: book.isbn,
        tags: book.tags,
        id: book.id,
        coverType: book.coverType,
      };
      try {
        var size = await imageSize(`src/assets/covers/${book.isbn}.${book.coverType}`);
        indexEntry.dimensions = {
          width: size.width,
          height: size.height
        };
      } catch (_) { }
      shelf.push(book);
      index.push(indexEntry);
      lookup[book.id] = book;
    }
    grunt.file.write(`build/${year}.json`, JSON.stringify(index, null, 2));
    grunt.file.write(`build/${year}-detail.json`, JSON.stringify(lookup, null, 2));
  }

  grunt.data.shelf = shelf;

  grunt.file.write("build/shelf.json", JSON.stringify(shelf, null, 2));
}


module.exports = function(grunt) {

  grunt.registerTask("shelve", "Assemble books from individual years", function() {

    grunt.task.requires("json");

    var done = this.async();

    shelve(grunt).then(done);

  });

}