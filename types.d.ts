import { Battlefield } from "vu-rcon"

export interface PluginStore {
  get(key: string): any
  set(key: string, value: any): void
  clear(): void
}

export interface Logger {
  info(message: string): void
  warn(message: string): void
  error(message: string): void
}

export interface PluginRouterResponse {
  body(data: any): PluginRouterResponse
  status(code: number): PluginRouterResponse
  send(code?: number): Promise<void>
}

export type Context = {
  /** possible payload which has been sent **/
  readonly body: any
  /** respond with data back to the frontend */
  res: PluginRouterResponse
}

export type RouterCallback = (ctx: Context) => void

export interface PluginRouter {
  /** GET requests */
  get(name: string, callback: RouterCallback): PluginRouter
  /** POST requests */
  post(name: string, callback: RouterCallback): PluginRouter
  /** PATCH requests */
  patch(name: string, callback: RouterCallback): PluginRouter
  /** DELETE requests */
  delete(name: string, callback: RouterCallback): PluginRouter
}

export interface PluginProps {
  battlefield: Battlefield
  router: PluginRouter
  logger: Logger
  dependency: Record<string, any>
  config: Record<string, any>
  store: PluginStore
}

export type PluginCallback = (props: PluginProps) => void