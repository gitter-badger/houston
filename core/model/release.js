/**
 * core/model/release.js
 * Mongoose schema for cycles
 *
 * @exports {Object} default {
 *   {Object} releaseSchema - Mongoose schema for release model
 * }
 */

import Mongoose from 'mongoose'
import Semver from 'semver'

import { Cycle } from './cycle'

const ReleaseSchema = new Mongoose.Schema({
  github: {
    id: Number,              // Id for Github API
    author: String,          // Github user login
    date: Date,              // Github publish date
    tag: String              // Github uncleaned tag (v4.2.3)
  },

  changelog: [String],

  cycles: [{
    type: Mongoose.Schema.Types.ObjectId,
    ref: 'cycle'
  }]
})

ReleaseSchema.set('toJSON', { virtuals: true })

ReleaseSchema.virtual('version').get(function () {
  if (this.github.tag != null) return Semver.clean(this.github.tag, true)

  return '0.0.0'
})

ReleaseSchema.virtual('tag').get(function () {
  if (this.github.tag != null) return this.github.tag

  return null
})

ReleaseSchema.methods.toSolid = async function () {
  let release = this.toJSON()
  release.status = await this.getStatus()

  return this
}

ReleaseSchema.methods.getStatus = async function () {
  const cycle = await this.getCycle()

  if (cycle == null) return 'STANDBY'
  return await cycle.getStatus()
}

ReleaseSchema.methods.getCycle = async function () {
  const cycles = await this.getCycles()

  if (cycles == null || cycles.length < 1) return null
  return cycles[0]
}

ReleaseSchema.methods.getCycles = async function () {
  return await Cycle.find({_id: { $in: this.cycles }})
}

ReleaseSchema.post('save', async release => {
  const project = release.ownerDocument()

  const cycle = await Cycle.create({
    _tag: release.tag,
    type: 'INIT'
  })

  await project.model('project').findOneAndUpdate({
    _id: project._id,
    'releases._id': release._id
  }, {
    $addToSet: {
      cycles: cycle._id,
      'releases.$.cycles': cycle._id
    }
  })
})

export default { ReleaseSchema }