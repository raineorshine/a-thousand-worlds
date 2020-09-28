/*

Fetch book metadata using node-isbn and output CSV text file.

*/

const fs = require("fs")
const nodeIsbn = require('node-isbn')
const pMap = require('p-map')

// remove newlines
// escape quotes by doubling them
const escapeDescription = s => s
  .replace(/\n/g, ' ')
  .replace(/"/g, '""')

module.exports = function(grunt) {

  grunt.registerTask("meta", "Fetch book metadata using node-isbn and output CSV text file", async function() {

    const done = this.async()

    grunt.task.requires("shelve")
    const isbns = grunt.data.shelf.map(book => book.isbn)

    const metadata = await pMap(isbns, isbn =>
      nodeIsbn
        // exclude ISBNDB (requires paid API key) https://isbndb.com/isbn-database
        .provider(['google', 'openlibrary', 'worldcat'])
        .resolve(isbn)
        .catch(e => console.error('No metadata found: ' + isbn)), { concurrency: 2 })

    // convert node-isbn metadata to a csv row
    const metaToRow = ({ authors, description, publishedDate, title } = {}, i = 0) => {
      // normalize the publishedDate field which is not consistent (e.g. 2019; 2019-02-01)
      const year = publishedDate
        ? (new Date(publishedDate + ' 00:00:00').getFullYear())
        : ''
      return `${i},,"${escapeDescription(title || '')}",,"${(authors || []).join(', ')}",,${year},,,${isbns[i]},,,,,"${escapeDescription(description || '')}"`
    }

    const csv = 'id,title,title (automated),author,author (automated),illustrator,year,reviewer,tags,isbn,seamus,itunes,goodreads,text,text (automated)\n' +
      metadata.map(metaToRow)
    .join('\n')

    fs.writeFileSync('data/books.csv.txt', csv)

    done()

  })

}