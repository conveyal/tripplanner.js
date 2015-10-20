import point from 'turf-point'
import tin from 'turf-tin'
import Vertex from './vertex'

/** accumulate results from the profile router into min avg max */
export default class ResultStore {
	constructor (transportNetwork) {
    this.network = transportNetwork
    this.results = new Map()
  }

  accumulate (results) {
    results.forEach((time, vertex) => {
      if (this.results.has(vertex)) {
        this.results.get(vertex).foldIn(time)
      } else {
        this.results.set(vertex, new Result(time))
      }
    })
  }

  /** Which is one of BEST_CASE, WORST_CASE, AVERAGE */
  toIsochrones (which) {
    let param
    // best case accessibility is min time
    if (which === 'BEST_CASE') param = 'min'
    else if (which === 'AVERAGE') param = 'avg'
    else if (which === 'WORST_CASE') param = 'max'
    else {
      console.log('Invalid envelope parameter')
      return
    }

    let points = []
    let v = new Vertex(this.network.streetLayer)
    this.results.forEach((result, vidx) => {
      // TODO why is this happening
      if (vidx === undefined) return

      if (result.avg < 3600) console.log(result)

      v.seek(vidx)
      points.push(point([v.getLon(), v.getLat()], { weight: result[param] }))
    })

    let tri = tin({type: 'FeatureCollection', features: points}, 'weight')
    tri.features = tri.features.filter(f => f.properties.a < 3600 && f.properties.b < 3600 && f.properties.c < 3600)
    return tri
  }
}

class Result {
  constructor (time) {
    this.min = this.sum = this.max = time
    this.count = 1
  }

  foldIn (time) {
    if (time > this.max) this.max = time
    if (time < this.min) this.min = time
    this.count++
    this.sum += time
  }

  get avg () {
    return this.sum / this.count
  }
}
