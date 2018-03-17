'use strict'

const semver = require('semver')
const md5 = require('md5')

const { yarnEntry } = require('./yarn-entry')
const { manifestFetcher } = require('./manifest-fetcher')
const { getSha1Integrity } = require('../util/integrity')

module.exports = {
  yarnTree (nodeModulesTree, packageJson) {
    let entries = new Map()
    const getManifest = manifestFetcher(packageJson)
    function _addManifestSemvers (manifest, node) {
      Object.keys(manifest.dependencies).forEach(depName => {
        if (!node.dependencies.get(depName)) return
        // eg. fsevents TODO: fix for platform specific dependencies
        const key = md5(depName + node.dependencies.get(depName).version)
        const semverString = manifest.dependencies[depName]
        const entry = entries.get(key) || yarnEntry()
        entry.semvers.push(semverString)
        entries.set(key, entry)
      })
    }
    async function addEntry (node) {
      if (node.bundled) return
      const manifest = await getManifest(node)
      const key = md5(node.name + node.version)
      const entry = entries.get(key) || yarnEntry()
      const resolved = node.resolved || manifest.resolved || manifest._resolved
      _addManifestSemvers(manifest, node)
      if (!node.address) return // root node
      entry.node = entry.node || node
      entry.name = node.name
      entry.version = semver.valid(node.version) ? node.version : manifest.version
      entry.dependencies = manifest.dependencies
      entry.integrity = await getSha1Integrity(node.integrity, resolved, manifest)
      entry.resolved = resolved
      entries.set(key, entry)
    }
    function toObject () {
      return Array.from(entries.entries()).reduce((obj, [key, val]) => {
        if (!val.name) return obj // bundled deps
        const name = val.name
        const semverStrings = val.semvers
        semverStrings.forEach(s => {
          obj[`${name}@${s}`] = val.toObject()
        })
        return obj
      }, {})
    }
    return Object.freeze({
      addEntry,
      toObject
    })
  }
}