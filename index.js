const client = require("prom-client")

/**
 * @param {import("./types").PluginProps} props
 */
module.exports = async ({  battlefield, router }) => {

  const serverinfo = await battlefield.serverInfo()
  const defaultLabels = { serverName: serverinfo.name }
  client.register.setDefaultLabels(defaultLabels)

  /**
   * @type {Record<string, (() => void)[]>} player data
   */
  const players = {}

  const playerScores = new client.Gauge({
    name: "vu_player_score",
    help: "scores of all players online",
    labelNames: ["name", "team"]
  })

  const playerKills = new client.Gauge({
    name: "vu_player_kills",
    help: "kills of all players online",
    labelNames: ["name", "team"]
  })

  const playerDeaths = new client.Gauge({
    name: "vu_player_deaths",
    help: "deaths of all players online",
    labelNames: ["name", "team"]
  })

  const playerPing = new client.Gauge({
    name: "vu_player_ping",
    help: "ping of all players online",
    labelNames: ["name", "team"]
  })

  const kills = new client.Gauge({
    name: "vu_player_kill_event",
    help: "player kill events",
    labelNames: ["player", "target", "weapon", "headshot"],
  })

  const game = new client.Gauge({
    name: "vu_current_game",
    help: "current game summaries",
    labelNames: ["map", "mode"]
  })

  /** @type {any} */
  let currentGame
  /** @type {any} */
  let end

  /**
   * updates current game infos
   * @param {import("vu-rcon").Battlefield.ServerInfo} [serverinfo]
   */
  const updateGame = async (serverinfo) => {
    if (end) end()
    if (!serverinfo) serverinfo = await battlefield.serverInfo()
    currentGame = game.labels(serverinfo.map, serverinfo.mode)
    currentGame.set(serverinfo.slots)
    end = currentGame.startTimer()
  }

  const updatePlayers = async () => {
    const data = await battlefield.getPlayers()
    data.forEach(player => {
      const labels = [player.name, String(player.teamId)]
      const scores = playerScores.labels(...labels)
      scores.set(player.score)
      const kills = playerKills.labels(...labels)
      kills.set(player.kills)
      const deaths = playerDeaths.labels(...labels)
      deaths.set(player.deaths)
      const ping = playerPing.labels(...labels)
      ping.set(player.ping)
      if (!players[player.guid]) {
        players[player.guid] = [
          scores.startTimer(),
          kills.startTimer(),
          deaths.startTimer(),
          ping.startTimer()
        ]
      }
    })
  }

  //initiate intervals and initial update
  setInterval(() => updatePlayers(), 5 * 1000)
  await Promise.all([ updateGame(), updatePlayers() ])


  //register metrics route
  router.get("metrics", async ctx => {
    ctx.res.body(await client.register.metrics()).send(200)
  })

  //remove player from server
  battlefield.on("playerLeave", ev => {
    const callbacks = players[ev.player.guid]
    if (!Array.isArray(callbacks)) return
    callbacks.forEach(cb => cb())
  })

  //register kill handler
  battlefield.on("kill", ({ killer, killed, weapon, headshot }) => {
    kills.labels(killer || "", killed, weapon, String(headshot)).inc()
  })

  //update current map
  battlefield.on("levelLoaded", async () => updateGame())

  //get new slots after player join
  battlefield.on("playerAuthenticated", async () => {
    const { slots } = await battlefield.serverInfo()
    currentGame.set(slots)
  })

  //update slot count
  battlefield.on("playerLeave", async () => {
    const { slots } = await battlefield.serverInfo()
    currentGame.set(slots)
  })

}