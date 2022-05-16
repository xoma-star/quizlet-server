import { Server } from 'socket.io'
import onConnect from "./functions/onConnect";
import {VKClients} from "./VKClient";

const io = new Server(5000, {
    cors: {
        origin: '*'
    }
})

const clients = new VKClients()

io.on('connection', (client) => onConnect(client, clients))