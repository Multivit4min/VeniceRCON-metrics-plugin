const client = require("prom-client")

/**
 * @param {import("./types").PluginProps} props
 */
module.exports = async ({  battlefield, router }) => {

  const serverinfo = await battlefield.serverInfo()
  const defaultLabels = { serverName: serverinfo.name }
  client.register.setDefaultLabels(defaultLabels)


  const kills = new client.Gauge({
    name: "vu_player_kills_count",
    help: "kill count",
    labelNames: ["player", "target", "weapon", "headshot"],
  })

  const game = new client.Histogram({
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
    currentGame.observe(serverinfo.slots)
    end = currentGame.startTimer()
  }

  await updateGame()

  //register metrics route
  router.get("metrics", async ctx => {
    ctx.res.body(await client.register.metrics()).send(200)
  })

  //register kill handler
  battlefield.on("kill", ({ killer, killed, weapon, headshot }) => {
    kills.labels(killer || "", killed, weapon, String(headshot)).inc()
  })

  //update current map
  battlefield.on("levelLoaded", async () => updateGame())

  battlefield.on("playerAuthenticated", async () => {
    const { slots } = await battlefield.serverInfo()
    currentGame.observe(slots)
  })

  battlefield.on("playerLeave", async () => {
    const { slots } = await battlefield.serverInfo()
    currentGame.observe(slots)
  })

}