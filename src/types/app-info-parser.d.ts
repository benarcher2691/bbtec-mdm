declare module 'app-info-parser' {
  interface AppInfo {
    package?: string
    versionName?: string
    versionCode?: number
    application?: {
      label?: string[]
    }
  }

  class AppInfoParser {
    constructor(file: Buffer | string)
    parse(): Promise<AppInfo>
  }

  export = AppInfoParser
}
