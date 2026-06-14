import axios, {AxiosInstance} from 'axios';


export function httpClientFactory(): AxiosInstance {
  /**
   * The HttpClient that deals with the backend requests.
   * it is possible to customize the url with the env variable REACT_APP_BACKEND_URL and BASIC_AUTH_PASSWORD.
   * Useful for local development.
   */
  const httpClient = axios.create({
    url: process.env.REACT_APP_BACKEND_URL ?? "",
    baseURL: process.env.REACT_APP_BACKEND_URL ?? ""
  })

  // WARNING: REACT_APP_BASIC_AUTH_PASSWORD is baked into the JS bundle at build time
  // and is visible to anyone who downloads the page. Use this ONLY for local development.
  // In production the browser handles credentials via the Basic Auth dialog — do NOT
  // set this env variable in a production build or CI pipeline.
  if (process.env.REACT_APP_BASIC_AUTH_PASSWORD) {
    httpClient.defaults.auth = {
      username: "admin",
      password: process.env.REACT_APP_BASIC_AUTH_PASSWORD
    }
  }

  return httpClient;
}

export const httpClient = httpClientFactory();
