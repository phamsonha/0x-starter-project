import * as QueryString from 'query-string'
import { APIConfig} from './types';
const fetch = require('node-fetch');


export default class HttpUtils {
        /**
         *  url for the API
         */
         public readonly apiUrl: string
         /**
          * Logger function to use when debugging
          */
         public logger: (arg: string) => void

         protected apiKey: string | undefined

         /**
          * @param config APIConfig for setting up the API
          * @param logger Optional function for logging debug strings before and after requests are made
          */
         constructor(root: string, logger?: (arg: string) => void) {
            this.apiUrl = root
             // Debugging: default to nothing
             this.logger = logger || ((arg: string) => arg)
         }

    /**
   * Get JSON data from API, sending auth token in headers
   * @param apiPath Path to URL endpoint under API
   * @param query Data to send. Will be stringified using QueryString
   */
     public async get(apiPath: string, query: object = {}): Promise<any> {

        console.log("object-query", query, "api", apiPath)
        const qs = QueryString.stringify(query, {arrayFormat: 'bracket'})
        console.log("querry-string", qs)
        const url = `${apiPath}?${qs}`

        const response = await this._fetch(url)
        return response.json()
    }

    /**
     * POST JSON data to API, sending auth token in headers
     * @param apiPath Path to URL endpoint under API
     * @param body Data to send. Will be JSON.stringified
     * @param opts RequestInit opts, similar to Fetch API. If it contains
     *  a body, it won't be stringified.
     */
    public async post(apiPath: string, query: object = {}, body?: object, headers = {}): Promise<any> {
        console.log("object-query", query, "api", apiPath)
        const qs = QueryString.stringify(query, {arrayFormat: 'bracket'})
        console.log("querry-string", qs)
        const url = `${apiPath}?${qs}`
        let fullHeaders = {
            ...{
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
            ...headers
        }
        const fetchOpts = {
            method: 'POST',
            body: body ? JSON.stringify(body) : undefined,
            headers: fullHeaders
        }

        const response = await this._fetch(url, fetchOpts)
        return response.json()
    }

    /**
     * PUT JSON data to API, sending auth token in headers
     * @param apiPath Path to URL endpoint under API
     * @param body Data to send
     * @param opts RequestInit opts, similar to Fetch API. If it contains
     *  a body, it won't be stringified.
     */
    public async put(apiPath: string, body: object) {

        return this.post(apiPath, body, {
            method: 'PUT'
        })
    }

    /**
     * Get from an API Endpoint, sending auth token in headers
     * @param apiPath Path to URL endpoint under API
     * @param opts RequestInit opts, similar to Fetch API
     */
     private async _fetch(apiPath: string, opts: any = {}) {
        const apiKey = this.apiKey
        const finalUrl = this.apiUrl + apiPath
        const finalOpts = {
            ...opts,
            headers: {
                ...(apiKey ? { 'X-API-KEY': apiKey } : {}),
                ...(opts.headers || {}),
            },
        }

        this.logger(`Sending request: ${finalUrl} ${JSON.stringify(finalOpts).substr(0, 100)}...`)

        return fetch(finalUrl, finalOpts,).then(async (res : any) => this._handleApiResponse(res))
    }

    private async _handleApiResponse(response: any) {
        if (response.ok) {
            this.logger(`Got success: ${response.status}`)
            return response
        }

        let result
        let errorMessage
        try {
            result = await response.text()
            result = JSON.parse(result)
        } catch {
            // Result will be undefined or text
        }

        this.logger(`Got error ${response.status}: ${JSON.stringify(result)}`)

        switch (response.status) {
            case 400:
                errorMessage = result && result.errors
                    ? result.errors.join(', ')
                    : `Invalid request: ${JSON.stringify(result)}`
                break
            case 401:
            case 403:
                errorMessage = `Unauthorized. Full message was '${JSON.stringify(result)}'`
                break
            case 404:
                errorMessage = `Not found. Full message was '${JSON.stringify(result)}'`
                break
            case 500:
                errorMessage = `Internal server error. OpenSea has been alerted, but if the problem persists please contact us via Discord: https://discord.gg/ga8EJbv - full message was ${JSON.stringify(result)}`
                break
            case 503:
                errorMessage = `Service unavailable. Please try again in a few minutes. If the problem persists please contact us via Discord: https://discord.gg/ga8EJbv - full message was ${JSON.stringify(result)}`
                break
            default:
                errorMessage = `Message: ${JSON.stringify(result)}`
                break
        }

        throw new Error(`API Error ${response.status}: ${errorMessage}`)
    }
}