import {AxiosInstance} from "axios";

export class UserRequests {
  constructor(private readonly httpClient: AxiosInstance) {
  }

  public async create(username: string) {
    const { data } = await this.httpClient.post('/api/create-user', {name: username})
    return data;
  }

  public async delete(username: string) {
    await this.httpClient.post('/api/delete-user', {username: username})
  }
}
