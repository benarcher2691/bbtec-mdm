declare module 'app-info-parser' {
  export interface ApkInfo {
    package: string
    versionName: string
    versionCode: number
  }

  export default class AppInfoParser {
    constructor(filePath: string)
    parse(): Promise<ApkInfo>
  }
}
