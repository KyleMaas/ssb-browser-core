const bipf = require('bipf')
const pull = require('pull-stream')
const pl = require('pull-level')
const jsonCodec = require('flumecodec/json')
const Plugin = require('ssb-db2/indexes/plugin')

const isFeed = require('ssb-ref').isFeed

// 1 index:
// - feed => hydrated about

module.exports = function (log, dir) {
  const bValue = Buffer.from('value')
  const bAuthor = Buffer.from('author')
  const bContent = Buffer.from('content')
  const bType = Buffer.from('type')
  const bAbout = Buffer.from('about')

  let batch = []

  const name = 'profiles'
  const { level, offset, stateLoaded, onData, writeBatch } = Plugin(
    dir,
    name,
    1,
    handleData,
    writeData,
    beforeIndexUpdate
  )

  function writeData(cb) {
    level.batch(batch, { keyEncoding: 'json', valueEncoding: 'json' }, cb)
    batch = []
  }

  function handleData(record, processed) {
    if (record.offset < offset.value) return batch.length
    const recBuffer = record.value
    if (!recBuffer) return batch.length // deleted

    let p = 0 // note you pass in p!
    p = bipf.seekKey(recBuffer, p, bValue)
    if (!~p) return batch.length

    const pAuthor = bipf.seekKey(recBuffer, p, bAuthor)
    const author = bipf.decode(recBuffer, pAuthor)

    const pContent = bipf.seekKey(recBuffer, p, bContent)
    if (!~pContent) return batch.length

    const pType = bipf.seekKey(recBuffer, pContent, bType)
    if (!~pType) return batch.length

    if (bipf.compareString(recBuffer, pType, bAbout) === 0) {
      const content = bipf.decode(recBuffer, pContent)
      if (content.about != author) return batch.length

      updateProfileData(author, content)

      if (isFeed(author)) {
        batch.push({
          type: 'put',
          key: author,
          value: profiles[author]
        })
      }
    }

    return batch.length
  }
  
  function updateProfileData(author, content) {
    let profile = profiles[author] || {}

    if (content.name)
      profile.name = content.name

    if (content.description)
      profile.description = content.description

    if (content.image && typeof content.image.link === 'string')
      profile.image = content.image.link
    else if (typeof content.image === 'string')
      profile.image = content.image

    profiles[author] = profile
  }

  let profiles = {}
  
  function beforeIndexUpdate(cb) {
    pull(
      pl.read(level, {
        gte: '',
        lte: undefined,
        keyEncoding: jsonCodec,
        valueEncoding: jsonCodec,
        keys: true
      }),
      pull.collect((err, data) => {
        profiles = {}
        data.forEach(x => profiles[x.key] = x.value)
        cb()
      })
    )
  }

  function getProfile(feedId) {
    return profiles[feedId] || {}
  }

  function getProfiles() {
    return profiles
  }

  return {
    offset,
    stateLoaded,
    onData,
    writeBatch,
    name,

    remove: level.clear,
    close: level.close.bind(level),

    getProfile,
    getProfiles
  }
}
