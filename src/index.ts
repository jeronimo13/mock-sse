import debug from "debug";
import express from 'express'
import http, {Server} from 'http'

const log = debug('sseserver')

export interface ISSEServer<T> {
    start(): Promise<void>

    stop(): Promise<void>

    pushNewData(data: T, event: string): void

    keepalive(): void
}

export class SSEServer<T> implements ISSEServer<T> {
    private readonly port: number = 3201
    private app = express()
    private clients: any = {}
    private clientId: number = 0
    private readonly connectionURL: string = '/events/:api'

    private instance!: Server

    constructor(port: number, connectionURL?: string) {
        this.port = port
        if (connectionURL) {
            this.connectionURL = connectionURL
        }
    }

    public start(): Promise<void> {
        return new Promise(resolve => {
            this.app.get(this.connectionURL, (req: any, res: any) => {
                req.socket.setTimeout(10000)
                res.writeHead(200, {
                    'Content-Type': 'text/event-stream', // <- Important headers
                    'Cache-Control': 'no-cache',
                    Connection: 'keep-alive'
                })
                res.write('\n')
                ;(index => {
                    this.clients[index] = res // <- Add this client to those we consider "attached"
                    req.on('close', () => {
                        delete this.clients[index]
                    }) // <- Remove this client when he disconnects
                })(++this.clientId)
            })
            this.instance = http.createServer(this.app)
            this.instance.listen(this.port, () => {
                resolve()
                log('Server has started')
            })
        })
    }

    public stop(): Promise<void> {
        return new Promise(resolve => {
            for (const index in this.clients) {
                if (this.clients.hasOwnProperty(index)) {
                    const client = this.clients[index]
                    client.end()
                }
            }
            this.instance.close(() => {
                resolve()
                log('SSEServer has stopped')
            })
        })
    }

    public pushNewData(data: T, event: string): void {
        const id = 0
        for (const index in this.clients) {
            if (this.clients.hasOwnProperty(index)) {
                const client = this.clients[index]
                client.write('id: ' + id + '\n')
                client.write('event: ' + event + '\n')
                client.write('data: ' + JSON.stringify(data) + '\n')
                client.write('\n')
                log(`${event} has just sent to clientId: ${id}`)
            }
        }
    }

    public keepalive(): void {
        const event = 'keepalive'
        const id = 0
        for (const index in this.clients) {
            if (this.clients.hasOwnProperty(index)) {
                const client = this.clients[index]
                client.write('id: ' + id + '\n')
                client.write('event: ' + event + '\n')
                client.write('data:\n')
                client.write('\n')
                log(`keepalive has just sent to clientId: ${id}`)
            }
        }
    }
}
