const ReactiveDao = require('reactive-dao')
const express = require('express');
const http = require('http')
const sockjs = require('sockjs')

let rooms = new Map()

class User {
  constructor(room, sessionId, ip, calling) {
    console.log("CREATE USER", sessionId, "CALLING =", calling)
    this.room = room
    this.sessionId = sessionId
    this.calling = new ReactiveDao.ObservableValue(calling)
    this.ip = new ReactiveDao.ObservableValue(ip)
    this.sdp = null
    this.ice = []
    let otherUser = room.otherUser(sessionId)
    this.otherUserSdp = new ReactiveDao.ObservableValue(otherUser ? otherUser.sdp : null)
    this.otherUserIce = new ReactiveDao.ObservableList(otherUser ? otherUser.ice : [])

    setTimeout(()=>this.clean(), 5000)
  }
  clean() {
    if(this.otherUserSdp.observers.length == 0
      && this.otherUserIce.observers.length == 0
      && this.ip.observers.length == 0)
      return this.room.deleteUser(this.sessionId)
    setTimeout(()=>this.clean(), 5000)
  }
  reset() {
    this.otherUserSdp.set(null)
    this.otherUserIce.set([])
  }
  setIp(ip) {
    this.ip.set(ip)
    let otherUser = this.room.otherUser(this.sessionId)
    if(otherUser) {
      otherUser.reset()
    }
  }
  getIp() {
    return this.ip.value
  }
  setSdp(sdp) {
    this.sdp = sdp
    let otherUser = this.room.otherUser(this.sessionId)
    if(otherUser) otherUser.otherUserSdp.set(sdp)
  }
  addIce(candidate) {
    this.ice.push(candidate)
    let otherUser = this.room.otherUser(this.sessionId)
    if(otherUser) otherUser.otherUserIce.push(candidate)
  }
}

class Room {
  constructor(name) {
    this.name = name
    this.user1 = null
    this.user2 = null
    setTimeout(()=>this.clean(), 5000)
  }
  clean() {
    if(this.user1 == null && this.user2 == null) return rooms.delete(this.name)
    setTimeout(()=>this.clean(), 5000)
  }
  getOrAddUser(sessionId, ip) {
    if(this.user1 && this.user1.sessionId == sessionId) {
      if(this.user1.getIp() != ip) this.user1.setIp(ip)
      return this.user1
    }
    if(this.user2 && this.user2.sessionId == sessionId) {
      if(this.user2.getIp() != ip) this.user2.setIp(ip)
      return this.user2
    }
    if(!this.user1) return this.user1 = new User(this, sessionId, ip, false)
    if(!this.user2) return this.user2 = new User(this, sessionId, ip, true)
    throw new Error("room full")
  }
  deleteUser(sessionId) {
    if(this.user1 && this.user1.sessionId == sessionId) this.user1 = null
    if(this.user1 && this.user2.sessionId == sessionId) this.user2 = null
    if(this.user1) this.user1.reset()
    if(this.user2) this.user2.reset()
  }
  otherUser(sessionId) {
    if(this.user1 && this.user1.sessionId != sessionId) return this.user1
    if(this.user2 && this.user2.sessionId != sessionId) return this.user2
  }
}

function getOrCreateRoom(roomName) {
  let room = rooms.get(roomName)
  if(!room) {
    room = new Room(roomName)
    rooms.set(roomName, room)
  }
  return room
}

function observableGet(observableFunc) {
  return {
    observable: (what) => observableFunc(what),
    get: (what) => observableFunc(what).value
  }
}

function getIP(connection) {
  var ip = connection.headers['x-forwarded-for'] || connection.remoteAddress
  ip = ip.split(',')[0]
  ip = ip.split(':').slice(-1)[0] //in case the ip returned in a format: "::ffff:146.xxx.xxx.xxx"
  return ip
}

function daoFactory(sessionId, connection) {
  const ip = getIP(connection)
  return new ReactiveDao(sessionId, {
    room: {
      type: "local",
      source: new ReactiveDao.SimpleDao({
        values: {
          amICalling: observableGet((roomName) => getOrCreateRoom(roomName).getOrAddUser(sessionId, ip).calling),
          myIp: observableGet((roomName) => getOrCreateRoom(roomName).getOrAddUser(sessionId, ip).ip),
          otherUserSdp: observableGet((roomName) => getOrCreateRoom(roomName).getOrAddUser(sessionId, ip).otherUserSdp),
          otherUserIce: observableGet((roomName) => getOrCreateRoom(roomName).getOrAddUser(sessionId, ip).otherUserIce)
        },
        methods: {
          addIce(roomName, candidate) {
            getOrCreateRoom(roomName).getOrAddUser(sessionId, ip).addIce(candidate)
            return Promise.resolve('ok')
          },
          setSdp(roomName, offer) {
            getOrCreateRoom(roomName).getOrAddUser(sessionId, ip).setSdp(offer)
            return Promise.resolve('ok')
          },
          exitRoom(roomName) {
            let room = rooms.get(roomName)
            if(!room) throw new Error("room "+roomName+" not found")
            room.deleteUser(sessionId)
            return Promise.resolve('ok')
          }
        }
      })
    }
  })
}

const ReactiveServer = require("reactive-dao").ReactiveServer

const reactiveServer = new ReactiveServer(daoFactory)

const port = process.env.HTTP_PORT || 8181

const sockjs_server = sockjs.createServer({})
sockjs_server.on('connection', function(conn) {
  if(reactiveServer) reactiveServer.handleConnection(conn)
})

const app = express()
app.use(express.static('../client'))

const server = http.createServer(app)
sockjs_server.installHandlers(server, { prefix: '/sockjs' })
server.listen(port)

console.log(`server started at localhost:${port}`)
