export interface User {
  /**
   *  same as the name, it is populated sometime by the frontend?
   */
  readonly id?: string
  readonly name: string
  readonly friendlyName?: string
  readonly maxDays?: number
  readonly groups?: string[]
  readonly createdAt?: string
}
