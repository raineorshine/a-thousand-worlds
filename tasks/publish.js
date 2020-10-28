const execa = require('execa')
const project = require('../project.json');

const validTargets = Object.keys(project.surge)
const instructions = 'Use "grunt publish:TARGET" where TARGET may be: ' + ['all', ...validTargets].join(', ')

module.exports = grunt => {
  grunt.registerTask('publish', 'Pushes the build folder to surge', async function(target) {

    const done = this.async()

    if (!target || !['all', ...validTargets].includes(target)) {
      grunt.fail.fatal((!target
        ? 'No deployment target specified. '
        : `Invalid deployment target "${target}". ` ) + instructions)
    }

    const targets = target === 'all' ? validTargets : [target]

    // publish to surge and pipe output to stdout
    await Promise.all(targets.map(async target => {
      try {
        const { stdout } = await execa('surge', ['build', project.surge[target]])
        console.log(stdout)
      }
      catch(e) {
        process.exit(1)
      }
    }))

    done()

  })
}
