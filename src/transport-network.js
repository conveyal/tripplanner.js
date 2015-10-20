import StreetLayer from './street-layer'
import TransitLayer from './transit-layer'
import Dissolve from 'dissolve'

/** parse a big-endian integer array stored as a buffer */
function parseIntArray (buffer) {
  let ret = []
  for (let off = 0; off < buffer.length; off += 4) {
    ret.push(buffer.readInt32BE(off))
  }

  return ret
}

/**
 * Represents a TransportNetwork, very similar to the same-named class in OTP
 */
export default class TransportNetwork {
  /** read a transportnetwork from a stream */
  static read (stream, cb) {
    let tn = new TransportNetwork()

    // NB can't use arrows here as we need the this scope
    let parser = Dissolve().tap(function () {
      let verticesRead = 0
      this
        .doublebe('scaleFactor')
        .int32be('nVertices')
        .tap(function () {
          tn.streetLayer = new StreetLayer(this.vars.scaleFactor)
          console.log(`reading ${this.vars.nVertices} vertices`)
        })
        .loop(function (end) {
          if (verticesRead++ === this.vars.nVertices) {
            console.log(`read ${tn.streetLayer.lats.length} vertices`)
            end(true)
            return
          }

          this
            .int32be('lat')
            .int32be('lon')
            .tap(function () {
              tn.streetLayer.addVertexFixed(this.vars.lat, this.vars.lon)
            })

          if (verticesRead % 100000 === 0) {
            console.log(`${verticesRead} vertices...`)
          }
        })

      let edgesRead = 0
      let nEdges

      // now read edges
      this
        .int32be('nEdges')
        .tap(function () {
          nEdges = this.vars.nEdges
          console.log(`reading ${nEdges} edges`)
        })

      this
        .loop(function (end) {
          if (edgesRead++ === nEdges) {
            console.log(`read ${edgesRead} edges`)
            end(true)
            return
          }

          if (edgesRead % 100000 === 0) {
            console.log(`${edgesRead} edges`)
          }

          this
            .int32be('fromVertex')
            .int32be('lengthMm')
            .int32be('toVertex')
            .int32be('speed')
            .int32be('flags')
            .int32be('geomSize')
            .tap(function () {
              this.buffer('geom', this.vars.geomSize * 4)
                .tap(function () {
                  // temporarily disabling reading of geometry as it's slow
                  this.vars.geometry = []
                  tn.streetLayer.addEdge(this.vars)
                  this.vars = {}
                })
            })
        })

      // now read transit
      tn.transitLayer = new TransitLayer()
      let nTripPatterns
      let tripPatternsRead = 0

      this
        .int32be('nTripPatterns')
        .tap(function () {
          nTripPatterns = this.vars.nTripPatterns
          console.log(`reading ${nTripPatterns} trip patterns`)
        })
        .loop(function (endPatterns) {
          let stopsRead = 0

          if (tripPatternsRead++ === this.vars.nTripPatterns) {
            endPatterns()
            return
          }

          if (tripPatternsRead % 1000 === 0) {
            console.log(`${tripPatternsRead} patterns`)
          }

          // read route id
          // writeUTF in Java stores string lengths in shorts
          this.int16be('routeIdLen')
            .tap(function () {
              // TODO will javascript big-endian/little-endian mangle multibyte UTF characters?
              this.string('routeId', this.vars.routeIdLen)
            })
            .int32be('directionId')
            .int32be('nStops')
            .loop('stops', function (endStops) {
              if (stopsRead++ === this.vars.nStops) {
                endStops()
                return
              }

              this
                .int32be('stopId')
                .int32be('pickupType')
                .int32be('dropoffType')
            })

          // read the services this is active on
          this.loop('services', function (endServices) {
            this.int32be('serviceId')
              .tap(function () {
                if (this.vars.serviceId === -1) {
                  endServices(true)
                }
              })
          })

          // read the wheelchair accessibility information
          this.loop('wheelchairAccessible', function (endAccessible) {
            this.int32be('tripId')
              .tap(function () {
                if (this.vars.tripId === -1) {
                  endAccessible(true)
                }
              })
          })

          // read the schedules
          let schedulesRead = 0
          this
            .int32be('nSchedules')
            .loop('schedules', function (endSchedules) {
              if (schedulesRead++ === this.vars.nSchedules) {
                endSchedules(true)
                return
              }

              this
                .buffer('times', this.vars.nStops * 2 * 4)
                .tap(function () {
                  this.vars.times = parseIntArray(this.vars.times)
                })
                .int32be('flags')
            })

          // phew. trip pattern done
          this.tap(function () {
            // only save what is necessary
            tn.transitLayer.addPattern({
              routeId: this.vars.routeId,
              directionId: this.vars.directionId,
              stops: this.vars.stops,
              services: this.vars.services,
              wheelchairAccessible: this.vars.wheelchairAccessible,
              schedules: this.vars.schedules
            })

            // wipe out old state
            this.vars = {
              nTripPatterns: this.vars.nTripPatterns
            }
          })
        })

      // load up ancillary information about the street network
      // read transfers
      let nTxStopsRead = 0
      this
        .int32be('transferSize')
        .loop('transfersForStop', function (endTransfers) {
          if (nTxStopsRead++ === this.vars.transferSize) {
            endTransfers()
            return
          }

          this
            .int32be('transfersThisStop')
            .tap(function () {
              this.buffer('transfers', this.vars.transfersThisStop * 4)
              .tap(function () {
                tn.transitLayer.transfersForStop.push(parseIntArray(this.vars.transfers))
              })
            })
        })

      let nStopPattsRead = 0
      this
        .int32be('patternSize')
        .loop('patternsForStop', function (endPatterns) {
          if (nStopPattsRead++ === this.vars.patternSize) {
            endPatterns()
            return
          }

          this
            .int32be('patternsThisStop')
            .tap(function () {
              this.buffer('patterns', this.vars.patternsThisStop * 4)
              .tap(function () {
                tn.transitLayer.patternsForStop.push(parseIntArray(this.vars.patterns))
              })
            })
        })

      this
        .int32be('stopVertexSize')
        .tap(function () {
          console.log(`reading ${this.vars.stopVertexSize} stop vertices`)
          this.buffer('stopVertices', this.vars.stopVertexSize * 4)
            .tap(function () {
              tn.transitLayer.stopVertexForStop = parseIntArray(this.vars.stopVertices)
            })
        })
    })

    stream.pipe(parser).on('finish', () => {
      console.log('street network read')
      cb(tn)
    })
  }
}
