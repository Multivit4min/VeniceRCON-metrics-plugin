const client = require("prom-client")

/**
 * @param {import("./types").PluginProps} props
 */
module.exports = async ({  battlefield, router }) => {

  const serverinfo = await battlefield.serverInfo()
  const defaultLabels = { serverName: serverinfo.name }
  client.register.setDefaultLabels(defaultLabels)

  const playerScores = new client.Gauge({
    name: "vu_player_score",
    help: "scores of all players online",
    labelNames: ["name"]
  })

  const playerKills = new client.Gauge({
    name: "vu_player_kills",
    help: "kills of all players online",
    labelNames: ["name"]
  })

  const playerDeaths = new client.Gauge({
    name: "vu_player_deaths",
    help: "deaths of all players online",
    labelNames: ["name"]
  })

  const playerPing = new client.Gauge({
    name: "vu_player_ping",
    help: "ping of all players online",
    labelNames: ["name"]
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

  /** @type {[string, string]} */
  let currentGameLabels

  /**
   * updates current game infos
   * @param {import("vu-rcon").Battlefield.ServerInfo} [serverinfo]
   */
  const updateGame = async (serverinfo) => {
    if (!serverinfo) serverinfo = await battlefield.serverInfo()
    /** @type {[string, string]} */
    const label = [serverinfo.map, serverinfo.mode]
    if (currentGameLabels[0] !== label[0] || currentGameLabels[1] !== label[1]) {
      game.remove(...currentGameLabels)
      currentGameLabels = label
    }
    game.labels(...currentGameLabels).set(serverinfo.slots)
  }

  const updatePlayers = async () => {
    (await battlefield.getPlayers()).forEach(player => {
      const labels = [player.name]
      playerScores.labels(...labels).set(player.score)
      playerKills.labels(...labels).set(player.kills)
      playerDeaths.labels(...labels).set(player.deaths)
      playerPing.labels(...labels).set(player.ping)
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
  battlefield.on("playerLeave", ({ player }) => {
    const labels = [player.name]
    playerScores.remove(...labels)
    playerKills.remove(...labels)
    playerDeaths.remove(...labels)
    playerPing.remove(...labels)
  })

  //register kill handler
  battlefield.on("kill", ({ killer, killed, weapon, headshot }) => {
    kills.labels(killer || "", killed, weapon, String(headshot)).inc()
  })

  //update current map
  battlefield.on("levelLoaded", () => updateGame())
  //get new slots after player join
  battlefield.on("playerAuthenticated", () => updateGame())
  //update slot count
  battlefield.on("playerLeave", () => updateGame())

}