import fs from 'fs'
import http from 'http'
import url from 'url'
import TransportNetwork from './transport-network'
import StreetRouter from './street-router'
import TransitRouter from './transit-router'

// get the transport network file
// node is dumb and may include both the path to node executable _and_ the path to this script in argv
let tnFile = process.argv[process.argv.length  - 1]

console.log(`loading transport network from ${tnFile}`)

let str = fs.createReadStream(tnFile)

function logMemoryUsage () {
  let { heapTotal, heapUsed } = process.memoryUsage()
  console.log(`heap: ${Math.round(heapTotal / (1024 * 1024))}M, used: ${Math.round(heapUsed / (1024 * 1024))}M`)
}

TransportNetwork.read(str, function (tn) {

  logMemoryUsage()

  tn.streetLayer.index()

  logMemoryUsage()

  http.createServer((req, res) => {
    try {
      console.log(req.url)

      let parsed = url.parse(req.url, true)

      if (parsed.path == '/') {
        // inefficient to read client from disk each time but does ensure browser always gets latest code
        let client = fs.readFileSync('index.html', {encoding: 'utf8'})
        res.statusCode = 200
        res.setHeader('Content-Type', 'text/html')
        res.write(client)
        res.end()
        return
      }

      let [fromLat, fromLon] = parsed.query.from.split(',')
      fromLat = parseFloat(fromLat)
      fromLon = parseFloat(fromLon)

      if (parsed.query.to != null) {
        // we're doing point-to-point street routing
        let [toLat, toLon] = parsed.query.to.split(',')
        toLat = parseFloat(toLat)
        toLon = parseFloat(toLon)

        let router = new StreetRouter(tn)

        router.setOrigin(fromLat, fromLon)
        router.setDestination(toLat, toLon)

        console.log(`routing from vertex ${router.origin} to vertex ${router.destination}`)

        if (router.origin === undefined || router.destination === undefined) {
          res.statusCode = 404
          res.statusMessage = 'vertices not found'
          res.end()
          return
        }

        router.route()

        let path = router.getPath()

        res.statusCode = 200
        res.statusMessage = 'Old Kinderhook'
        res.setHeader('Content-Type', 'application/json')
        res.write(JSON.stringify(path))
        res.end()

        console.log('request complete')
        logMemoryUsage()
      } else {
        // we're doing transit isochrone routing
        let req = {
          fromLat: fromLat,
          fromLon: fromLon,
          fromTime: 25200,
          toTime: 28800
        }
        let r = new TransitRouter(tn, req)
        r.doRaptor()

        res.statusCode = 200
        res.statusMessage = 'Old Kinderhook'
        res.setHeader('Content-Type', 'application/json')
        res.write(JSON.stringify(r.results.toIsochrones('AVERAGE')))
        res.end()
      }
    } catch (err) {
      res.statusCode = 500
      console.log(err)
      console.log(err.stack)
      res.statusMessage = err
      res.setHeader('Content-Type', 'text/plain')
      res.write(err + '\n' + err.stack)
      res.end()
    }
  }).listen(8181)
})