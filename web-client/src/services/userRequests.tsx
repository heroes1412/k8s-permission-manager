import {AxiosInstance} from "axios";

export class UserRequests {
  constructor(private readonly httpClient: AxiosInstance) {
  }

  public async create(username: string, maxDays: number = 0, groups: string[] = [], resources: any[] = []) {
    const { data } = await this.httpClient.post('/api/create-user', { name: username, maxDays, groups, resources })
    return data;
  }

  public async update(username: string, maxDays: number, groups: string[] = [], resources: any[] = []) {
    const { data } = await this.httpClient.post('/api/update-user', { name: username, maxDays, groups, resources })
    return data;
  }

  public async delete(username: string) {
    await this.httpClient.post('/api/delete-user', {username: username})
  }
}
