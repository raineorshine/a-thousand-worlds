const execa = require('execa')
const project = require('../project.json');

module.exports = grunt => {
  grunt.registerTask('publish', 'Pushes the build folder to surge', async function(deploy) {

    const done = this.async()

    if (!deploy) {
      grunt.fail.fatal('No deployment target specified. Use "grunt publish:TARGET" where TARGET may be: ' + Object.keys(project.surge).join(', '))
    }

    // publish to surge and pipe output to stdout
    try {
      const surgeProcess = execa('surge', ['build', project.surge[deploy]])
      surgeProcess.stdout.pipe(process.stdout)
      await surgeProcess
    }
    catch(e) {
      process.exit(1)
    }

    done()

  })
}
