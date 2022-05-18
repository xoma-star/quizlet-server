import {Socket} from "socket.io";
import {getThemes} from "./getThemes";
import {VKClient, VKClients} from "../VKClient";

const onConnect = (client: Socket, clients: VKClients) => {
    client.on('handshake', (data: {uid: string, salt: string}) => {
        const newClient: VKClient = {vkid: data.uid, socket: client}
        clients.addClient(newClient)
        clients.sendToClient(data.uid, 'handshake')
    })
    client.on('getThemes', async (callback) => callback(await getThemes()))
    client.on('getPreferredThemes', async (callback) => callback(await clients.getPreferredThemes(client.id)))
    client.on('queue', (data, callback) => clients.insertQueue(data, callback, client.id))
    client.on('addPlayerDataToRoom', (data, callback) => clients.addUserDataToRoom(data, callback))
    client.on('disconnect', () => clients.removeClient(client))
    client.on('exitQueue', (data) => clients.removeFromQueue(data.id))
    client.on('answerQuestion', (data) => clients.playerAnswered(data))
}

export default onConnect