var fetch = require("node-fetch");
var fs = require("fs").promises;
var qs = require("querystring");
var cheerio = require("cheerio");
var bookcovers = require("bookcovers");
var sharp = require('sharp');

var getEndpoint = query => `http://images.btol.com/ContentCafe/Jacket.aspx?${qs.stringify(query)}`;

module.exports = function(grunt) {

  var wait = function(delay) {
    return new Promise(ok => setTimeout(ok, delay));
  };

  var getCoverFromBakerTaylor = async function({ isbn, seamus, title, year }) {
    var params = {
      Value: isbn,
      UserID: process.env.BAKER_TAYLOR_API_USERID,
      Password: process.env.BAKER_TAYLOR_API_PASSWORD,
      Return: "T",
      Type: "L"
    }
    var response = await fetch(getEndpoint(params));
    var contents = await response.buffer();
    // if it's too small, let's get it from Seamus instead
    if (contents.length < 5000) {
      console.log(`Baker & Taylor bailed on ${isbn}, pulling Seamus image...`);
      response = await fetch(`https://npr.org/books/titles/${seamus}`);
      var page = await response.text();
      var $ = cheerio.load(page);
      var tag = $(".bucketwrap.book .img, .bucketwrap.bookedition .img");
      if (!tag.length) {
        console.log(`Unable to load an image from Seamus for "${title}" (${year})`);
        return;
      }
      var src = tag[0].attribs["data-original"] || tag[0].attribs.src;
      src = src.replace(/-s\d+.*\.jpg/, "-s400-c70.jpg");
      var image = await fetch(src);
      contents = await image.buffer();
    }

    return contents
  };

  // fetch cover image from bookcovers API
  // https://github.com/e-e-e/book-covers-api
  var getCoverFromBookcovers = async function(book) {
    console.log(`Fetching book cover url: ${book.isbn}`)
    const bookcoversResult = await bookcovers.withIsbn(book.isbn)
    const amazonSizes = Object.keys(bookcoversResult.amazon)
    const largestAmazonCover = Math.max.apply(null, amazonSizes.map(s => parseFloat(s, 10)))
    const url = bookcoversResult.amazon[largestAmazonCover + 'x'] ||
      bookcoversResult.amazon['2x'] ||
      bookcoversResult.openLibrary.large ||
      bookcoversResult.amazon['1.5x'] ||
      bookcoversResult.openLibrary.medium ||
      bookcoversResult.amazon['1x'] ||
      bookcoversResult.openLibrary.small
    console.log(`Fetching book cover: ${url}`)
    const response = await fetch(url);
    const buffer = await response.buffer();
    return { buffer, url };
  };

  var getCovers = async function(books) {

    var limit = 10;

    for (var i = 0; i < books.length; i += limit) {
      console.log(`Requesting books ${i}-${i + limit - 1}`);
      var batch = books.slice(i, i + limit);
      var requests = batch.map(async function(book) {
        const path = `src/assets/covers/${book.isbn}.jpg`
        if (grunt.file.exists(path) || grunt.file.exists(path)) return true;
        const { buffer, url } = await getCoverFromBookcovers(book);

        // Amazon images are in the WebP image format. Safari and iOS only added support in June 2020. 85% of global users have support at time of writing. See https://caniuse.com/webp.
        // Use sharp to convert to jpg. See https://github.com/lovell/sharp.
        const isWebp = url.includes('amazon.com')
        if (isWebp) {
          await sharp(buffer).toFile(path)
        }
        else {
          await fs.writeFile(path, contents);
        }

        await wait(1000);
      });
      await Promise.all(requests);
    }
  };

  grunt.registerTask("covers", "Get cover images from bookcovers API", function() {

    var done = this.async();

    grunt.task.requires("shelve");

    grunt.file.mkdir("src/assets/covers");

    // get all books from all sheets
    var books = grunt.data.shelf
      .filter(book => book.isbn);
    getCovers(books).then(done);

  });
};