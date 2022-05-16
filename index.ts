import { Server } from 'socket.io'
import onConnect from "./functions/onConnect";
import {VKClients} from "./VKClient";

let PORT = 5000

if(typeof process.env.PORT !== 'undefined') PORT = parseInt(process.env.PORT)

const io = new Server(PORT, {
    cors: {
        origin: '*'
    }
})

const clients = new VKClients()

io.on('connection', (client) => onConnect(client, clients))