import BitSet from './bitset'
import StreetRouter from './street-router'
import ResultStore from './result-store'

/** perform transit routing using range-raptor, monte carlo simulations of frequency-based routes, etc. */
export default class TransitRouter {
  constructor (transportNetwork, profileRequest) {
    this.request = profileRequest
    this.accessTimes = new Map()
    this.network = transportNetwork
    this.bestTimes = new Map()
    this.bestNonTransferTimes = new Map()
    this.boardSlack = 60 // seconds
    this.results = new ResultStore(this.network)

    this.doInitialStreetSearch()
  }

  /** perform the initial street search to find transit stops */
  doInitialStreetSearch () {
    console.log('performing initial street search')
    let router = new StreetRouter(this.network)
    router.setOrigin(this.request.fromLat, this.request.fromLon)
    // not setting destination: this is a batch request
    router.route()

    console.log(`${this.network.transitLayer.stopVertexForStop.length} stops linked`)

    this.network.transitLayer.stopVertexForStop.forEach((vertexIdx, stopIdx) => {
      if (vertexIdx === -1 || vertexIdx == null) {
        console.log(`stop ${stopIdx} is unlinked`)
      }

      if (router.best.has(vertexIdx) && router.best.get(vertexIdx) < 1200) {
        this.accessTimes.set(stopIdx, router.best.get(vertexIdx))
      }
    })

    console.log(`initial street search reached ${router.best.size} vertices and ${this.accessTimes.size} transit stops`)
  }

  initialize (departureTime) {
    // NB comment this out in order to use range raptor
    this.bestTimes = new Map()
    this.bestNonTransferTimes = new Map()
    this.stopsTouched = new BitSet(this.network.transitLayer.stopVertexForStop.length)

    this.accessTimes.forEach((accessTime, stop) => {
      this.bestTimes.set(stop, departureTime + accessTime)
      this.stopsTouched.set(stop)
    })
  }

  /** perform a RAPTOR search */
  doRaptor () {
    console.log('begin RAPTOR and propagation')
    console.dir(this.request)
    // loop backwards over time window. TODO: range-raptor
    let minute = 0
    for (let time = this.request.toTime - 60; time >= this.request.fromTime; time -= 60) {
      console.log(`minute ${minute++}`)
      this.initialize(time)

      const tl = this.network.transitLayer

      // continue searching until no improvements are made
      let round = 0
      while (this.stopsTouched.cardinality > 0) {
        console.log(`round ${round++}`)
        let previousStopsTouched = this.stopsTouched
        this.stopsTouched = new BitSet(this.stopsTouched.size)

        for (let patternIdx = 0; patternIdx < tl.patterns.length; patternIdx++) {
          // TODO: mark patterns
          let pattern = tl.patterns[patternIdx]
          let onTrip = -1
          for (let stopPosInPatt = 0; stopPosInPatt < pattern.stops.length; stopPosInPatt++) {
            // TODO: check pickup/dropoff type
            // first check if we should board here (we do this even if we're already on board, because there may be an earlier
            // place to board further down the line)
            let stopId = pattern.stops[stopPosInPatt].stopId

            if (previousStopsTouched.isSet(stopId)) {
              // what time would we depart if we board here
              let earliestTimeAtBoarding = this.bestTimes.get(stopId) + this.boardSlack
              let bestTrip = -1
              let bestTripTime = Infinity

              // linear search. TODO: sort and do binary search? Doesn't work for overlapping trips.
              for (let trip = 0; trip < pattern.schedules.length; trip++) {
                let departureTime = pattern.schedules[trip].times[stopPosInPatt * 2 + 1]
                if (departureTime < bestTripTime && departureTime > earliestTimeAtBoarding) {
                  bestTripTime = departureTime
                  bestTrip = trip
                }
              }

              if (bestTrip !== -1 && (onTrip === -1 || bestTripTime < pattern.schedules[onTrip].times[stopPosInPatt * 2 + 1])) {
                // board this trip
                onTrip = bestTrip
              }
            }

            if (onTrip !== -1 && (!this.bestTimes.has(stopId) || pattern.schedules[onTrip].times[stopPosInPatt * 2] < this.bestTimes.get(stopId))) {
              // disembark here
              this.bestTimes.set(stopId, pattern.schedules[onTrip].times[stopPosInPatt * 2])
              this.bestNonTransferTimes.set(stopId, pattern.schedules[onTrip].times[stopPosInPatt * 2])
              this.stopsTouched.set(stopId)
            }
          }
        }

        // do transfers
        console.log('transfers')
        let stopsTouchedThisRound = this.stopsTouched
        // make a protective copy to modify b/c we don't want to transfer from a stop we reached via a transfer
        this.stopsTouched = this.stopsTouched.clone()

        for (let stop = 0; stop < stopsTouchedThisRound.size; stop++) {
          if (!stopsTouchedThisRound.isSet(stop)) continue

          // do the transfers
          let xfers = tl.transfersForStop[stop]

          // tranfers are a jagged array of [target, time]
          for (let xi = 0; xi < xfers.length; xi += 2) {
            // NB using bestNonTransferTimes here to enforce no-double-transfers (i.e. transfer from stop A to B and then B to C without boarding a vehicle)
            let xtime = this.bestNonTransferTimes.get(stop) + xfers[xi + 1]
            if (!this.bestTimes.has(xfers[xi]) || xtime < this.bestTimes.get(xfers[xi])) {
              // NB only setting best times not bestNonTransferTimes
              this.bestTimes.set(xfers[xi], xtime)
              this.stopsTouched.set(stop)
            }
          }
        }
      } // end loop over rounds

      // do propagation (multi-origin dijkstra)
      console.log('propagation')
      let propRouter = new StreetRouter(this.network)

      // enqueue origins
      this.bestNonTransferTimes.forEach((bestTime, stopId) => {
        // TODO confusion of distance and time
        propRouter.pq.enq({v: this.network.transitLayer.stopVertexForStop[stopId], dist: bestTime - time})
      })

      // also enqueue the origin to find direct walking routes
      propRouter.pq.enq({v: this.origin, dist: 0})

      propRouter.route()

      this.results.accumulate(propRouter.best)
    }
  }
}
